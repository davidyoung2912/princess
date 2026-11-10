/** The browser side of alerts: permission, subscription and the badge. The only module that touches `navigator` for push; the decisions are in `push.ts`. */
import { api } from '../runtime'
import { badgeCount, bytesToKey, chatTagFor, cleanWatch, keyToBytes, pushSupport, staleChatTags, type PushEnvironment, type PushStatus, type PushSupport } from './push'
import { getSettings } from '../settings/store'

export function readEnvironment(): PushEnvironment {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return { hasServiceWorker: false, hasPushManager: false, hasNotification: false, permission: null, userAgent: '', standalone: false, maxTouchPoints: 0 }
  }
  const nav = navigator as Navigator & { standalone?: boolean }
  return {
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: typeof window !== 'undefined' && 'PushManager' in window,
    hasNotification: typeof Notification !== 'undefined',
    permission: typeof Notification !== 'undefined' ? Notification.permission : null,
    userAgent: navigator.userAgent,
    standalone: nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true,
    maxTouchPoints: navigator.maxTouchPoints,
  }
}

export const currentSupport = (): PushSupport => pushSupport(readEnvironment())

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready)
}

/** This phone's push address, or null when it has none. */
export async function currentEndpoint(): Promise<string | null> {
  try { return (await (await registration())?.pushManager.getSubscription())?.endpoint ?? null } catch { return null }
}

function limits() {
  const s = getSettings()
  return { budget: s.nudgesPerDay, calm: s.calm }
}

/** Asks for permission (only from a tap), subscribes against the server's key and tells the server this phone's limits. */
export async function turnOn(status: PushStatus, watch: readonly string[]): Promise<PushStatus> {
  if (!status.publicKey) throw new Error('unavailable')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('denied')
  const reg = await registration()
  if (!reg) throw new Error('unsupported')
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(status.publicKey) }))
  return sendLimits(sub, watch)
}

async function sendLimits(sub: PushSubscription, watch: readonly string[]): Promise<PushStatus> {
  return api.push.subscribe({ endpoint: sub.endpoint, p256dh: bytesToKey(sub.getKey('p256dh')), auth: bytesToKey(sub.getKey('auth')), ...limits(), watch: cleanWatch(watch) })
}

/** Re-sends this phone's limits (budget, calm, watched events) when they change. Does nothing when the phone is not registered. */
export async function syncLimits(watch: readonly string[]): Promise<void> {
  try {
    const sub = await (await registration())?.pushManager.getSubscription()
    if (sub) await sendLimits(sub, watch)
  } catch { /* the next change tries again */ }
}

export async function turnOff(): Promise<PushStatus | null> {
  const sub = await (await registration())?.pushManager.getSubscription()
  if (!sub) return null
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  return api.push.unsubscribe(endpoint)
}

/** The unread count on the app icon, where the browser allows it. */
export function setBadge(unread: number): void {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  const n = badgeCount(unread)
  try { void (n > 0 ? nav.setAppBadge?.(n) : nav.clearAppBadge?.())?.catch(() => undefined) } catch { /* not supported */ }
}

let watched: string[] = []

/** The events the guest is following (from the day they are looking at). Sent with this phone's limits so the server can say when one moves. */
export function setWatched(ids: readonly string[]): void {
  const next = cleanWatch(ids)
  if (next.join(' ') === watched.join(' ')) return
  watched = next
  void syncLimits(watched)
}

export const getWatched = (): readonly string[] => watched

/** Asks to show a reminder when a parked spot is due (DL7). Only from a tap; resolves to whether the browser agreed. */
export async function allowLocalReminders(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  try { return (Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()) === 'granted' } catch { return false }
}

/**
 * Shows `title` after `ms`, through the service worker so it appears with the app in the background. This is a timer in the page, not a push from the
 * server: if the browser closes the page the reminder is lost. Returns a function that cancels it.
 */
export function remindIn(ms: number, title: string, body: string): () => void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return () => undefined
  const id = setTimeout(() => {
    void (async () => {
      try { (await registration())?.showNotification(title, { body, tag: 'spot' }) } catch { /* nothing to show it with */ }
    })()
  }, Math.max(0, ms))
  return () => clearTimeout(id)
}

/** Takes a conversation's alert off this device's screen, for when the guest has opened or read it (here or on another device). */
export async function closeChatNotice(conversationId: string): Promise<void> {
  try {
    const tag = chatTagFor(conversationId)
    for (const n of (await (await registration())?.getNotifications({ tag })) ?? []) n.close()
  } catch { /* nothing to close, or no way to ask */ }
}

/** Takes off this device's screen the chat alerts the guest has already dealt with elsewhere, judged from the shared chat numbers. */
export async function closeSettledChatNotices(unread: number, urgentConversations: readonly string[]): Promise<void> {
  try {
    const shown = (await (await registration())?.getNotifications()) ?? []
    const stale = new Set(staleChatTags(shown.map((n) => n.tag), unread, urgentConversations))
    for (const n of shown) if (stale.has(n.tag)) n.close()
  } catch { /* nothing to close, or no way to ask */ }
}
