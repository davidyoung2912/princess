import { getContext, subscribeContext } from '../../features/account/logic/context'
import { sync } from '../sync'
import { EMPTY_HINTS, normalizeHints, type Hints } from './hintsState'

/**
 * The tips and tour steps a guest has dismissed, in memory only: the server's copy on their account is the real one and the sync module pulls it at sign-in
 * (see the `hints` binding). `loaded` says that copy has arrived; until then nothing is shown, so a returning guest on a new device is not shown things they already dismissed.
 */
const keyFor = (id: string | null): string => id ?? ''
const whoAmI = (): string | null => getContext()?.person.id ?? null

const cache = new Map<string, Hints>()
const loaded = new Set<string>()
const listeners = new Set<() => void>()
const tell = (): void => listeners.forEach((l) => l())

export const getHints = (id: string | null = whoAmI()): Hints => cache.get(keyFor(id)) ?? EMPTY_HINTS
export const hintsLoaded = (id: string | null = whoAmI()): boolean => loaded.has(keyFor(id))

/** Tells a screen when the hints change, or when another person is signed in. */
export function subscribeHints(listener: () => void): () => void {
  listeners.add(listener)
  const stop = subscribeContext(listener)
  return () => { listeners.delete(listener); stop() }
}

/** Changes the signed-in guest's hints, saves them to their account and tells subscribers. Nothing happens when the change is nothing. */
export function updateHints(change: (h: Hints) => Hints): void {
  const id = whoAmI()
  const now = getHints(id)
  const next = change(now)
  if (next === now) return
  cache.set(keyFor(id), next)
  tell()
  sync.changed('hints', id)
}

/** Takes the server's copy (null: empty) without telling the sync module it changed. */
export function applyRemoteHints(id: string | null, raw: unknown): void {
  cache.set(keyFor(id), raw === null ? EMPTY_HINTS : normalizeHints(raw))
  tell()
}

/** The server's answer for this person has arrived, whether or not it held a document. */
export function markHintsLoaded(id: string | null): void {
  if (loaded.has(keyFor(id))) return
  loaded.add(keyFor(id))
  tell()
}
