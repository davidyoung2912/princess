import { replaceVenues, type Venue } from './dining'
import { setContent } from './content'
import { notifyCatalogue, onServedApplied, venue } from './catalogueServed'
import './menus'
import './orders'

/**
 * The dining of each ship at `aboard` depth, as the server serves it (`GET /reference/ships/{id}/venues`): the rooms, the directory with dishes tagged for allergens
 * and diets, the room-service menu and the places the crew deliver to. The screens read one set (`VENUES`, `DIRECTORY`, `MENU`, `DELIVERY_ZONES`); `activateVenues` puts the
 * set of the sailing's ship in those, so reservations, menus, allergy matching and room service follow the ship the guest sails on. Kept for the session (and on the device by
 * the runtime's loader). Pure apart from the swap and the change notice.
 */
export interface ShipVenues {
  version: string
  shipId: string
  venues: Venue[]
  directory: unknown[]
  menu: unknown[]
  deliveryZones: string[]
}

const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const withIds = (v: unknown): v is unknown[] => Array.isArray(v) && v.length > 0 && v.every((x) => rec(x) && typeof x.id === 'string' && x.id.length > 0)

/** Reads the server's answer, all or nothing: a malformed room, a directory or menu entry with no id, an empty list or a missing part gives null. */
export function normalizeShipVenues(raw: unknown): ShipVenues | null {
  if (!rec(raw) || typeof raw.version !== 'string' || raw.version.length === 0 || typeof raw.shipId !== 'string' || raw.shipId.length === 0) return null
  if (!Array.isArray(raw.venues) || raw.venues.length === 0 || !withIds(raw.directory) || !withIds(raw.menu)) return null
  const venues = raw.venues.map(venue)
  if (venues.some((v) => v === null)) return null
  if (!Array.isArray(raw.deliveryZones) || raw.deliveryZones.length === 0 || !raw.deliveryZones.every((z) => typeof z === 'string' && z.length > 0)) return null
  return { version: raw.version, shipId: raw.shipId, venues: venues as Venue[], directory: raw.directory, menu: raw.menu, deliveryZones: raw.deliveryZones as string[] }
}

const KEPT = new Map<string, ShipVenues>()
/** The ship whose dining is in use; empty until a screen chooses one (Sun Princess's authored and served lists show meanwhile). */
let active = ''

export const venuesOf = (shipId: string): ShipVenues | undefined => KEPT.get(shipId)
export const activeVenueShip = (): string => active

function put(v: ShipVenues): void {
  replaceVenues(v.venues)
  setContent({ 'menus.DIRECTORY': v.directory, 'orders.MENU': v.menu, 'orders.DELIVERY_ZONES': v.deliveryZones })
}

/** Keeps a ship's dining; if it is the one in use it is put in use at once. */
export function keepVenues(v: ShipVenues): void {
  KEPT.set(v.shipId, v)
  if (active === v.shipId) put(v)
}

/** Puts a ship's dining in use for the screens. False when that ship's has not been loaded (the one in use stays). */
export function activateVenues(shipId: string): boolean {
  const v = KEPT.get(shipId)
  if (!v) return false
  if (active === shipId) return true
  active = shipId
  put(v)
  notifyCatalogue()
  return true
}

// The Sun Princess lists arrive with the catalogue and the content; when another ship is in use they must not stay over its own.
onServedApplied(() => { const v = KEPT.get(active); if (v) put(v) })

type Loader = (shipId: string) => Promise<unknown>
let loader: Loader | null = null
const inFlight = new Map<string, Promise<boolean>>()

/** What fetches a ship's dining (the runtime sets it); without one nothing is loaded. */
export function setVenueLoader(next: Loader | null): void { loader = next }

/** Asks for a ship's dining unless it is already kept. True when it is kept afterwards. */
export function loadShipVenues(shipId: string): Promise<boolean> {
  if (KEPT.has(shipId)) return Promise.resolve(true)
  const running = inFlight.get(shipId)
  if (running) return running
  if (!loader) return Promise.resolve(false)
  const p = loader(shipId)
    .then((raw) => {
      const v = normalizeShipVenues(raw)
      if (!v || v.shipId !== shipId) return false
      keepVenues(v)
      return true
    })
    .catch(() => false)
    .finally(() => { inFlight.delete(shipId) })
  inFlight.set(shipId, p)
  return p
}

/** Forgets every kept set (tests). */
export function clearVenues(): void { KEPT.clear(); inFlight.clear(); active = '' }
