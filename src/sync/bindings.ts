import { EMPTY_OFFER_STATE, normalizeOfferState } from '../domain/offers'
import { normalizeDone } from '../domain/phoneSetup'
import { EMPTY_EXTRAS, normalizeExtras } from '../domain/shopExtras'
import { applyRemoteOffers, getOfferState } from '../offers/store'
import { applyRemotePhone, getPhone } from '../phone/store'
import { applySyncedSettings, getSyncedSettings, syncedSettingsAreDefault } from '../settings/store'
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

let registered = false
/** Connects the stores to the sync module. Safe to call more than once. */
export function registerSyncBindings(): void {
  if (registered) return
  registered = true
  for (const b of [settings, offers, shop, phone]) sync.register(b)
}
