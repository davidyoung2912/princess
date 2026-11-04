import { replaceDeck, type ElevatorBank, type MusterStation, type Place } from './deck'
import { notifyCatalogue } from './catalogueServed'
import { list, place, bank, station } from './shipServed'

/**
 * The deck plan of each ship at `aboard` depth, as the server serves it (`GET /reference/ships/{id}/aboard`). The screens read one deck plan (`PLACES`, `ELEVATORS`,
 * `MUSTER_STATIONS` in `deck.ts`); `activateDeck` puts the plan of the sailing's ship in those, so they follow the ship the guest sails on. The plans are kept for the session
 * (and on the device by the runtime's loader). Pure apart from the swap and the change notice.
 */
export interface AboardPlan {
  version: string
  shipId: string
  accessibility: readonly string[]
  places: Place[]
  elevators: ElevatorBank[]
  muster: MusterStation[]
}

const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Reads the server's answer, all or nothing: a malformed entry, a place id used twice, a muster station at an unknown place or a missing part gives null. */
export function normalizeAboardPlan(raw: unknown): AboardPlan | null {
  if (!rec(raw) || typeof raw.version !== 'string' || raw.version.length === 0 || typeof raw.shipId !== 'string' || raw.shipId.length === 0) return null
  const places = list(raw.places, place)
  const elevators = list(raw.elevators, bank)
  const muster = list(raw.muster, station)
  const accessibility = list(raw.accessibility, (x) => (typeof x === 'string' && x.length > 0 && x.length <= 600 ? x : null))
  if (!places || !elevators || !muster || !accessibility || places.length === 0 || elevators.length === 0 || muster.length === 0) return null
  if (new Set(places.map((p) => p.id)).size !== places.length || new Set(muster.map((m) => m.letter)).size !== muster.length) return null
  const ids = new Set(places.map((p) => p.id))
  if (!muster.every((m) => ids.has(m.placeId))) return null
  return { version: raw.version, shipId: raw.shipId, accessibility, places, elevators, muster }
}

const PLANS = new Map<string, AboardPlan>()
/** The ship whose plan is in use; empty until a screen chooses one, when the first plan kept is used (Sun Princess's, from the reference table). */
let active = ''

export const planOf = (shipId: string): AboardPlan | undefined => PLANS.get(shipId)
export const activeShip = (): string => active

/** Keeps a plan; if it is the one in use (or nothing was chosen yet) it is put in use at once. */
export function keepPlan(plan: AboardPlan): void {
  PLANS.set(plan.shipId, plan)
  if (active === '' || active === plan.shipId) { replaceDeck(plan); if (active === '') active = plan.shipId }
}

/** Puts a ship's plan in use for the screens. False when that ship's plan has not been loaded (the one in use stays). */
export function activateDeck(shipId: string): boolean {
  const plan = PLANS.get(shipId)
  if (!plan) return false
  if (active === shipId) return true
  active = shipId
  replaceDeck(plan)
  notifyCatalogue()
  return true
}

type Loader = (shipId: string) => Promise<unknown>
let loader: Loader | null = null
const inFlight = new Map<string, Promise<boolean>>()

/** What fetches a ship's plan (the runtime sets it); without one nothing is loaded. */
export function setPlanLoader(next: Loader | null): void { loader = next }

/** Asks for a ship's plan unless it is already kept. True when the plan is kept afterwards. */
export function loadAboardPlan(shipId: string): Promise<boolean> {
  if (PLANS.has(shipId)) return Promise.resolve(true)
  const running = inFlight.get(shipId)
  if (running) return running
  if (!loader) return Promise.resolve(false)
  const p = loader(shipId)
    .then((raw) => {
      const plan = normalizeAboardPlan(raw)
      if (!plan || plan.shipId !== shipId) return false
      keepPlan(plan)
      return true
    })
    .catch(() => false)
    .finally(() => { inFlight.delete(shipId) })
  inFlight.set(shipId, p)
  return p
}

/** Forgets every kept plan (tests). */
export function clearPlans(): void { PLANS.clear(); inFlight.clear(); active = '' }
