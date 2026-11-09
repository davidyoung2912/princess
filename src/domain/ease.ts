/** Ease-of-use logic (look and feel L5): reordering favourites, search suggestions, keyboard shortcuts and the "Show me" guides. Pure, so it is unit tested without React. */

/** The list with `id` moved one place earlier (`-1`) or later (`1`). An id that is not there, or already at the end, leaves it unchanged. */
export function movePin(pins: readonly string[], id: string, delta: -1 | 1): string[] {
  const from = pins.indexOf(id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= pins.length) return [...pins]
  const out = [...pins]
  out[from] = pins[to]!
  out[to] = id
  return out
}

/** Words to try in search before the guest types, by whether they are on the ship. Each is a plain word the search already understands. */
export const SEARCH_CHIPS = {
  aboard: ['muster', 'dinner', 'cabin', 'tender', 'wifi', 'pool'],
  ashore: ['check-in', 'packing', 'documents', 'cabin', 'dinner', 'wifi'],
} as const

export const searchChips = (aboard: boolean): readonly string[] => (aboard ? SEARCH_CHIPS.aboard : SEARCH_CHIPS.ashore)

export type ShortcutAction = 'search' | 'help' | 'home' | 'plan' | 'ship' | 'me'

export interface Shortcut { keys: string; action: ShortcutAction; to?: string }

/** The desktop shortcuts. Every one is also reachable by a visible control; none is the only way to do anything. */
export const SHORTCUTS: readonly Shortcut[] = [
  { keys: '/', action: 'search', to: '/ship/search' },
  { keys: '?', action: 'help' },
  { keys: 'g h', action: 'home', to: '/' },
  { keys: 'g p', action: 'plan', to: '/plan' },
  { keys: 'g s', action: 'ship', to: '/ship' },
  { keys: 'g m', action: 'me', to: '/account' },
]

export interface ChordState { pending: boolean; shortcut: Shortcut | null }

/** Takes the next key (and whether a "g" is waiting) and says what to do. `g` waits for a second key; any other key after it clears the wait. */
export function nextChord(pending: boolean, key: string): ChordState {
  if (pending) {
    const hit = SHORTCUTS.find((s) => s.keys === `g ${key.toLowerCase()}`)
    return { pending: false, shortcut: hit ?? null }
  }
  if (key === 'g') return { pending: true, shortcut: null }
  return { pending: false, shortcut: SHORTCUTS.find((s) => s.keys === key) ?? null }
}

/** Whether a key press should be left alone: typing in a field, a held modifier, or something already handling it. */
export function ignoreKey(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; target: { tagName?: string; isContentEditable?: boolean } | null }): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true
  const tag = e.target?.tagName?.toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable === true
}

/** The "Show me" guides: three short captioned steps each. */
export const SHOW_ME_IDS = ['gangway', 'muster', 'tender'] as const
export type ShowMeId = (typeof SHOW_ME_IDS)[number]
export const SHOW_ME_STEPS = 3
