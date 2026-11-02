import { elegantNights } from './packing'
import { itinerary, PORTS, type PortId, type Sailing } from './sailings'
import type { Cents } from './money'

/**
 * H8 slice A, part 2: weekly companion (S3-03), packing for this ship (S3-06), guaranteed-cabin odds (S2-07),
 * carbon range (S2-09, XT-08), money plan (S3-12), child trip story (S3-14), paste a plan (S0-07), occasion starter and day stories (S0-09, S0-08).
 * Pure; authored figures are concept figures.
 */

// ---- Weekly companion (S3-03) ----
export const COMPANION_WEEKS = 8
/** The week of the countdown the guest is in: 8 is eight weeks out, 1 is the last week. Null before week 8 and after sailing. */
export function companionWeek(daysToDeparture: number): number | null {
  if (daysToDeparture <= 0) return null
  const w = Math.ceil(daysToDeparture / 7)
  return w <= COMPANION_WEEKS ? w : null
}

// ---- Packing for this ship (S3-06) ----
export const PROHIBITED = ['irons', 'kettles', 'surge', 'candles', 'drones', 'walkie', 'alcohol'] as const
export const OUTLETS = ['twoUs', 'noEu', 'usb', 'strip'] as const
/** Days (of 8) that are elegant evenings, from the same rule `packing.ts` uses. */
export function dressNights(nights: number): number[] {
  return [2, 7].slice(0, elegantNights(nights))
}

// ---- Guaranteed-cabin odds (S2-07) ----
export interface Odds { same: number; up: number }
/** Authored history of past guarantee bookings in each category: how often the cabin was in the category booked and how often it was a better one. */
const ODDS: Record<string, Odds> = { interior: { same: 70, up: 30 }, oceanview: { same: 75, up: 25 }, balcony: { same: 80, up: 20 }, miniSuite: { same: 90, up: 10 }, sanctuaryMiniSuite: { same: 95, up: 5 }, signatureSuite: { same: 100, up: 0 } }
export const guaranteeOdds = (category: string): Odds | null => ODDS[category] ?? null

// ---- Carbon range (S2-09, XT-08) ----
/** Kilograms of CO2e per guest per night, a low and a high: ship fuel burn spread over passengers. A range, not a measurement. */
export const KG_PER_GUEST_NIGHT = { low: 120, high: 220 } as const
export function carbonRange(nights: number, guests: number): { lowKg: number; highKg: number } {
  const n = Math.max(0, nights) * Math.max(0, guests)
  return { lowKg: n * KG_PER_GUEST_NIGHT.low, highKg: n * KG_PER_GUEST_NIGHT.high }
}

// ---- Money plan (S3-12) ----
export interface MoneyDay { day: number; port: PortId; kind: 'sea' | 'port'; budget: Cents; cash: Cents }
export interface MoneyPlan { days: MoneyDay[]; total: Cents; cash: Cents; card: Cents }
export const DEFAULT_DAILY = { sea: 6000, port: 9000 } as const
const CASH_PER_PORT = 3000

/** A budget for each day by day type: port days include some cash for tips and small shops. All per person, then times guests. */
export function moneyPlan(s: Sailing, guests: number, daily: { sea: Cents; port: Cents } = DEFAULT_DAILY): MoneyPlan {
  const g = Math.max(1, guests)
  const days = itinerary(s).filter((d) => d.day !== 8).map((d): MoneyDay => {
    const ashore = d.port !== 'sea' && d.port !== 'fll'
    return { day: d.day, port: d.port, kind: ashore ? 'port' : 'sea', budget: (ashore ? daily.port : daily.sea) * g, cash: ashore ? CASH_PER_PORT * g : 0 }
  })
  const total = days.reduce((a, d) => a + d.budget, 0), cash = days.reduce((a, d) => a + d.cash, 0)
  return { days, total, cash, card: total - cash }
}

// ---- Child trip story (S3-14) ----
export const cleanName = (v: string): string => v.replace(/[^\p{L}\p{N} '’-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20)

/** A short story of the week, in words a child can read, from the ship's real itinerary. */
export function childStory(name: string, s: Sailing): string[] {
  const n = cleanName(name) || 'You'
  const lines = [`${n} is going on a big ship!`]
  for (const d of itinerary(s)) {
    if (d.day === 1) lines.push(`On day 1, ${n} waves goodbye to Fort Lauderdale.`)
    else if (d.port === 'sea') lines.push(`On day ${d.day}, the ship sails all day. ${n} can swim, play and watch for dolphins.`)
    else if (d.day === 8) lines.push(`On day 8, the ship comes home and ${n} says goodbye to the sea.`)
    else lines.push(`On day ${d.day}, the ship stops at ${PORTS[d.port as Exclude<PortId, 'sea'>].name.split(',')[0]}. ${n} goes ashore with a grown-up.`)
  }
  lines.push(`${n} has the best week ever.`)
  return lines
}

// ---- Paste a plan (S0-07) ----
export interface PlanLine { day: number | null; text: string }
export const PASTE_MAX = 30
export const PASTE_LINE_MAX = 120

/** Reads a plan pasted from an outside assistant into lines, with a day number where the line starts "Day 3". Only a draft: nothing is kept until the guest confirms. */
export function parsePlan(text: string): PlanLine[] {
  const out: PlanLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    const cleaned = raw.replace(/^[\s*#>\-•\d.)]*(?=day\b)/i, '').replace(/^[\s*#>\-•]+/, '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim()
    const m = /^day\s*(\d)\b\s*[:.\-–—]?\s*(.*)$/i.exec(cleaned)
    const body = (m ? m[2] : cleaned).slice(0, PASTE_LINE_MAX).trim()
    const day = m && Number(m[1]) >= 1 && Number(m[1]) <= 8 ? Number(m[1]) : null
    if (body === '' || /https?:\/\//i.test(body)) continue
    if (out.some((l) => l.day === day && l.text.toLowerCase() === body.toLowerCase())) continue
    out.push({ day, text: body })
    if (out.length >= PASTE_MAX) break
  }
  return out
}

export function normalizePlanLines(raw: unknown): PlanLine[] {
  return (Array.isArray(raw) ? raw : []).flatMap((x): PlanLine[] => {
    const o = x as Record<string, unknown> | null
    if (!o || typeof o.text !== 'string' || o.text.trim() === '') return []
    const day = typeof o.day === 'number' && o.day >= 1 && o.day <= 8 ? Math.floor(o.day) : null
    return [{ day, text: o.text.slice(0, PASTE_LINE_MAX) }]
  }).slice(0, PASTE_MAX)
}

// ---- Occasion starter and day stories (S0-09, S0-08) ----
export const OCCASIONS = ['birthday', 'anniversary', 'honeymoon', 'reunion', 'firstCruise'] as const
export type Occasion = (typeof OCCASIONS)[number]
/** Where to go first for each occasion: authored, in order. */
export const STARTERS: Record<Occasion, readonly string[]> = {
  birthday: ['/plan/dining', '/plan/day', '/plan/packing'],
  anniversary: ['/plan/dining', '/plan/excursions', '/me/memories'],
  honeymoon: ['/plan/dining', '/plan/excursions', '/plan/day'],
  reunion: ['/plan/party', '/plan/dining', '/plan/split'],
  firstCruise: ['/plan/checklist', '/plan/packing', '/home/cruise'],
}
export const STYLES = ['relaxed', 'active', 'foodie', 'family'] as const
export type Style = (typeof STYLES)[number]
/** The story style that suits each demo persona, as the starting choice on the starter screen. The guest can pick any. */
const STYLE_FOR: Record<string, Style> = { gerald: 'relaxed', maria: 'relaxed', linda: 'relaxed', alexander: 'foodie', daniel: 'family', priya: 'relaxed', ethan: 'active', maya: 'family', marcus: 'active', elena: 'relaxed', lucas: 'family', sofia: 'family' }
export const styleFor = (personaId: string | null | undefined): Style => (personaId ? STYLE_FOR[personaId] : undefined) ?? 'relaxed'

export const STORY_DAYS = [3, 4, 5] as const
