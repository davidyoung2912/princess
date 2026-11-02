import { PLACES, placeById, type Place } from './deck'
import { wayBetween } from './deckGraph'
import { walkMinutes } from './discoverDelights'
import { VENUES } from './dining'
import type { PlanEntry } from './plan'

/**
 * Small delights, phase DL4 (docs/small-delights.md): plan polish. Pure helpers for the rest block, walks between bookings, sunrise and sunset
 * places, private notes, a colour per traveller, birthdays during the trip and uneven pay-your-share sliders. State is kept on this device.
 */

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const rec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {})

export const NOTE_MAX = 120
export const NOTES_MAX = 60
export const OCCASIONS_MAX = 12
export const OCCASION_LABEL_MAX = 40

export interface Occasion { id: string; label: string; /** "YYYY-MM-DD" in the year of the trip. */ date: string; surprise: boolean }

export interface PolishState {
  /** Days (1 to 8) the guest set aside to do nothing. */
  rest: number[]
  /** A private note per booking id. */
  notes: Record<string, string>
  /** Chosen colour index per traveller id. */
  colours: Record<string, number>
  occasions: Occasion[]
}
export const EMPTY_POLISH: PolishState = { rest: [], notes: {}, colours: {}, occasions: [] }

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function normalizePolish(raw: unknown): PolishState {
  const r = rec(raw)
  const rest = [...new Set((Array.isArray(r.rest) ? r.rest : []).filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 8))].sort((a, b) => a - b)
  const notes: Record<string, string> = {}
  for (const [k, v] of Object.entries(rec(r.notes)).slice(0, NOTES_MAX)) { const n = clean(v, NOTE_MAX); if (n && k.length <= 80) notes[k] = n }
  const colours: Record<string, number> = {}
  for (const [k, v] of Object.entries(rec(r.colours)).slice(0, 20)) if (Number.isInteger(v) && (v as number) >= 0 && (v as number) < TRAVELLER_COLOURS.length) colours[k] = v as number
  const occasions = (Array.isArray(r.occasions) ? r.occasions : []).flatMap((x): Occasion[] => {
    const o = rec(x)
    const label = clean(o.label, OCCASION_LABEL_MAX)
    return typeof o.id === 'string' && label && typeof o.date === 'string' && DATE.test(o.date) ? [{ id: o.id, label, date: o.date, surprise: o.surprise === true }] : []
  }).slice(0, OCCASIONS_MAX)
  return { rest, notes, colours, occasions }
}

// ---------------------------------------------------------------- D4-1: a rest block

export const toggleRest = (rest: readonly number[], day: number): number[] => (rest.includes(day) ? rest.filter((d) => d !== day) : [...rest, day].sort((a, b) => a - b))

// ---------------------------------------------------------------- D4-2: the walk between bookings

export interface PlanWalk { fromName: string; toName: string; minutes: number; decks: number; lift: boolean }

/** Where an entry happens on the ship: tours, sail-away and all-aboard start and end at the gangway; a dinner is at its room. */
export function placeForEntry(e: Pick<PlanEntry, 'kind' | 'name'>): Place | undefined {
  if (e.kind === 'dinner') {
    const v = VENUES.find((x) => x.name === e.name)
    return (v && placeById(v.id)) || PLACES.find((p) => p.name === e.name || p.name.startsWith(e.name))
  }
  return placeById('landing')
}

/** The walks between neighbouring entries on a day, in order. Entries at the same place, or at places not on the plan, give no walk. */
export function walksBetween(entries: readonly Pick<PlanEntry, 'kind' | 'name' | 'time'>[]): (PlanWalk | null)[] {
  return entries.slice(1).map((b, i) => {
    const from = placeForEntry(entries[i])
    const to = placeForEntry(b)
    if (!from || !to || from.id === to.id) return null
    const minutes = walkMinutes(from, to)
    if (minutes === null) return null
    const way = wayBetween(from, to)
    return { fromName: from.name, toName: to.name, minutes, decks: Math.abs(from.deck - to.deck), lift: !!way?.some((w) => w.kind === 'lift') }
  })
}

// ---------------------------------------------------------------- D4-4: where to watch the sun

/** The best open place to watch a sunrise (forward, step-free) or a sunset (aft on the promenade, step-free). */
export const watchPlace = (kind: 'sunrise' | 'sunset'): Place => placeById(kind === 'sunrise' ? 'sea-view' : 'promenade')!

// ---------------------------------------------------------------- D4-5: a note on a booking

export function setNote(notes: Readonly<Record<string, string>>, id: string, text: string): Record<string, string> {
  const n = clean(text, NOTE_MAX)
  const { [id]: _drop, ...rest } = notes
  return n ? { ...rest, [id]: n } : rest
}

// ---------------------------------------------------------------- D4-6: a colour per traveller

/** Colours that read on white and on dark, each with a name so colour is never the only cue. */
export const TRAVELLER_COLOURS: readonly { name: string; hex: string }[] = [
  { name: 'Blue', hex: '#1f5fbf' },
  { name: 'Orange', hex: '#b8530a' },
  { name: 'Green', hex: '#1f7a3d' },
  { name: 'Purple', hex: '#7a3fa0' },
  { name: 'Teal', hex: '#0d7377' },
  { name: 'Pink', hex: '#b23a6e' },
]

/** A traveller's colour: their choice, or the first colour not taken by an earlier traveller. */
export function colourFor(id: string, travellers: readonly string[], chosen: Readonly<Record<string, number>>): number {
  if (id in chosen) return chosen[id]
  const taken = new Set(travellers.filter((x) => x !== id && x in chosen).map((x) => chosen[x]))
  const order = travellers.filter((x) => !(x in chosen))
  const free = TRAVELLER_COLOURS.map((_, i) => i).filter((i) => !taken.has(i))
  const at = order.indexOf(id)
  return (free.length > 0 ? free[(at < 0 ? 0 : at) % free.length] : Math.max(0, at)) % TRAVELLER_COLOURS.length
}

// ---------------------------------------------------------------- D2-5: a birthday at sea

export interface OccasionAtSea { occasion: Occasion; day: number }

/** The occasions that fall on a day of the trip (`dates[0]` is day 1). The year is ignored: a birthday on 14 March counts on 14 March of the trip. */
export function occasionsAtSea(occasions: readonly Occasion[], dates: readonly string[]): OccasionAtSea[] {
  return occasions.flatMap((o) => {
    const i = dates.findIndex((d) => d.slice(5) === o.date.slice(5))
    return i >= 0 ? [{ occasion: o, day: i + 1 }] : []
  })
}

/** Words to pass to the ship: copied, never sent. A surprise says so. */
export function occasionNote(o: Occasion, shipName: string): string {
  return `Hello ${shipName} team. ${o.label} falls during our cruise.${o.surprise ? ' We would like it to be a surprise, so please do not mention it in front of the guest.' : ''} Thank you.`
}

// ---------------------------------------------------------------- D2-7: who pays what, by slider

/** Moves one person's share to `cents` (0 to the total) and spreads the rest over the others in proportion to what they had; the shares always add up to the total. */
export function reslice(amounts: readonly number[], index: number, cents: number): number[] {
  const total = amounts.reduce((a, b) => a + b, 0)
  if (index < 0 || index >= amounts.length) return [...amounts]
  const mine = Math.max(0, Math.min(total, Math.round(cents)))
  if (amounts.length === 1) return [total]
  const others = amounts.map((a, i) => (i === index ? 0 : a))
  const weight = others.reduce((a, b) => a + b, 0)
  const left = total - mine
  const w = weight > 0 ? others : amounts.map((_, i) => (i === index ? 0 : 1))
  const wsum = w.reduce((a, b) => a + b, 0)
  const exact = w.map((x) => (left * x) / wsum)
  const out = exact.map(Math.floor)
  let rest = left - out.reduce((a, b) => a + b, 0)
  const order = exact.map((e, i) => ({ i, f: e - Math.floor(e) })).filter((x) => x.i !== index).sort((a, b) => b.f - a.f || a.i - b.i)
  for (const { i } of order) { if (rest <= 0) break; out[i]++; rest-- }
  out[index] = mine
  return out
}
