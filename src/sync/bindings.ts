import { applyRemoteThread, EMPTY_THREAD, getThread, mergeThreads, normalizeThread } from '../ai/history'
import { EMPTY_HOME } from '../domain/homeLink'
import { EMPTY_HUB, applyRemoteFamily, applyRemoteHub, getHub, hubRestOf, normalizeHub } from '../hub/store'
import { EMPTY_TRIP, applyRemoteTrip, getTrip, normalizeTrip } from '../journey/store'
import { EMPTY_CALM } from '../domain/calm'
import { EMPTY_PILOT, applyRemoteCalm, applyRemotePilot, getPilot, normalizePilot, pilotRestOf } from '../pilot/store'
import { EMPTY_PARTY, normalizePartyState } from '../domain/party'
import { applyRemoteParty, getParty } from '../party/store'
import { bookerOfPerson } from '../account/context'
import { mergeOffers, mergeParty } from './merges'
import { EMPTY_OFFER_STATE, normalizeOfferState } from '../domain/offers'
import { normalizeDone } from '../domain/phoneSetup'
import { EMPTY_EXTRAS, normalizeExtras } from '../domain/shopExtras'
import { applyRemoteHealth, applyRemoteMemoryRest, applyRemoteReminder, applyRemoteTravellers, cleanRest, EMPTY_MEMORY, getMemory, healthOf, reminderOf, restOf, travellersOf } from '../memory/store'
import { applyRemoteOffers, getOfferState } from '../offers/store'
import { applyRemotePhone, getPhone } from '../phone/store'
import { applySyncedSettings, getSettings, getSyncedSettings, syncedSettingsAreDefault } from '../settings/store'
import { applyRemoteShop, getExtras } from '../shop/store'
import { applyRemoteSharing, getSharing } from '../sharing/store'
import { NOTHING_SHARED, normalizeSharing } from '../domain/partyShare'
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
  merge: mergeOffers,
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
  read: (id) => restOf(getMemory(id)),
  apply: (id, raw) => applyRemoteMemoryRest(id, raw),
  isEmpty: (raw) => json(raw) === json(restOf(EMPTY_MEMORY)),
  clean: cleanRest,
  enabled: () => getSettings().syncPrivate,
}

/** Saved travellers (names, dates of birth, citizenship): their own document, encrypted on the server, and held back by the same consent switch. */
const travellers: Binding = {
  key: 'travellers',
  read: (id) => travellersOf(getMemory(id)),
  apply: (id, raw) => applyRemoteTravellers(id, raw),
  isEmpty: (raw) => (raw as { travellers: unknown[] }).travellers.length === 0,
  enabled: () => getSettings().syncPrivate,
}

/** "Remind me in a week": a date and a sailing id, in the clear, so the server can send one note when the time comes. Set only by the guest's own tap. */
const reminder: Binding = {
  key: 'reminder',
  read: (id) => reminderOf(getMemory(id)),
  apply: (id, raw) => applyRemoteReminder(id, raw),
  isEmpty: (raw) => json(raw) === '{}',
}

/** The medical card, access profile and allergy flag: their own document, encrypted on the server, and held back by the same consent switch. */
const health: Binding = {
  key: 'health',
  read: (id) => healthOf(getMemory(id)),
  apply: (id, raw) => applyRemoteHealth(id, raw),
  isEmpty: (raw) => json(raw) === json(healthOf(EMPTY_MEMORY)),
  enabled: () => getSettings().syncPrivate,
}

/** Door-to-ship plan, packing, bag log and embarkation plan. */
const trip: Binding = {
  key: 'trip',
  read: (id) => getTrip(id),
  apply: (id, raw) => applyRemoteTrip(id, raw === null ? EMPTY_TRIP : normalizeTrip(raw)),
  isEmpty: (raw) => json(raw) === json(EMPTY_TRIP),
}

/** Plan changes and their log, slot watches, week preferences. The calm profile is its own document (below). */
const pilot: Binding = {
  key: 'pilot',
  read: (id) => pilotRestOf(getPilot(id)),
  apply: (id, raw) => applyRemotePilot(id, { ...(raw === null ? EMPTY_PILOT : normalizePilot(raw)), calm: getPilot(id).calm }),
  isEmpty: (raw) => json(raw) === json(EMPTY_PILOT),
  clean: (raw) => (raw && typeof raw === 'object' ? { ...(raw as object), calm: EMPTY_CALM } : raw),
}

/** The sensory / calm profile. Held back until the guest agrees (Settings: syncPrivate): it can describe a person's needs. */
const calm: Binding = {
  key: 'calm',
  read: (id) => getPilot(id).calm,
  apply: (id, raw) => applyRemoteCalm(id, raw),
  isEmpty: (raw) => json(raw) === json(EMPTY_CALM),
  enabled: () => getSettings().syncPrivate,
}

/** Delay, callback request and follow-ups. The family-at-home page is its own document (below). */
const hub: Binding = {
  key: 'hub',
  read: (id) => hubRestOf(getHub(id)),
  apply: (id, raw) => applyRemoteHub(id, { ...(raw === null ? EMPTY_HUB : normalizeHub(raw)), home: getHub(id).home }),
  isEmpty: (raw) => json(raw) === json(EMPTY_HUB),
  clean: (raw) => (raw && typeof raw === 'object' ? { ...(raw as object), home: EMPTY_HOME } : raw),
}

/** Family contacts (names and email addresses), their links, postcards and the link secret. Held back until the guest agrees (Settings: syncPrivate). */
const family: Binding = {
  key: 'family',
  read: (id) => getHub(id).home,
  apply: (id, raw) => applyRemoteFamily(id, raw),
  isEmpty: (raw) => json(raw) === json(EMPTY_HOME),
  enabled: () => getSettings().syncPrivate,
}

/** A booking's stores are kept under its booker, so everyone on the booking reads and writes the same copy. */
const bookerOf = bookerOfPerson

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

/** What the guest shares with the rest of their party: four switches, all off by default. The server reads them to decide what other people on the booking may see, so this one is not held back by the private-notes consent. */
const sharing: Binding = {
  key: 'sharing',
  read: (id) => getSharing(id),
  apply: (id, raw) => applyRemoteSharing(id, raw === null ? NOTHING_SHARED : normalizeSharing(raw)),
  isEmpty: (raw) => json(raw) === json(NOTHING_SHARED),
}

/** The concierge conversation. Held back until the guest agrees (Settings: syncPrivate), like private notes: what they asked may say a lot about them. */
const concierge: Binding = {
  key: 'concierge',
  read: (id) => getThread(id),
  apply: (id, raw) => applyRemoteThread(id, raw === null ? EMPTY_THREAD : normalizeThread(raw)),
  isEmpty: (raw) => (raw as { messages: unknown[] }).messages.length === 0,
  merge: mergeThreads,
  enabled: () => getSettings().syncPrivate,
}

let registered = false
/** Connects the stores to the sync module. Safe to call more than once. */
export function registerSyncBindings(): void {
  if (registered) return
  registered = true
  for (const b of [settings, offers, shop, phone, memory, health, travellers, reminder, concierge, trip, pilot, calm, hub, family, party, sharing]) sync.register(b)
}
