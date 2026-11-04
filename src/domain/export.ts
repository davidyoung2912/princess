import { buildIcsCalendar, type IcsEvent } from './calendar'
import { formatDate } from './cruise'
import type { PlanDay } from './plan'
import { itinerary, portById, shipHomeZone, shipZoneOnDate, type ItineraryDay, type Sailing } from './sailings'
import { addDays } from './timezones'

/**
 * Small delights, phase DL2 (docs/small-delights.md): calendar files and print or share cards. Pure. Wording fixed here is plain English for
 * files the guest takes away (calendar entries, cards); screen text lives in `en.ts`. Nothing here leaves the device and no photo is read.
 */

// ---------------------------------------------------------------- calendar files (D2-4, D4-7, D8-6)

const PRODUCT = 'princess.concept'

export interface JourneyCalendarInput {
  number: string
  sailing: Sailing
  /** Final payment date, "YYYY-MM-DD", and what is left to pay as text such as "$1,200" (empty when paid). */
  finalDue: string
  balanceText: string
  /** Days check-in opens before sailing (the live limit). */
  checkinOpensDaysBefore: number
  home: string
  shipName: string
  stamp: number
}

/** D2-4: one file for the whole journey: the sailing, final payment, check-in opening and closing, and sail-away. */
export function journeyCalendar(i: JourneyCalendarInput): string {
  const days = itinerary(i.sailing)
  const first = days[0]
  const last = days[days.length - 1]
  const opens = addDays(i.sailing.departure, -i.checkinOpensDaysBefore)
  const base = { stamp: i.stamp, location: i.home }
  const events: IcsEvent[] = [
    { ...base, uid: `${i.number}-sailing@${PRODUCT}`, summary: `${i.shipName}: sailing`, description: `Booking ${i.number}.`, start: first.date, end: last.date },
    { ...base, uid: `${i.number}-opens@${PRODUCT}`, summary: 'Online check-in opens', description: 'Have passports and the booking number ready.', start: opens, end: opens },
    { ...base, uid: `${i.number}-closes@${PRODUCT}`, summary: 'Online check-in closes at 10:00', description: 'After this the terminal desk takes over.', start: i.sailing.departure, end: i.sailing.departure, at: '09:00', minutes: 60, zone: shipHomeZone(i.sailing) },
  ]
  if (i.finalDue) events.push({ ...base, uid: `${i.number}-final@${PRODUCT}`, summary: 'Final payment due', description: i.balanceText ? `Balance: ${i.balanceText}.` : 'Nothing left to pay.', start: i.finalDue, end: i.finalDue })
  if (first.depart) events.push({ ...base, uid: `${i.number}-sail@${PRODUCT}`, summary: 'Sail-away', description: 'Local time at the port.', start: first.date, end: first.date, at: first.depart, minutes: 30, zone: portZone(first, i.sailing) })
  return buildIcsCalendar(events)
}

/** The zone a day's clock times are in: the port's own on a port day, the ship's on a sea day. */
function portZone(d: Pick<ItineraryDay, 'port' | 'date'>, sailing: Sailing): string {
  return d.port === 'sea' ? shipZoneOnDate(sailing, d.date) : portById(d.port)?.zone ?? shipHomeZone(sailing)
}

export type PlanScope = 'day' | 'week'

const entryTitle = (e: PlanDay['entries'][number]): string => (e.kind === 'sail' ? 'Sail-away' : e.kind === 'allAboard' ? 'All aboard' : e.kind === 'tour' ? `Excursion: ${e.name}` : `Dinner: ${e.name}`)

/** D4-7: the bookings of one day or the whole week as timed events in the port's own clock. Days with nothing on them add nothing. */
export function planCalendar(plan: readonly PlanDay[], scope: PlanScope, day: number, sailing: Sailing, home: string, stamp: number): string {
  const days = scope === 'day' ? plan.filter((d) => d.day === day) : plan
  const events: IcsEvent[] = days.flatMap((d) =>
    d.entries.map((e, n): IcsEvent => ({
      uid: `${sailing.id}-d${d.day}-${n}-${e.kind}@${PRODUCT}`, stamp, summary: entryTitle(e),
      description: `${e.guests.length ? `With ${e.guests.join(', ')}. ` : ''}Day ${d.day}${d.place ? `, ${d.place}` : ' at sea'}. Shown at the right moment in your calendar.`,
      location: d.place || home, start: d.date, end: d.date, at: e.time, zone: portZone(d, sailing), minutes: e.kind === 'tour' ? 240 : e.kind === 'dinner' ? 90 : 30,
    })),
  )
  return buildIcsCalendar(events)
}

/** D8-6: the departure date of "the same week next year": 52 weeks on, so the weekday is the same. */
export const sameWeekNextYear = (departure: string): string => addDays(departure, 364)

/** D8-6: a soft, tentative hold for the week, with a plain note that nothing is booked. */
export function nextYearHold(sailing: Sailing, nights: number, shipName: string, stamp: number): string {
  const start = sameWeekNextYear(sailing.departure)
  return buildIcsCalendar([{
    uid: `hold-${start}@${PRODUCT}`, stamp, summary: `Hold: a week at sea? (${shipName})`, location: '', start, end: addDays(start, nights),
    description: 'A soft hold for the same week next year. Nothing is booked and nothing is reserved.', tentative: true,
  }])
}

// ---------------------------------------------------------------- cards (D3-6, D4-8, D1-8, D8-4, D8-9, D7-5)

/** A card is a title, a few lines and a footer, laid out the same on paper and in a share image. */
export interface Card {
  id: string
  title: string
  subtitle: string
  lines: string[]
  footer: string
  /** Large print: bigger type on paper and in the image. */
  large?: boolean
}

/** Breaks text into lines of at most `width` characters at spaces; a longer word stays whole. */
export function wrapText(text: string, width: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (line && line.length + 1 + word.length > width) { out.push(line); line = word } else line = line ? `${line} ${word}` : word
    }
    out.push(line)
  }
  return out
}

export interface BagTagInput { printed: string; cabin: string; deck: number; sailing: Sailing; shipName: string; home: string; number?: string; large: boolean }

/** D3-6: the bag tag as a card, with a large-print option. Nothing from a travel document goes on it. */
export const bagTagCard = (i: BagTagInput): Card => ({
  id: `tag-${i.printed.replace(/\W+/g, '-')}`, title: i.printed, subtitle: `${i.shipName}, cabin ${i.cabin}, deck ${i.deck}`,
  lines: [`Sails ${formatDate(i.sailing.departure)} from ${i.home}`, ...(i.number ? [`Booking ${i.number}`] : [])], footer: 'Attach to the handle. Cabin and deck as booked.', large: i.large,
})

export interface PosterInput { title: string; sailing: Sailing; plan: readonly PlanDay[]; shipName: string }

/** D4-8: a poster of the week: ship, dates, each day's place and what is booked. */
export function posterCard(i: PosterInput): Card {
  const days = itinerary(i.sailing)
  const lines = i.plan.map((d) => {
    const booked = d.entries.filter((e) => e.kind === 'tour' || e.kind === 'dinner').map((e) => e.name)
    return `Day ${d.day}: ${d.place || 'At sea'}${booked.length ? ` · ${booked.join(', ')}` : ''}`
  })
  return { id: 'poster', title: i.title, subtitle: `${i.shipName} · ${formatDate(days[0].date)} to ${formatDate(days[days.length - 1].date)}`, lines, footer: 'Plans can change.' }
}

export interface ComparisonInput { columns: readonly string[]; rows: readonly { label: string; values: readonly string[] }[]; note: string }

/** D1-8: the side-by-side as a card, one block per choice so it reads on a phone. No names or booking detail. */
export function comparisonCard(i: ComparisonInput): Card {
  const lines = i.columns.flatMap((c, n) => [c, ...i.rows.map((r) => `  ${r.label}: ${r.values[n] ?? '-'}`)])
  return { id: 'compare', title: i.columns.join('  vs  '), subtitle: 'Side by side', lines, footer: i.note }
}

export const MOMENT_MAX = 140

/** D8-4: one line and, optionally, a photo the guest picks. The photo is drawn on the card in the browser and never uploaded. */
export const momentCard = (line: string, byline: string, dates: string): Card => ({ id: 'moment', title: line.trim().slice(0, MOMENT_MAX), subtitle: dates, lines: [], footer: byline })

export interface CertificateInput { name: string; nights: number; ports: readonly string[]; seaDays: number; nauticalMiles: number; shipName: string; dates: string }

/** D8-9: a small, silly certificate of nights at sea, ports and crossings. */
export const certificateCard = (i: CertificateInput): Card => ({
  id: 'certificate', title: `Certificate for ${i.name}`, subtitle: `${i.nights} nights at sea aboard ${i.shipName}`,
  lines: [`Ports: ${i.ports.join(', ')}`, `${i.seaDays} days at sea${i.nauticalMiles > 0 ? ` and about ${new Intl.NumberFormat('en-US').format(i.nauticalMiles)} nautical miles` : ''}`, i.dates],
  footer: 'Awarded for good company and sea legs.',
})

export interface KeepsakeInput { title: string; sailing: Sailing; dinners: readonly string[]; tours: readonly string[]; shipName: string }

const PORT_LABEL: Record<string, string> = { fll: 'Fort Lauderdale', cozumel: 'Cozumel', belize: 'Belize City', roatan: 'Roatán' }

/** D7-5: ports, dates and the tables and tours the guest actually had, one page, from their own bookings. */
export function keepsakeCard(i: KeepsakeInput): Card {
  const days = itinerary(i.sailing).map((d) => `${formatDate(d.date)}: ${d.port === 'sea' ? 'At sea' : (PORT_LABEL[d.port] ?? d.port)}`)
  const extra = [...(i.tours.length ? [`Ashore: ${i.tours.join('; ')}`] : []), ...(i.dinners.length ? [`Tables: ${i.dinners.join('; ')}`] : [])]
  return { id: 'keepsake', title: i.title, subtitle: i.shipName, lines: [...days, ...extra], footer: 'Kept on this device.' }
}

/** The text of a card for a message or a screen reader. */
export const cardText = (c: Card): string => [c.title, c.subtitle, ...c.lines, c.footer].filter(Boolean).join('\n')

export interface CardLayout { width: number; height: number; lines: { text: string; size: number; weight: 'bold' | 'normal'; y: number }[]; photoY: number | null }

const WIDTH = 1080
const PHOTO = 560

/** The image layout of a card: sizes and positions only, so it can be tested without a canvas. Large print scales the type up. */
export function cardLayout(c: Card, hasPhoto = false): CardLayout {
  const scale = c.large ? 1.35 : 1
  const out: CardLayout['lines'] = []
  let y = 120
  let photoY: number | null = null
  const add = (text: string, size: number, weight: 'bold' | 'normal') => {
    const px = size * scale
    for (const w of wrapText(text, Math.floor((WIDTH - 160) / (px * 0.55)))) { out.push({ text: w, size: px, weight, y }); y += px * 1.35 }
    y += 8
  }
  add(c.title, 64, 'bold')
  if (c.subtitle) add(c.subtitle, 36, 'normal')
  if (hasPhoto) { photoY = y; y += PHOTO + 24 }
  for (const l of c.lines) add(l, 34, 'normal')
  if (c.footer) { y += 24; add(c.footer, 28, 'normal') }
  return { width: WIDTH, height: Math.max(WIDTH, Math.ceil(y + 80)), lines: out, photoY }
}

// ---------------------------------------------------------------- comparison link (D1-8)

export interface ComparePick { category: string; number: string }
export interface CompareState { sailingId: string; guests: number; fare: string; picks: ComparePick[] }

/** The query string of a comparison link: the sailing, party size, fare and up to three picks. It carries no name or booking detail. */
export function compareQuery(s: CompareState): string {
  const q = new URLSearchParams({ s: s.sailingId, g: String(s.guests), f: s.fare, c: s.picks.slice(0, 3).map((p) => `${p.category}:${p.number}`).join(',') })
  return q.toString()
}

const SAFE = /^[A-Za-z0-9_-]{1,24}$/

/** Reads a comparison link back. Anything that does not look right is dropped, so a hand-edited link can only ever select from the guide. */
export function parseCompareQuery(search: string): Partial<CompareState> {
  const q = new URLSearchParams(search)
  const out: Partial<CompareState> = {}
  const s = q.get('s')
  if (s && SAFE.test(s)) out.sailingId = s
  const g = Number(q.get('g'))
  if (Number.isInteger(g) && g >= 1 && g <= 6) out.guests = g
  const f = q.get('f')
  if (f && SAFE.test(f)) out.fare = f
  const picks = (q.get('c') ?? '').split(',').flatMap((x): ComparePick[] => {
    const [category, number] = x.split(':')
    return category && number && SAFE.test(category) && SAFE.test(number) ? [{ category, number }] : []
  })
  if (picks.length) out.picks = picks.slice(0, 3)
  return out
}
