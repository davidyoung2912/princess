import { APP_PREFIX } from '../data/lifecycle'
import { EMPTY_OFFER_STATE, normalizeOfferState, type OfferState } from '../domain/offers'

/** Offer choices stay on this device, one record per signed-in person (their dismissals and the marketing messages sent). */
export const offerKeyFor = (personaId: string | null): string => `${APP_PREFIX}offers:${personaId ?? ''}`

type Reader = Pick<Storage, 'getItem'>
type Writer = Pick<Storage, 'setItem'>

export function loadOfferState(personaId: string | null, storage: Reader | null = safeStorage()): OfferState {
  try {
    const text = storage?.getItem(offerKeyFor(personaId))
    return text ? normalizeOfferState(JSON.parse(text)) : EMPTY_OFFER_STATE
  } catch {
    return EMPTY_OFFER_STATE
  }
}

export function saveOfferState(personaId: string | null, state: OfferState, storage: Writer | null = safeStorage()): boolean {
  try {
    storage?.setItem(offerKeyFor(personaId), JSON.stringify(state))
    return !!storage
  } catch {
    return false
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const cache = new Map<string, OfferState>()
const listeners = new Set<() => void>()

export function getOfferState(personaId: string | null): OfferState {
  const key = offerKeyFor(personaId)
  let s = cache.get(key)
  if (!s) { s = loadOfferState(personaId); cache.set(key, s) }
  return s
}

export function subscribeOffers(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Changes a person's offer state, saves it and tells subscribers. */
export function updateOfferState(personaId: string | null, change: (s: OfferState) => OfferState): void {
  const next = change(getOfferState(personaId))
  cache.set(offerKeyFor(personaId), next)
  saveOfferState(personaId, next)
  listeners.forEach((l) => l())
}
