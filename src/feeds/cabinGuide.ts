import type { Cabin, Position, Side } from '../domain/cabins'
import type { CabinFilter, CabinScore, SunSummary } from '../domain/cabinScore'
import { CATEGORIES, type CategoryId } from '../domain/ship'
import { createFeed, isInt, isRecord, oneOf } from './feed'

const POSITIONS: readonly Position[] = ['forward', 'midship', 'aft']
const SIDES: readonly Side[] = ['port', 'starboard']
const LABELS = ['morning', 'afternoon', 'both', 'shaded'] as const

const strings = (v: unknown, max: number): string[] | null =>
  Array.isArray(v) && v.length <= max && v.every((x) => typeof x === 'string' && x.length > 0 && x.length < 300) ? (v as string[]) : null

function normalizeSun(raw: unknown): SunSummary | null | undefined {
  if (raw === null) return null
  if (!isRecord(raw) || !isInt(raw.mornings, 0, 8) || !isInt(raw.afternoons, 0, 8) || !isInt(raw.portAfternoons, 0, 8) || !oneOf(raw.label, LABELS) || typeof raw.text !== 'string') return undefined
  return { mornings: raw.mornings, afternoons: raw.afternoons, portAfternoons: raw.portAfternoons, label: raw.label, text: raw.text.slice(0, 300) }
}

/** Reads the server's scored cabins for a room type: every score a whole number from 1 to 5 with its reasons. Anything wrong gives null. */
export function normalizeCabinGuide(raw: unknown): CabinScore[] | null {
  const rows = isRecord(raw) ? raw.cabins : null
  if (!Array.isArray(rows) || rows.length > 40) return null
  const out: CabinScore[] = []
  for (const r of rows) {
    if (!isRecord(r) || !isRecord(r.cabin) || !isRecord(r.reasons)) return null
    const c = r.cabin
    const notes = strings(c.notes, 8)
    const reasonsSleep = strings(r.reasons.sleep, 6)
    const reasonsMotion = strings(r.reasons.motion, 6)
    const reasonsNoise = strings(r.reasons.noise, 6)
    const warnings = strings(r.warnings, 6)
    const sun = normalizeSun(r.sun)
    const category = CATEGORIES.find((x) => x.id === r.category)?.id as CategoryId | undefined
    if (typeof c.number !== 'string' || !isInt(c.deck, 1, 20) || !oneOf(c.position, POSITIONS) || !oneOf(c.side, SIDES) || !notes || typeof c.obstructed !== 'boolean' || typeof c.accessible !== 'boolean' || typeof c.available !== 'boolean') return null
    if (!category || !isInt(r.sleep, 1, 5) || !isInt(r.motion, 1, 5) || !isInt(r.noise, 1, 5) || !reasonsSleep || !reasonsMotion || !reasonsNoise || !warnings || sun === undefined) return null
    const cabin: Cabin = { number: c.number, deck: c.deck, position: c.position, side: c.side, notes, obstructed: c.obstructed, accessible: c.accessible, available: c.available }
    out.push({ cabin, category, sleep: r.sleep, motion: r.motion, noise: r.noise, reasons: { sleep: reasonsSleep, motion: reasonsMotion, noise: reasonsNoise }, sun, warnings })
  }
  return out
}

/** The scored cabins of a room type on a sailing, for a set of filters. */
export const cabinGuideFeed = createFeed<[sailingId: string, category: CategoryId, filter: CabinFilter], CabinScore[]>(
  (s, c, f) => `${s}|${c}|${f.quiet}|${f.calmSea}|${f.accessible}|${f.clearView}|${f.availableOnly}`,
  normalizeCabinGuide,
)
