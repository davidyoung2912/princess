import { en } from '../i18n/locales/en'

const KEY = 'princess.dismissedTips'
const listeners = new Set<() => void>()
let cache: Readonly<Record<string, number>> | null = null

/** Which page's tips to show: its screen id, or for a tab landing page the tab's key. Null when the page has none. */
export function tipIdFor(screenId: string | undefined, tabKey: string | undefined): string | null {
  if (screenId) return screenId
  return tabKey ? `tab.${tabKey}` : null
}

/** The text key of a page's nth tip (1-based): `tip.H02` for the first, `tip.H02.2` for the second, and so on. */
export const tipKeyAt = (id: string, n: number): string => (n === 1 ? `tip.${id}` : `tip.${id}.${n}`)

/** True when a tip is written for this page and number. */
export const hasTip = (id: string, n = 1): boolean => tipKeyAt(id, n) in en

/** How many tips a page has: they are numbered without gaps from 1. */
export function tipCount(id: string): number {
  let n = 0
  while (hasTip(id, n + 1)) n++
  return n
}

/** How many of each page's tips this device has dismissed (a per-device note, never sent anywhere). An older list of dismissed pages counts as one tip each. */
export function loadTipProgress(): Readonly<Record<string, number>> {
  if (cache) return cache
  const progress: Record<string, number> = {}
  try {
    const raw = localStorage.getItem(KEY)
    const data: unknown = raw === null ? {} : JSON.parse(raw)
    if (Array.isArray(data)) for (const id of data) { if (typeof id === 'string') progress[id] = 1 }
    else if (data && typeof data === 'object') for (const [id, n] of Object.entries(data)) { if (typeof n === 'number' && n > 0) progress[id] = Math.floor(n) }
  } catch { /* unreadable: start again */ }
  cache = progress
  return cache
}

function save(progress: Readonly<Record<string, number>>): void {
  cache = progress
  try { localStorage.setItem(KEY, JSON.stringify(progress)) } catch { /* private mode: the tips may show again */ }
  listeners.forEach((l) => l())
}

export const subscribeTips = (listener: () => void): (() => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** Dismisses the tip now showing on a page, so its next one (if any) shows. */
export function dismissTip(id: string): void {
  const progress = loadTipProgress()
  save({ ...progress, [id]: Math.min((progress[id] ?? 0) + 1, tipCount(id)) })
}

/** Brings every tip back. */
export function resetTips(): void { save({}) }
