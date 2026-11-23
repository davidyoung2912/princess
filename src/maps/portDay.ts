import { distanceKm, nearestOrder, walkMinutes, type LatLng, type Pace } from './geo'

/**
 * The walking port-day planner (docs/mcp-integration-plan.md, phase 4): from the guide's places with a map point and the ship's own times, choose and order the
 * stops that fit between getting ashore and the back-on-board time. It uses no outside service. The return time comes only from the ship's published all-aboard
 * time (never from a place's data), and the plan keeps a buffer before it. Our data has no pier position, so the walk starts at the first stop and the return
 * walk is counted from the last stop back to it; the page says so.
 */
export interface Candidate { id: string; name: string; at: LatLng; tier: string; why?: string }

export interface PortDayInput {
  candidates: readonly Candidate[]
  /** Local port time the ship arrives and the time everyone must be aboard, "HH:MM". */
  arrive: string
  allAboard: string
  tender?: boolean
  pace?: Pace
  /** Time at each stop. */
  visitMinutes?: number
  /** A sit-down meal to fit in; 0 for none. */
  mealMinutes?: number
  maxStops?: number
}

export interface PlannedStop extends Candidate { arriveAt: string; leaveAt: string; walkFromPrevious: number }
export interface PortDayPlan {
  stops: PlannedStop[]
  /** Minutes between getting ashore and the buffer before all-aboard. */
  usable: number
  walking: number
  visiting: number
  meal: number
  /** Minutes left over after everything, the walk back included. */
  spare: number
  returnWalk: number
  /** When to start walking back to the ship. */
  headBackBy: string
  allAboard: string
  /** Why there is no plan, or null when there is one. */
  reason: null | 'noTime' | 'fewPlaces'
}

/** Minutes between getting off the ship's clock and stepping onto the quay: longer by tender. */
export const GET_ASHORE = { dock: 20, tender: 60 } as const
/** The margin kept before all-aboard. */
export const BUFFER = { dock: 60, tender: 90 } as const
export const DEFAULT_VISIT = 45
export const DEFAULT_MAX_STOPS = 6

export const toMinutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
export const clock = (minutes: number): string => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Walking places: a walk-off tier, or any place within 1.5 km of the first walk-off place. */
export function walkable(all: readonly Candidate[]): Candidate[] {
  const off = all.filter((c) => /^walk-off/i.test(c.tier))
  if (off.length === 0) return []
  const anchor = off[0].at
  return all.filter((c) => /^walk-off/i.test(c.tier) || distanceKm(anchor, c.at) <= 1.5)
}

export function planPortDay(input: PortDayInput): PortDayPlan {
  const kind = input.tender ? 'tender' : 'dock'
  const pace = input.pace ?? 'steady'
  const visit = input.visitMinutes ?? DEFAULT_VISIT
  const meal = Math.max(0, input.mealMinutes ?? 0)
  const arrive = toMinutes(input.arrive)
  const aboard = toMinutes(input.allAboard)
  const start = arrive + GET_ASHORE[kind]
  const usable = aboard - BUFFER[kind] - start
  const empty = (reason: PortDayPlan['reason']): PortDayPlan => ({ stops: [], usable: Math.max(0, usable), walking: 0, visiting: 0, meal: 0, spare: Math.max(0, usable), returnWalk: 0, headBackBy: clock(aboard - BUFFER[kind]), allAboard: input.allAboard, reason })
  if (usable < visit) return empty('noTime')
  const pool = walkable(input.candidates)
  if (pool.length < 2) return empty('fewPlaces')

  // Easiest first (the guide lists them in that order), then nearest to the first; add while the walk back still fits.
  const first = pool[0]
  const rest = pool.slice(1).sort((a, b) => distanceKm(first.at, a.at) - distanceKm(first.at, b.at))
  const chosen: Candidate[] = [first]
  const cost = (list: readonly Candidate[]) => {
    const order = nearestOrder(list.map((c) => c.at), null)
    const pts = order.map((i) => list[i].at)
    let walk = 0
    for (let i = 1; i < pts.length; i++) walk += walkMinutes(distanceKm(pts[i - 1], pts[i]), pace)
    const back = walkMinutes(distanceKm(pts[pts.length - 1], pts[0]), pace)
    return { order, walk, back, total: walk + back + list.length * visit + meal }
  }
  for (const c of rest) {
    if (chosen.length >= (input.maxStops ?? DEFAULT_MAX_STOPS)) break
    if (cost([...chosen, c]).total <= usable) chosen.push(c)
  }
  if (chosen.length < 2) return empty('fewPlaces')

  const final = cost(chosen)
  const stops: PlannedStop[] = []
  let t = start
  let prev: LatLng | null = null
  for (const i of final.order) {
    const c = chosen[i]
    const w = prev ? walkMinutes(distanceKm(prev, c.at), pace) : 0
    t += w
    stops.push({ ...c, arriveAt: clock(t), leaveAt: clock(t + visit), walkFromPrevious: w })
    t += visit
    prev = c.at
  }
  t += meal
  const spare = usable - final.total
  return { stops, usable, walking: final.walk + final.back, visiting: chosen.length * visit, meal, spare, returnWalk: final.back, headBackBy: clock(t), allAboard: input.allAboard, reason: null }
}
