import { APP_PREFIX } from '../data/lifecycle'
import { EMPTY_SPLIT, normalizeSplit, type SplitState } from '../domain/ledgerSplit'
import { EMPTY_PORT_PARTY, normalizePortParty, type PortPartyState } from '../domain/portParty'

/** Everything Phase H3 keeps on this device for one booking: the port-day party state and the split ledger. Kept under the booker, so everyone on the booking sees the same record here, and (with the real API) saved as rows by `sync/portRows.ts`. */
export interface PortState { party: PortPartyState; split: SplitState }
export const EMPTY_PORT: PortState = { party: EMPTY_PORT_PARTY, split: EMPTY_SPLIT }

export const normalizePort = (raw: unknown): PortState => {
  if (typeof raw !== 'object' || raw === null) return EMPTY_PORT
  const r = raw as Record<string, unknown>
  return { party: normalizePortParty(r.party), split: normalizeSplit(r.split) }
}

export const portKeyFor = (bookerId: string | null): string => `${APP_PREFIX}port:${bookerId ?? ''}`

export function loadPort(bookerId: string | null, storage: Pick<Storage, 'getItem'> | null = safeStorage()): PortState {
  try {
    const text = storage?.getItem(portKeyFor(bookerId))
    return text ? normalizePort(JSON.parse(text)) : EMPTY_PORT
  } catch {
    return EMPTY_PORT
  }
}

export function savePort(bookerId: string | null, state: PortState, storage: Pick<Storage, 'setItem'> | null = safeStorage()): boolean {
  try {
    storage?.setItem(portKeyFor(bookerId), JSON.stringify(state))
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

const cache = new Map<string, PortState>()
const listeners = new Set<() => void>()

export function getPort(bookerId: string | null): PortState {
  const key = portKeyFor(bookerId)
  let s = cache.get(key)
  if (!s) { s = loadPort(bookerId); cache.set(key, s) }
  return s
}

export function subscribePort(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

type ChangeListener = (bookerId: string | null, prev: PortState, next: PortState) => void
const changeListeners = new Set<ChangeListener>()

/** Told of each change a person makes (never of one taken from the server), with the state before and after: the row sync turns it into row changes. */
export function onPortChanged(listener: ChangeListener): () => void {
  changeListeners.add(listener)
  return () => changeListeners.delete(listener)
}

export function updatePort(bookerId: string | null, change: (s: PortState) => PortState): void {
  const prev = getPort(bookerId)
  const next = change(prev)
  cache.set(portKeyFor(bookerId), next)
  savePort(bookerId, next)
  listeners.forEach((l) => l())
  if (next !== prev) changeListeners.forEach((l) => l(bookerId, prev, next))
}

/** Takes the server's rows without telling the row sync it changed. */
export function applyRemotePort(bookerId: string | null, next: PortState): void {
  cache.set(portKeyFor(bookerId), next)
  savePort(bookerId, next)
  listeners.forEach((l) => l())
}
