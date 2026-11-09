import { EMPTY_WELCOME, markWelcomeSeen, normalizeWelcome, unmarkWelcome, type StageWelcomeState } from '../routes/stageWelcome'
import { sync } from '../sync'

/**
 * Which stage welcomes a person has seen, in memory only: the server's copy is the real one and the sync module pulls it at sign-in.
 * `loaded` says that copy has arrived; until then the app must not guess that a welcome is new.
 */
const keyFor = (personaId: string | null): string => personaId ?? ''

const cache = new Map<string, StageWelcomeState>()
const loaded = new Set<string>()
const listeners = new Set<() => void>()

const tell = (): void => listeners.forEach((l) => l())

export function getWelcome(personaId: string | null): StageWelcomeState {
  return cache.get(keyFor(personaId)) ?? EMPTY_WELCOME
}

export function welcomeLoaded(personaId: string | null): boolean {
  return loaded.has(keyFor(personaId))
}

export function subscribeWelcome(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Records a welcome as seen, saves it and tells the sync module. Nothing happens when it was seen already. */
export function markSeen(personaId: string | null, key: string, now: number): void {
  const cur = getWelcome(personaId)
  const next = markWelcomeSeen(cur, key, now)
  if (next === cur) return
  cache.set(keyFor(personaId), next)
  tell()
  sync.changed('stageWelcome', personaId)
}

/** Forgets one welcome, so it shows again the next time it is due. Saved like any change. */
export function unmarkSeen(personaId: string | null, key: string): void {
  const cur = getWelcome(personaId)
  const next = unmarkWelcome(cur, key)
  if (next === cur) return
  cache.set(keyFor(personaId), next)
  tell()
  sync.changed('stageWelcome', personaId)
}

/** Forgets every welcome seen, so each stage's welcome shows again the next time the guest enters it (or opens any screen, for the stage they are in). Saved like any change. */
export function resetWelcomes(personaId: string | null): void {
  if (getWelcome(personaId) === EMPTY_WELCOME) return
  cache.set(keyFor(personaId), EMPTY_WELCOME)
  tell()
  sync.changed('stageWelcome', personaId)
}

/** Takes the server's copy (null: empty) without telling the sync module it changed. */
export function applyRemoteWelcome(personaId: string | null, raw: unknown): void {
  cache.set(keyFor(personaId), raw === null ? EMPTY_WELCOME : normalizeWelcome(raw))
  tell()
}

/** The server's answer for this person has arrived, whether or not it held a document. */
export function markWelcomeLoaded(personaId: string | null): void {
  if (loaded.has(keyFor(personaId))) return
  loaded.add(keyFor(personaId))
  tell()
}
