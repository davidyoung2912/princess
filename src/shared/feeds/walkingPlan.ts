import type { PortDayPlan } from '../../features/maps/logic/portDay'
import { createFeed } from './feed'

const hhmm = (v: unknown): v is string => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v)
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 100_000

/** Reads the server's walking plan; anything wrong in it gives null so the page falls back to its own plan. */
export function normalizeWalkingPlan(raw: unknown): PortDayPlan | null {
  const plan = raw && typeof raw === 'object' ? (raw as { plan?: unknown }).plan : null
  if (!plan || typeof plan !== 'object') return null
  const p = plan as Record<string, unknown>
  if (!Array.isArray(p.stops) || !whole(p.usable) || !whole(p.walking) || !whole(p.visiting) || !whole(p.meal) || !whole(p.spare) || !whole(p.returnWalk) || !hhmm(p.headBackBy) || !hhmm(p.allAboard)) return null
  if (p.reason !== null && p.reason !== 'noTime' && p.reason !== 'fewPlaces') return null
  const stops: PortDayPlan['stops'] = []
  for (const s of p.stops.slice(0, 12) as Record<string, unknown>[]) {
    if (!s || typeof s.name !== 'string' || typeof s.tier !== 'string' || typeof s.lat !== 'number' || typeof s.lng !== 'number' || !hhmm(s.arriveAt) || !hhmm(s.leaveAt) || !whole(s.walkFromPrevious)) return null
    if (Math.abs(s.lat) > 90 || Math.abs(s.lng) > 180) return null
    stops.push({ id: s.name, name: s.name, at: { lat: s.lat, lng: s.lng }, tier: s.tier, arriveAt: s.arriveAt, leaveAt: s.leaveAt, walkFromPrevious: s.walkFromPrevious })
  }
  return { stops, usable: p.usable, walking: p.walking, visiting: p.visiting, meal: p.meal, spare: p.spare, returnWalk: p.returnWalk, headBackBy: p.headBackBy, allAboard: p.allAboard, reason: p.reason }
}

/** The walking plan for a port day from the server (`port`, `arrive`, `allAboard`, `tender`, `pace`, `meal`); the same rules as the page's own planner. */
export const walkingPlanFeed = createFeed<[port: string, arrive: string, allAboard: string, tender: boolean, pace: string, meal: boolean], PortDayPlan>(
  (...a) => a.join('|'), normalizeWalkingPlan, 'walkingPlan')
