import { EXCURSIONS } from './excursions'
import { diningPlaces } from './aboardMore'
import { type AllergyFlag, galleyStatus, type GalleyStatus, splitEven, type Share } from './bookingPrep'
import { offAt, onwardCheck, WALKOFF_IDS, type OnwardPlan, type TagGroup, type WalkOffId } from './disembark'
import { FARE_IDS, type FareId } from './fares'
import { rankNudges, type Nudge, type NudgeBudget } from './nudges'
import { perPerson } from './portContent'
import { knowledgeOf, shortSnapshot } from './portTier'
import { REQUEST_ITEMS } from './services'
import type { StormBand, StormPhase } from './storm'
import { fareFor } from './pricing'
import { type Cents } from './money'
import type { Sailing } from './sailings'
import type { CategoryId } from './ship'
import { registerContent } from './content'

/**
 * H8 slice D: the last day, trust and care leftovers (S7-01 to S7-03, S7-06 to S7-09, S6-26, S1-01, S4-11, XI-08 to XI-11).
 * Pure. Single-device and simulated where it says so; reminders and notes are shown on the screen and nothing is sent to anyone.
 */
const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const hash = (s: string): number => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
const MIN = 60_000
const DAY = 24 * 60 * MIN

// ---- S7-02: cabin sweep ----
export const SWEEP_ITEMS = ['safe', 'drawers', 'chargers', 'underBed', 'bathroom', 'balcony'] as const
export const sweepAllDone = (ticked: readonly string[]): boolean => SWEEP_ITEMS.every((i) => ticked.includes(i))

// ---- S7-03: bag night ----
export type BagsState = 'none' | 'out' | 'collected'
export type BagNight = { state: 'open'; minutesLeft: number } | { state: 'late' } | { state: 'out' } | { state: 'collected' }
/** Where the bags are: before the hallway deadline there is a countdown, after it a plain "late" line, never a scare. */
export function bagNight(bagsOutAt: number, now: number, bags: BagsState): BagNight {
  if (bags === 'collected') return { state: 'collected' }
  if (bags === 'out') return { state: 'out' }
  return now >= bagsOutAt ? { state: 'late' } : { state: 'open', minutesLeft: Math.ceil((bagsOutAt - now) / MIN) }
}

// ---- S7-01 and S7-06: a flight-aware choice, and low-stress mode ----
export const EASY_EXTRA_MIN = 60
export const EASY_SPARE_MIN = 90
export type OptionFit = 'ok' | 'tight' | 'tooEarly' | 'noFlight'
export interface OptionAdvice { option: WalkOffId; offFrom: number; fit: OptionFit; spare: number | null }
export interface FlightAdvice { best: WalkOffId; options: OptionAdvice[]; /** True when even the earliest option does not work. */ risky: boolean; earlyFlight: boolean }
/** Rate each way of getting off against the flight. The best is the latest one that still has enough spare time; in low-stress mode that means 90 minutes, not 45. */
export function flightAdvice(s: Sailing, plan: OnwardPlan, group: TagGroup, easy: boolean): FlightAdvice {
  const need = easy ? EASY_SPARE_MIN : 45
  const options = WALKOFF_IDS.map((option): OptionAdvice => {
    const offFrom = offAt(s, option, group)
    const c = onwardCheck(s, plan, offFrom)
    const fit: OptionFit = c.status === 'noFlight' ? 'noFlight' : c.spare! < 0 ? 'tooEarly' : c.spare! < need ? 'tight' : 'ok'
    return { option, offFrom, fit, spare: c.spare }
  })
  const good = options.filter((o) => o.fit === 'ok' || o.fit === 'noFlight').sort((a, b) => b.offFrom - a.offFrom)
  const earliest = [...options].sort((a, b) => a.offFrom - b.offFrom)[0]
  const best = good[0]?.option ?? earliest.option
  const earlyFlight = !!plan.flightAt && plan.flightAt < '10:00'
  return { best, options, risky: good.length === 0 && plan.flightAt !== '', earlyFlight }
}
/** In low-stress mode the leave-by time is earlier by an hour. */
export const easyLeaveBy = (leaveBy: number, easy: boolean): number => (easy ? leaveBy - EASY_EXTRA_MIN * MIN : leaveBy)

// ---- S7-07: ride pool through a ledger ----
export interface RidePool { meet: string; total: Cents; shares: Share[] }
export const RIDE_NAMES_MAX = 4
/** Splits one ride between the parties that join; the booker's own share is first. Nothing is collected by the app. */
export function poolRide(meet: string, total: Cents, names: readonly string[], idOf: (i: number) => string): RidePool | null {
  const who = names.map((n) => clean(n, 30)).filter(Boolean).slice(0, RIDE_NAMES_MAX)
  if (who.length < 2 || !Number.isInteger(total) || total <= 0 || total > 100_000 || !clean(meet, 60)) return null
  return { meet: clean(meet, 60), total, shares: splitEven(total, who).map((s, i) => ({ id: idOf(i), name: s.name, amount: s.amount, paid: false })) }
}

// ---- S7-08: three-tap farewell ----
export const FAREWELL_MOMENTS = ['sunset', 'dinner', 'port', 'family', 'show', 'quiet'] as const
export interface Farewell { moment: string; rating: number | null; note: string }
export const EMPTY_FAREWELL: Farewell = { moment: '', rating: null, note: '' }
/** Moment, rating, done: the note is optional, and the rating can be skipped. */
export const farewellDone = (f: Farewell): boolean => f.moment !== '' && f.rating !== null

// ---- S7-09: after-cruise health follow-up ----
export const FOLLOW_DAYS = [3, 7] as const
export type FollowAnswer = 'well' | 'unwell'
export interface FollowUp { consent: boolean; answers: Record<string, FollowAnswer> }
export const EMPTY_FOLLOW: FollowUp = { consent: false, answers: {} }
export type FollowState = 'later' | 'due' | 'answered'
/** A note is due on the third and seventh day after leaving the ship, only for a guest who agreed to it. Shown on the screen; nothing is sent. */
export function followState(day: number, leftAt: number, now: number, f: FollowUp): FollowState {
  if (f.answers[String(day)]) return 'answered'
  return f.consent && now >= leftAt + day * DAY ? 'due' : 'later'
}
export const DOCTOR_TELL = ['where', 'when', 'symptoms', 'meds', 'allergies'] as const

// ---- S6-26: ask the ship ----
export interface ShipFact { id: string; keywords: string[]; q: string; a: string }
/** Facts that are not a service request, answered from authored content. Check the daily programme for times. */
export const SHIP_FACTS: readonly ShipFact[] = [
  { id: 'next', keywords: ['next', 'port', 'going', 'where'], q: 'Where does the ship go next?', a: 'The route and the next port are on the Itinerary screen, with arrival and all-aboard times.' },
  { id: 'engine', keywords: ['engine', 'tour', 'behind'], q: 'Is there an engine room tour?', a: 'Not as a regular tour. Behind-the-scenes visits, when offered, are listed in the daily programme and need a sign-up.' },
  { id: 'bridge', keywords: ['bridge', 'captain', 'navigation'], q: 'Can I see the bridge?', a: 'The bridge is not open for visits. The captain’s talks and any question times are in the daily programme.' },
  { id: 'speed', keywords: ['speed', 'fast', 'knots'], q: 'How fast does the ship go?', a: 'About 21 knots at cruising speed; less when the ship is near a port.' },
  { id: 'clock', keywords: ['clock', 'time', 'zone'], q: 'Does the ship’s clock change?', a: 'Yes, once on this route. Ship time and port time are shown on Home, and the Itinerary screen marks the change.' },
  { id: 'water', keywords: ['water', 'fresh', 'drink'], q: 'Where does the water come from?', a: 'The ship makes its own fresh water from seawater, and tap water in cabins is safe to drink.' },
]
const words = (q: string): string[] => q.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2)
/** The best matching fact, or null when nothing fits. Never a guess: "I do not know" sends the guest to Guest Services. */
export function askShip(q: string): ShipFact | null {
  const w = words(q)
  const scored = SHIP_FACTS.map((f) => ({ f, n: f.keywords.filter((k) => w.includes(k)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)
  return scored[0]?.f ?? null
}

// ---- XI-08: safe-ashore notes for different travellers ----
export const TRAVELLERS = ['women', 'lgbtq', 'older', 'disability'] as const
export type Traveller = (typeof TRAVELLERS)[number]
/** Factual and calm. Authored for the concept; verify against official travel advice before real use. */
export const ASHORE_NOTES: Record<Traveller, readonly string[]> = {
  women: ['Use the ship’s excursions or a taxi from the rank; share your plan with someone on board.', 'Keep drinks in sight and stay in busy, lit areas until you are back at the pier.'],
  lgbtq: ['Laws and attitudes differ by country. Read the local-law note for the port before you go.', 'Keep public affection low-key if you are unsure, and know where Guest Services and the port agent are.'],
  older: ['Heat and uneven ground are the usual problems. Take water, sit often, and check the walk’s seats and restrooms.', 'Tender ports mean steps and a boat; ask about assistance before the day.'],
  disability: ['Check the excursion’s accessibility note and your profile before you book.', 'Ask for step-free routes at the pier; many tours need a day’s notice for a ramped vehicle.'],
}
export const notesFor = (who: readonly Traveller[]): { who: Traveller; notes: readonly string[] }[] => who.map((w) => ({ who: w, notes: ASHORE_NOTES[w] }))

// ---- XI-09: allergy confidence chain ----
export type ChainStep = 'flagged' | 'galley' | 'venues'
export interface VenueRow { id: string; name: string; status: GalleyStatus; safe: number }
export interface Chain { steps: { id: ChainStep; done: boolean }[]; venues: VenueRow[] }
/** From the pre-flag to each venue. The galley and venue acknowledgements are simulated and say so; the safe-options count is authored. */
export function allergyChain(flag: AllergyFlag, now: number): Chain {
  const status = galleyStatus(flag, now)
  const flagged = flag.items.length > 0
  return {
    steps: [{ id: 'flagged', done: flagged }, { id: 'galley', done: status !== 'notSent' }, { id: 'venues', done: status === 'acknowledged' }],
    venues: diningPlaces().map((p) => ({ id: p.id, name: p.name, status, safe: 3 + (hash(p.id) % 5) })),
  }
}

// ---- S1-01: a fare indicator ----
export type FareBand = 'low' | 'typical' | 'high'
export const HISTORY_POINTS = 8
/** A simulated fare history for a sailing and room: the same each time, ±12% around the current fare. */
export function fareSeries(sailingId: string, category: CategoryId): Cents[] {
  const now = fareFor(sailingId, category)
  if (now === null) return []
  return Array.from({ length: HISTORY_POINTS }, (_, i) => Math.round(now * (1 + ((hash(`${sailingId}${category}${i}`) % 25) - 12) / 100)))
}
export interface FareIndicator { now: Cents; band: FareBand; lowest: Cents; highest: Cents }
export function fareIndicator(sailingId: string, category: CategoryId): FareIndicator | null {
  const now = fareFor(sailingId, category)
  const series = fareSeries(sailingId, category)
  if (now === null) return null
  const below = series.filter((p) => p < now).length / series.length
  return { now, band: below <= 0.25 ? 'low' : below >= 0.75 ? 'high' : 'typical', lowest: Math.min(...series, now), highest: Math.max(...series, now) }
}
export const HABITS = ['drinks', 'wifi', 'dining', 'excursions'] as const
/** The tier that fits the guest's own habits: the more extras they use, the more a bundle saves. Two or more points to the top tier. */
export const tierForHabits = (habits: readonly string[]): FareId => FARE_IDS[Math.min(habits.length >= 2 ? 2 : habits.length, 2)]

// ---- S4-11: gifts that read the room ----
export interface Gift { id: string; cents: Cents; occasion: 'birthday' | 'anniversary' | 'any'; celebration?: boolean; alcohol: boolean; contains: string[] }
export const GIFTS: readonly Gift[] = [
  { id: 'cake', cents: 3500, occasion: 'birthday', celebration: true, alcohol: false, contains: ['egg', 'milk', 'wheat'] },
  { id: 'flowers', cents: 4500, occasion: 'any', alcohol: false, contains: [] },
  { id: 'champagne', cents: 6500, occasion: 'anniversary', celebration: true, alcohol: true, contains: [] },
  { id: 'fruit', cents: 3000, occasion: 'any', alcohol: false, contains: [] },
  { id: 'chocolate', cents: 2500, occasion: 'any', alcohol: false, contains: ['milk', 'nuts', 'soy'] },
  { id: 'photo', cents: 2000, occasion: 'any', alcohol: false, contains: [] },
]
/** Only what fits the budget and the dietary notes; never shown on a screen where the guest has a task to finish (it has a screen of its own). */
export function giftsFor(budget: Cents | null, occasion: 'birthday' | 'anniversary' | 'none', avoid: readonly string[], noAlcohol: boolean, gentle = false): Gift[] {
  const bad = avoid.map((a) => a.toLowerCase())
  return GIFTS.filter((g) => (g.occasion === 'any' || g.occasion === occasion) && (budget === null || g.cents <= budget) && !(noAlcohol && g.alcohol) && !(gentle && g.celebration) && !g.contains.some((c) => bad.some((b) => b.includes(c) || c.includes(b))))
}

// ---- XI-10 and XI-11: gentle wording and the anxiety toolkit ----
export const GROUND_STEPS = ['five', 'four', 'three', 'two', 'one'] as const
export const BREATH = { in: 4, hold: 4, out: 6, rounds: 4 } as const

// ---- State kept on the device ----
export interface FinishState {
  sweep: string[]; bags: BagsState; easy: boolean; assistBooked: boolean
  ride: RidePool | null; farewell: Farewell; follow: FollowUp
  travellers: Traveller[]; gentle: boolean; memorial: string
}
export const EMPTY_FINISH: FinishState = { sweep: [], bags: 'none', easy: false, assistBooked: false, ride: null, farewell: EMPTY_FAREWELL, follow: EMPTY_FOLLOW, travellers: [], gentle: false, memorial: '' }

export function normalizeFinish(raw: unknown): FinishState {
  const r = rec(raw), f = rec(r.farewell), fu = rec(r.follow), ride = rec(r.ride)
  const answers: Record<string, FollowAnswer> = {}
  for (const [k, v] of Object.entries(rec(fu.answers))) if ((FOLLOW_DAYS as readonly number[]).includes(Number(k)) && (v === 'well' || v === 'unwell')) answers[k] = v
  const shares = arr(ride.shares).flatMap((x): Share[] => { const o = rec(x); return typeof o.id === 'string' && clean(o.name, 30) && typeof o.amount === 'number' && Number.isInteger(o.amount) && o.amount >= 0 ? [{ id: o.id, name: clean(o.name, 30), amount: o.amount, paid: o.paid === true }] : [] }).slice(0, RIDE_NAMES_MAX)
  return {
    sweep: arr(r.sweep).filter((k): k is string => (SWEEP_ITEMS as readonly unknown[]).includes(k)),
    bags: r.bags === 'out' || r.bags === 'collected' ? r.bags : 'none',
    easy: r.easy === true, assistBooked: r.assistBooked === true,
    ride: shares.length >= 2 && clean(ride.meet, 60) && typeof ride.total === 'number' ? { meet: clean(ride.meet, 60), total: ride.total, shares } : null,
    farewell: {
      moment: (FAREWELL_MOMENTS as readonly unknown[]).includes(f.moment) ? (f.moment as string) : '',
      rating: typeof f.rating === 'number' && f.rating >= 1 && f.rating <= 5 ? Math.round(f.rating) : null,
      note: clean(f.note, 200),
    },
    follow: { consent: fu.consent === true, answers },
    travellers: arr(r.travellers).filter((k): k is Traveller => (TRAVELLERS as readonly unknown[]).includes(k)),
    gentle: r.gentle === true, memorial: clean(r.memorial, 80),
  }
}

// ---- Part 2: quiet modes, Home nudges, item requests, voice, alerts, read-aloud, port snapshot ----
/** Low-stress mode and gentle wording both mean no offers on Home. */
export const offersQuiet = (f: Pick<FinishState, 'easy' | 'gentle'>): boolean => f.easy || f.gentle

export type HomeNudgeId = 'backAboard' | 'storm' | 'stormAboard' | 'proposals' | 'briefing'
export interface HomeNudge extends Nudge { id: HomeNudgeId; path: string; params: Record<string, number> }
export interface HomeNudgeInput {
  budget: NudgeBudget
  /** Do not disturb is on, or calm mode: only critical notices go through. */
  quiet: boolean
  /** Minutes before all aboard while in port, or null. */
  backAboardMin: number | null
  storm: StormBand
  stormPhase: StormPhase
  proposals: number
  briefing: boolean
}
/** The unprompted cards Home may show now. Back aboard is a safety notice and is always shown; the rest spend the guest's daily budget, highest first, and nothing else is shown when it is zero, in calm mode or in do not disturb. */
export function homeNudges(i: HomeNudgeInput): HomeNudge[] {
  const items: HomeNudge[] = []
  if (i.backAboardMin !== null && i.backAboardMin > 0 && i.backAboardMin <= 120) items.push({ id: 'backAboard', priority: 9, critical: true, path: '/ship/port', params: { min: i.backAboardMin } })
  if (i.storm === 'higher' && (i.stormPhase === 'near' || i.stormPhase === 'watch')) items.push({ id: 'storm', priority: 4, path: '/plan/storm', params: {} })
  if (i.storm === 'higher' && i.stormPhase === 'sailing') items.push({ id: 'stormAboard', priority: 5, path: '/home/disruption', params: {} })
  if (i.proposals > 0) items.push({ id: 'proposals', priority: 3, path: '/plan/autopilot', params: { n: i.proposals } })
  if (i.briefing) items.push({ id: 'briefing', priority: 1, path: '/home/briefing', params: {} })
  return rankNudges(items, i.quiet ? 0 : i.budget)
}

const ITEM_WORDS: Record<string, readonly string[]> = {
  towels: ['towel', 'towels'], pillows: ['pillow', 'pillows'], bedding: ['blanket', 'blankets', 'bedding', 'sheets', 'duvet'],
  toiletries: ['toiletries', 'shampoo', 'soap', 'conditioner'], ice: ['ice'], turndown: ['turndown'],
  light: ['bulb', 'lamp'], aircon: ['aircon', 'air-con', 'airconditioning'], plumbing: ['toilet', 'sink', 'shower', 'plumbing', 'leak'], tv: ['tv', 'television', 'remote'],
}
const NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 }
export interface ItemRequest { id: string; qty: number }
/** "Can I have two more towels" becomes an item and a quantity (never above the usual limit); anything else is null. It is only a proposal until the guest confirms. */
export function parseItemRequest(q: string): ItemRequest | null {
  const w = q.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean)
  if (!w.some((x) => ['need', 'request', 'bring', 'send', 'get', 'want', 'have', 'more', 'extra', 'please', 'fix', 'broken'].includes(x))) return null
  const hit = REQUEST_ITEMS.find((r) => (ITEM_WORDS[r.id] ?? []).some((k) => w.includes(k)))
  if (!hit) return null
  const n = w.map((x) => NUMBERS[x] ?? (/^\d$/.test(x) ? Number(x) : 0)).find((x) => x > 0) ?? 1
  return { id: hit.id, qty: Math.min(Math.max(1, n), hit.maxQty) }
}

export interface ExcursionRequest { id: string; name: string }
const FILLER = new Set(['the', 'a', 'an', 'to', 'my', 'in', 'on', 'of', 'by', 'day', 'pass', 'and', 'for', 'at', 'me', 'cart', 'trip', 'tour', 'excursion'])
const tokens = (s: string): string[] => s.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 2 && !FILLER.has(x))
/**
 * "Add the reef snorkel to my cart" becomes one named excursion, or null when it is not clearly one. It only goes in the cart on confirm;
 * paying is a separate step on the excursions screen.
 */
export function parseExcursionRequest(q: string, list: readonly { id: string; name: string }[] = EXCURSIONS): ExcursionRequest | null {
  const w = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  if (!w.some((x) => ['add', 'book', 'put', 'reserve'].includes(x)) || !(w.includes('cart') || w.includes('excursion') || w.includes('tour') || list.some((e) => q.toLowerCase().includes(e.name.toLowerCase())))) return null
  const asked = new Set(tokens(q))
  const scored = list.map((e) => ({ e, hits: tokens(e.name).filter((x) => asked.has(x)).length })).filter((x) => x.hits >= 2 || (x.hits >= 1 && tokens(x.e.name).length === 1))
  scored.sort((a, b) => b.hits - a.hits)
  if (scored.length === 0 || (scored.length > 1 && scored[0].hits === scored[1].hits)) return null
  return { id: scored[0].e.id, name: scored[0].e.name }
}

/** The browser's speech recognition, where there is one. Voice only fills the question box; sending and confirming stay a tap. */
export const speechRecognitionOf = (win: object | undefined): (new () => unknown) | null => {
  const w = win as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown } | undefined
  return w?.SpeechRecognition ?? w?.webkitSpeechRecognition ?? null
}

// ---- XI-07: visual and vibration alerts ----
export type AlertKind = 'notice' | 'important' | 'critical'
export const ALERT_KINDS: readonly AlertKind[] = ['notice', 'important', 'critical']
/** Vibration patterns in milliseconds: one short, two, then three long. Phones that cannot vibrate show the visual alert only. */
export const VIBRATION: Record<AlertKind, number[]> = { notice: [200], important: [200, 100, 200], critical: [400, 150, 400, 150, 400] }

// ---- XI-06: read aloud ----
export const READ_RATES = [0.8, 1, 1.2] as const
/** The day as one spoken passage, in the order of the day. */
export const planSpeech = (entries: readonly { title: string; start: string }[], empty: string): string =>
  entries.length === 0 ? empty : [...entries].sort((a, b) => a.start.localeCompare(b.start)).map((e) => `${e.start}, ${e.title}.`).join(' ')
export const walkSpeech = (w: { name: string; minutes: number; step: string; accessible: string; sit: string; restroom: string }): string =>
  `${w.name}. About ${w.minutes} minutes. ${w.step} Accessible version: ${w.accessible} Where to sit: ${w.sit} Restroom: ${w.restroom}`

// ---- S6A-14: port snapshot as text ----
/** A short text summary of a port day for the group chat or the recap. Text only: no photos are made or shared here. */
export function portSnapshot(port: string, people: number): string[] {
  const k = knowledgeOf(port)
  if (!k) return shortSnapshot(port)
  const car = k.fairPrices[0]
  return [
    ...(car ? [`Taxi: ${car.route}, about $${car.car} for the car, $${perPerson(car, people)} each. Do not pay over $${car.ceiling}.`] : []),
    `Taxi stand: ${k.taxiStand}`,
    ...k.advisories.slice(0, 2).map((a) => `Heads up: ${a}`),
    ...k.laws.slice(0, 2).map((a) => `Local law: ${a}`),
    ...(k.walks[0] ? [`Walk: ${k.walks[0].name}, about ${k.walks[0].minutes} minutes.`] : []),
    ...k.dontBringBack.slice(0, 2).map((a) => `Do not bring home: ${a}`),
  ]
}

// ---- S8-09: complaint-aware marketing pause ----
/** Marketing stops while a complaint or a service-recovery case is open, and starts again only when it is resolved or withdrawn. A person is offered instead. */
export const marketingPaused = (cases: readonly { kind: string; stage: string }[]): boolean =>
  cases.some((c) => (c.kind === 'complaint' || c.kind === 'recovery') && (c.stage === 'received' || c.stage === 'inReview'))

registerContent('finishMore', { SWEEP_ITEMS, FAREWELL_MOMENTS, FOLLOW_DAYS, DOCTOR_TELL, SHIP_FACTS, TRAVELLERS, ASHORE_NOTES, HABITS, GIFTS, GROUND_STEPS, BREATH, ALERT_KINDS, VIBRATION, READ_RATES })
