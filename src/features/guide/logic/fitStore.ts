import { sync } from '../../../shared/sync'
import { answerFit, answerOne, EMPTY_FIT, normalizeFit, type FitKey, type GuideFit } from './fit'

/** The guest's "make this plan fit me" answers, in memory only: the server's copy is the real one and the sync module pulls it at sign-in. */
const keyFor = (personaId: string | null): string => personaId ?? ''

const cache = new Map<string, GuideFit>()
const listeners = new Set<() => void>()
const tell = (): void => listeners.forEach((l) => l())

export const getFit = (personaId: string | null): GuideFit => cache.get(keyFor(personaId)) ?? EMPTY_FIT

export function subscribeFit(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Saves the three answers and tells the sync module. */
export function saveFit(personaId: string | null, answers: { firstCruise: boolean; solo: boolean; quiet: boolean }, now: number): void {
  cache.set(keyFor(personaId), answerFit(answers, now))
  tell()
  sync.changed('guideFit', personaId)
}

/** Saves one answer, keeping the rest, and tells the sync module. */
export function saveOneFit(personaId: string | null, key: FitKey, value: boolean, now: number): void {
  cache.set(keyFor(personaId), answerOne(getFit(personaId), key, value, now))
  tell()
  sync.changed('guideFit', personaId)
}

/** Takes the server's copy (null: empty) without telling the sync module it changed. */
export function applyRemoteFit(personaId: string | null, raw: unknown): void {
  cache.set(keyFor(personaId), raw === null ? EMPTY_FIT : normalizeFit(raw))
  tell()
}
