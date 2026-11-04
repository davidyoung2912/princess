const KEY = 'princess.stanleySeen'
const listeners = new Set<() => void>()
let cache: Readonly<Record<string, true>> | null = null
let replays: ReadonlySet<string> = new Set()
let version = 0

/** What this device has already shown or dismissed: celebrations (`booked:PR123`) and tours (`coach:S01`). Per device, never sent anywhere. */
export function loadSeen(): Readonly<Record<string, true>> {
  if (cache) return cache
  const seen: Record<string, true> = {}
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (data && typeof data === 'object' && !Array.isArray(data)) for (const [k, v] of Object.entries(data)) { if (v === true) seen[k] = true }
  } catch { /* unreadable: start again */ }
  cache = seen
  return cache
}

const emit = () => { version++; listeners.forEach((l) => l()) }

export const subscribeSeen = (listener: () => void): (() => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const seenVersion = (): number => version

export const isSeen = (key: string): boolean => !!loadSeen()[key]

export function markSeen(key: string): void {
  cache = { ...loadSeen(), [key]: true }
  const next = new Set(replays)
  next.delete(key)
  replays = next
  try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* private mode: it may show again */ }
  emit()
}

/** Asks for a tour again (from the help panel), until it is dismissed. */
export function requestReplay(key: string): void { replays = new Set(replays).add(key); emit() }
export const isReplayed = (key: string): boolean => replays.has(key)

/** Brings every celebration and tour back. */
export function resetSeen(): void {
  cache = {}
  replays = new Set()
  try { localStorage.removeItem(KEY) } catch { /* nothing to remove */ }
  emit()
}
