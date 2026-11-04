import { notifyCatalogue } from './catalogueServed'
import { categoryFromRoom, registerCategories } from './ship'

/**
 * The stateroom types of a ship, as the server serves them: a sailing's rooms with sample fares (`GET /reference/sailings/{id}/rooms`, open for booking or not)
 * and a ship's rooms without fares (the `categories` of `GET /reference/catalogue/ships/{id}`). Loaded when a screen asks, kept for the session. The older
 * Sun Princess sailings keep the app's own six room types (`ship.ts`); this is for every other ship. Pure apart from the swap and the change notice.
 */
export interface Room {
  id: string
  name: string
  suite: boolean
  capacity: number
  sizeSqFt: number
  description: string
  /** Fare per person per night for two sharing, in cents (a sailing's rooms only). */
  perNight?: number
  /** Fare per person for two sharing for the whole sailing, in cents, before taxes (a sailing's rooms only). */
  fare?: number
}

type Rec = Record<string, unknown>
const rec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max = 1200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const num = (v: unknown, min: number, max = 100_000_000): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max

function room(r: unknown, priced: boolean): Room | null {
  if (!rec(r) || !str(r.id, 40) || !str(r.name, 80) || typeof r.suite !== 'boolean' || !num(r.capacity, 1, 12) || !num(r.sizeSqFt, 0, 10_000)) return null
  const out: Room = { id: r.id, name: r.name, suite: r.suite, capacity: r.capacity, sizeSqFt: r.sizeSqFt, description: typeof r.description === 'string' ? r.description.slice(0, 1000) : '' }
  if (priced) {
    if (!num(r.perNight, 1) || !num(r.fare, 1)) return null
    out.perNight = r.perNight
    out.fare = r.fare
  }
  return out
}

function list(raw: unknown, priced: boolean): Room[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 40) return null
  const rooms = raw.map((r) => room(r, priced))
  if (rooms.some((r) => r === null)) return null
  const all = rooms as Room[]
  return new Set(all.map((r) => r.id)).size === all.length ? all : null
}

/** A sailing's rooms with sample fares; all or nothing. */
export const normalizeSailingRooms = (raw: unknown): Room[] | null => list(raw, true)

/** A ship's rooms from its detail answer; all or nothing. */
export const normalizeShipRooms = (raw: unknown): Room[] | null => (rec(raw) ? list(raw.categories, false) : null)

const SAILING_ROOMS = new Map<string, Room[]>()
const SHIP_ROOMS = new Map<string, Room[]>()
export const sailingRooms = (sailingId: string): readonly Room[] | undefined => SAILING_ROOMS.get(sailingId)
export const shipRooms = (shipId: string): readonly Room[] | undefined => SHIP_ROOMS.get(shipId)

type Loader = (id: string) => Promise<unknown>
let sailingLoader: Loader | null = null
let shipLoader: Loader | null = null
const inFlight = new Map<string, Promise<boolean>>()

/** What fetches the rooms (the runtime sets them); without one nothing is loaded. */
export function setRoomLoaders(next: { sailing: Loader | null; ship: Loader | null }): void { sailingLoader = next.sailing; shipLoader = next.ship }

function load(kind: 'sailing' | 'ship', id: string): Promise<boolean> {
  const store = kind === 'sailing' ? SAILING_ROOMS : SHIP_ROOMS
  if (store.has(id)) return Promise.resolve(true)
  const key = `${kind}:${id}`
  const running = inFlight.get(key)
  if (running) return running
  const fetcher = kind === 'sailing' ? sailingLoader : shipLoader
  if (!fetcher) return Promise.resolve(false)
  const p = fetcher(id)
    .then((raw) => {
      const got = kind === 'sailing' ? normalizeSailingRooms(raw) : normalizeShipRooms(raw)
      if (!got) return false
      store.set(id, got)
      registerCategories(got.flatMap((r) => categoryFromRoom(r) ?? []))
      notifyCatalogue()
      return true
    })
    .catch(() => false)
    .finally(() => { inFlight.delete(key) })
  inFlight.set(key, p)
  return p
}

export const loadSailingRooms = (sailingId: string): Promise<boolean> => load('sailing', sailingId)
export const loadShipRooms = (shipId: string): Promise<boolean> => load('ship', shipId)

/** Forgets what was loaded (tests, and a new sign-in). */
export function clearRooms(): void { SAILING_ROOMS.clear(); SHIP_ROOMS.clear() }
