import { EMPTY_HUB, applyRemoteHub, getHub, normalizeHub } from '../hub/store'
import { EMPTY_TRIP, applyRemoteTrip, getTrip, normalizeTrip } from '../journey/store'
import { EMPTY_PILOT, applyRemotePilot, getPilot, normalizePilot } from '../pilot/store'
import { EMPTY_PORT, applyRemotePort, getPort, normalizePort } from '../port/store'
import { EMPTY_PARTY, normalizePartyState } from '../domain/party'
import { applyRemoteParty, getParty } from '../party/store'
import { personaById } from '../domain/personas'
import { mergeParty, mergePort } from './merges'
import { EMPTY_OFFER_STATE, normalizeOfferState } from '../domain/offers'
import { normalizeDone } from '../domain/phoneSetup'
import { EMPTY_EXTRAS, normalizeExtras } from '../domain/shopExtras'
import { applyRemoteMemory, getMemory, normalizeMemory, EMPTY_MEMORY } from '../memory/store'
import { applyRemoteOffers, getOfferState } from '../offers/store'
import { applyRemotePhone, getPhone } from '../phone/store'
import { applySyncedSettings, getSettings, getSyncedSettings, syncedSettingsAreDefault } from '../settings/store'
import { applyRemoteShop, getExtras } from '../shop/store'
import { sync } from './index'
import type { Binding } from './sync'

const json = (v: unknown): string => JSON.stringify(v)

const settings: Binding = {
  key: 'settings',
  read: () => getSyncedSettings(),
  apply: (_id, raw) => applySyncedSettings(raw),
  isEmpty: () => syncedSettingsAreDefault(),
}

const offers: Binding = {
  key: 'offers',
  read: (id) => getOfferState(id),
  apply: (id, raw) => applyRemoteOffers(id, raw === null ? EMPTY_OFFER_STATE : normalizeOfferState(raw)),
  isEmpty: (raw) => json(raw) === json(EMPTY_OFFER_STATE),
}

const shop: Binding = {
  key: 'shop',
  read: (id) => getExtras(id),
  apply: (id, raw) => applyRemoteShop(id, raw === null ? EMPTY_EXTRAS : normalizeExtras(raw)),
  isEmpty: (raw) => json(raw) === json(EMPTY_EXTRAS),
}

/** The phone steps are a list; the server keeps documents that are objects. */
const phone: Binding = {
  key: 'phone',
  read: (id) => ({ done: getPhone(id) }),
  apply: (id, raw) => applyRemotePhone(id, raw === null ? [] : normalizeDone((raw as { done?: unknown }).done)),
  isEmpty: (raw) => ((raw as { done: unknown[] }).done).length === 0,
}

/**
 * Health details and private notes. Held back until the guest agrees (Settings: syncPrivate); the whole document is one key, so when it is off
 * nothing from it reaches the server, and switching it off deletes the server's copy.
 */
const memory: Binding = {
  key: 'memory',
  read: (id) => getMemory(id),
  apply: (id, raw) => applyRemoteMemory(id, raw === null ? EMPTY_MEMORY : normalizeMemory(raw)),
  isEmpty: (raw) => json(raw) === json(EMPTY_MEMORY),
  enabled: () => getSettings().syncPrivate,
}

/** Door-to-ship plan, packing, bag log and embarkation plan. */
const trip: Binding = {
  key: 'trip',
  read: (id) => getTrip(id),
  apply: (id, raw) => applyRemoteTrip(id, raw === null ? EMPTY_TRIP : normalizeTrip(raw)),
  isEmpty: (raw) => json(raw) === json(EMPTY_TRIP),
}

/** Plan changes and their log, slot watches, week preferences, the calm profile. */
const pilot: Binding = {
  key: 'pilot',
  read: (id) => getPilot(id),
  apply: (id, raw) => applyRemotePilot(id, raw === null ? EMPTY_PILOT : normalizePilot(raw)),
  isEmpty: (raw) => json(raw) === json(EMPTY_PILOT),
}

/** Family contacts, delay, callback request and follow-ups. */
const hub: Binding = {
  key: 'hub',
  read: (id) => getHub(id),
  apply: (id, raw) => applyRemoteHub(id, raw === null ? EMPTY_HUB : normalizeHub(raw)),
  isEmpty: (raw) => json(raw) === json(EMPTY_HUB),
}

/** A booking's stores are kept under its booker, so everyone on the booking reads and writes the same copy. */
const bookerOf = (id: string | null): string | null => (id === null ? null : personaById(id)?.booker ?? id)

/** Port-day presence, plan, meeting places and the split ledger: one document for the whole booking. */
const port: Binding = {
  key: 'port',
  scope: 'booking',
  localFor: bookerOf,
  read: (id) => getPort(id),
  apply: (id, raw) => applyRemotePort(id, raw === null ? EMPTY_PORT : normalizePort(raw)),
  isEmpty: (raw) => json(raw) === json(EMPTY_PORT),
  merge: mergePort,
}

/** Travel-party invitations and shared notes: one document for the whole booking. */
const party: Binding = {
  key: 'party',
  scope: 'booking',
  localFor: bookerOf,
  read: (id) => getParty(id),
  apply: (id, raw) => applyRemoteParty(id, raw === null ? EMPTY_PARTY : normalizePartyState(raw)),
  isEmpty: (raw) => json(raw) === json(EMPTY_PARTY),
  merge: mergeParty,
}

let registered = false
/** Connects the stores to the sync module. Safe to call more than once. */
export function registerSyncBindings(): void {
  if (registered) return
  registered = true
  for (const b of [settings, offers, shop, phone, memory, trip, pilot, hub, port, party]) sync.register(b)
}
