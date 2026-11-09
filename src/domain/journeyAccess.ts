import { hasAccessibleCabins } from './cabins'
import { EXCURSIONS } from './excursions'
import { difficultyOf } from './planning'
import { PORT_GUIDES } from './ports'
import { PORTS } from './sailings'
import { CATEGORIES, SHIP_ACCESSIBILITY } from './ship'

/**
 * One accessibility view across the whole journey (DRM-10, DSC-11): ship, cabin, port and excursion share one set of features and one
 * three-way answer. A detail nobody has stated is `unknown`, never quietly `yes` or `no`. Pure.
 */
export const FEATURES = ['stepFree', 'lift', 'wheelchair', 'restrooms', 'seating', 'noTender'] as const
export type Feature = (typeof FEATURES)[number]
export type Answer = 'yes' | 'no' | 'unknown'
export const AREAS = ['ship', 'cabin', 'port', 'excursion'] as const
export type JourneyArea = (typeof AREAS)[number]

export interface JourneyItem { id: string; area: JourneyArea; name: string; detail?: string; answers: Partial<Record<Feature, Answer>> }

export const answerOf = (item: JourneyItem, f: Feature): Answer => item.answers[f] ?? 'unknown'
const yn = (v: boolean): Answer => (v ? 'yes' : 'no')

/** Every ship, cabin, port and excursion row, from the same reference data the rest of the app uses. */
export function journeyItems(): JourneyItem[] {
  const says = (re: RegExp): boolean => SHIP_ACCESSIBILITY.some((l) => re.test(l))
  const items: JourneyItem[] = [
    { id: 'ship-lifts', area: 'ship', name: 'Elevators between decks', answers: { lift: says(/elevator|lift/i) ? 'yes' : 'unknown' } },
    { id: 'ship-seating', area: 'ship', name: 'Wheelchair seating in shows and dining rooms', answers: { wheelchair: says(/wheelchair-accessible seating/i) ? 'yes' : 'unknown', seating: says(/seating/i) ? 'yes' : 'unknown' } },
  ]
  for (const c of CATEGORIES) {
    const ok = yn(hasAccessibleCabins(c.id))
    items.push({ id: `cabin-${c.id}`, area: 'cabin', name: c.name, answers: { stepFree: ok, wheelchair: ok } })
  }
  for (const g of Object.values(PORT_GUIDES)) {
    items.push({ id: `port-${g.id}`, area: 'port', name: g.short, detail: g.access, answers: { noTender: yn(g.landing === 'pier') } })
  }
  for (const x of EXCURSIONS) {
    const d = difficultyOf(x.id)
    items.push({
      id: `exc-${x.id}`, area: 'excursion', name: x.name, detail: PORTS[x.port]?.name.split(',')[0],
      answers: { wheelchair: yn(x.wheelchair), stepFree: d ? yn(!d.steps) : 'unknown', restrooms: d ? yn(d.restrooms) : 'unknown', seating: d ? yn(d.seats) : 'unknown' },
    })
  }
  return items
}

/** Rows that could work for the chosen features: any "no" drops a row, an "unknown" keeps it (and is shown as unknown). With none chosen, everything stays. */
export const filterJourney = (items: readonly JourneyItem[], required: readonly Feature[]): JourneyItem[] =>
  items.filter((i) => required.every((f) => answerOf(i, f) !== 'no'))

export interface AreaSummary { area: JourneyArea; total: number; yes: number; unknown: number; no: number }

/** The whole-journey comparison: for each area, how many rows meet every chosen feature, how many are unknown, how many do not. */
export function journeySummary(items: readonly JourneyItem[], required: readonly Feature[]): AreaSummary[] {
  return AREAS.map((area) => {
    const rows = items.filter((i) => i.area === area)
    const s: AreaSummary = { area, total: rows.length, yes: 0, unknown: 0, no: 0 }
    for (const r of rows) {
      const a = required.map((f) => answerOf(r, f))
      if (a.includes('no')) s.no++
      else if (a.includes('unknown')) s.unknown++
      else s.yes++
    }
    return s
  })
}
