import { ALL_TAB_KEYS } from '../routes/stageNav'

const KEY = 'princess.seenTabs'

/** The tabs this device has already shown the guest (a per-device note, never sent anywhere); null when none are recorded yet. */
export function loadSeenTabs(): string[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return null
    const list: unknown = JSON.parse(raw)
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && ALL_TAB_KEYS.includes(x)) : null
  } catch { return null }
}

export function saveSeenTabs(keys: readonly string[]): void {
  try { localStorage.setItem(KEY, JSON.stringify([...new Set(keys)])) } catch { /* private mode: the note may show again */ }
}
