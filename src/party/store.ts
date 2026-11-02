import { APP_PREFIX } from '../data/lifecycle'
import { sync } from '../sync'
import { EMPTY_PARTY, normalizePartyState, type PartyState } from '../domain/party'

/** Party invitations and shared notes stay on this device, one record per booking (kept under the booker, so everyone on the booking sees the same notes here). */
export const partyKeyFor = (bookerId: string | null): string => `${APP_PREFIX}party:${bookerId ?? ''}`

type Reader = Pick<Storage, 'getItem'>
type Writer = Pick<Storage, 'setItem'>

export function loadParty(bookerId: string | null, storage: Reader | null = safeStorage()): PartyState {
  try {
    const text = storage?.getItem(partyKeyFor(bookerId))
    return text ? normalizePartyState(JSON.parse(text)) : EMPTY_PARTY
  } catch {
    return EMPTY_PARTY
  }
}

export function saveParty(bookerId: string | null, state: PartyState, storage: Writer | null = safeStorage()): boolean {
  try {
    storage?.setItem(partyKeyFor(bookerId), JSON.stringify(state))
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

const cache = new Map<string, PartyState>()
const listeners = new Set<() => void>()

export function getParty(bookerId: string | null): PartyState {
  const key = partyKeyFor(bookerId)
  let s = cache.get(key)
  if (!s) { s = loadParty(bookerId); cache.set(key, s) }
  return s
}

export function subscribeParty(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function updateParty(bookerId: string | null, change: (s: PartyState) => PartyState): void {
  const next = change(getParty(bookerId))
  cache.set(partyKeyFor(bookerId), next)
  saveParty(bookerId, next)
  listeners.forEach((l) => l())
  sync.changed('party', bookerId)
}

/** Takes the server's copy without telling the sync module it changed. */
export function applyRemoteParty(bookerId: string | null, next: PartyState): void {
  cache.set(partyKeyFor(bookerId), next)
  saveParty(bookerId, next)
  listeners.forEach((l) => l())
}
