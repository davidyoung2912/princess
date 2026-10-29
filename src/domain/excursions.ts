import { daysBetween } from './trip'
import { itinerary, PORTS, type ItineraryDay, type PortId, type Sailing } from './sailings'
import type { Cents } from './pricing'

/** Shore excursions (PRE-01, PRE-02). Names, lengths and prices agree with the Discover port guides (tested); the rest is authored concept data. */
export type ExcursionPort = Exclude<PortId, 'sea' | 'fll'>
export type Interest = 'water' | 'culture' | 'nature' | 'adventure' | 'relax'
export type Activity = 'easy' | 'moderate' | 'strenuous'

export const INTERESTS: readonly Interest[] = ['water', 'culture', 'nature', 'adventure', 'relax']
export const ACTIVITIES: readonly Activity[] = ['easy', 'moderate', 'strenuous']

export interface ExcursionItem {
  id: string
  port: ExcursionPort
  name: string
  summary: string
  hours: number
  /** Per adult. */
  price: Cents
  activity: Activity
  /** Whether a wheelchair user can take part with the help the operator describes. */
  wheelchair: boolean
  family: boolean
  interests: Interest[]
  /** Out of 5, one decimal, from authored sample reviews. */
  rating: number
  reviews: number
  meeting: string
  /** Local port time, "HH:MM". */
  start: string
  capacity: number
}

const MEET_PIER = 'Meet on the pier beside the gangway, 10 minutes before the start'
const MEET_TENDER = 'Meet at the tender landing in town, then follow the guide'

export const EXCURSIONS: readonly ExcursionItem[] = [
  { id: 'coz-snorkel', port: 'cozumel', name: 'Reef snorkel by boat', summary: 'A short boat ride to Palancar Reef, with gear and a guide in the water.', hours: 3.5, price: 7900, activity: 'moderate', wheelchair: false, family: true, interests: ['water', 'nature'], rating: 4.7, reviews: 1284, meeting: MEET_PIER, start: '08:30', capacity: 36 },
  { id: 'coz-ruins', port: 'cozumel', name: 'San Gervasio Mayan ruins', summary: 'An air-conditioned coach to the island’s ruins, with a guide on the history.', hours: 4, price: 6900, activity: 'moderate', wheelchair: false, family: true, interests: ['culture'], rating: 4.5, reviews: 902, meeting: MEET_PIER, start: '09:00', capacity: 40 },
  { id: 'coz-beach', port: 'cozumel', name: 'Beach club day pass', summary: 'A lounger, shade and a lunch credit at a beach club a short taxi ride away.', hours: 6, price: 5900, activity: 'easy', wheelchair: true, family: true, interests: ['relax', 'water'], rating: 4.6, reviews: 2210, meeting: MEET_PIER, start: '09:30', capacity: 60 },
  { id: 'coz-glass', port: 'cozumel', name: 'Glass-bottom boat and town', summary: 'See the reef from a dry, level boat deck, then an hour in town.', hours: 2.5, price: 4900, activity: 'easy', wheelchair: true, family: true, interests: ['nature', 'relax'], rating: 4.4, reviews: 611, meeting: MEET_PIER, start: '13:00', capacity: 30 },
  { id: 'bze-altunha', port: 'belize', name: 'Altun Ha Mayan temples', summary: 'A coach inland to the temples, with time to climb the main pyramid.', hours: 4, price: 8500, activity: 'moderate', wheelchair: false, family: true, interests: ['culture'], rating: 4.6, reviews: 1530, meeting: MEET_TENDER, start: '08:30', capacity: 40 },
  { id: 'bze-cave', port: 'belize', name: 'Cave tubing adventure', summary: 'Float through a jungle cave on an inner tube after a walk through the forest.', hours: 6, price: 12900, activity: 'strenuous', wheelchair: false, family: false, interests: ['adventure', 'nature'], rating: 4.8, reviews: 2045, meeting: MEET_TENDER, start: '08:30', capacity: 24 },
  { id: 'bze-reef', port: 'belize', name: 'Barrier reef snorkel', summary: 'A boat to the second-largest barrier reef in the world, with gear and a guide.', hours: 4, price: 9900, activity: 'moderate', wheelchair: false, family: true, interests: ['water', 'nature'], rating: 4.7, reviews: 1178, meeting: MEET_TENDER, start: '09:00', capacity: 32 },
  { id: 'bze-walk', port: 'belize', name: 'Belize City heritage walk', summary: 'A slow guided walk past the swing bridge, the old market and the harbour.', hours: 2.5, price: 4500, activity: 'easy', wheelchair: true, family: true, interests: ['culture', 'relax'], rating: 4.3, reviews: 388, meeting: MEET_TENDER, start: '10:00', capacity: 20 },
  { id: 'rtb-zip', port: 'roatan', name: 'Zip-line canopy tour', summary: 'Ten zip lines through the rainforest canopy, with a harness fitting first.', hours: 3, price: 8900, activity: 'strenuous', wheelchair: false, family: false, interests: ['adventure', 'nature'], rating: 4.8, reviews: 1710, meeting: MEET_PIER, start: '09:00', capacity: 28 },
  { id: 'rtb-snorkel', port: 'roatan', name: 'West Bay snorkel', summary: 'Calm, clear water off a white beach, with gear and a guide.', hours: 3.5, price: 7500, activity: 'moderate', wheelchair: false, family: true, interests: ['water'], rating: 4.6, reviews: 996, meeting: MEET_PIER, start: '09:30', capacity: 36 },
  { id: 'rtb-wildlife', port: 'roatan', name: 'Wildlife and monkey park', summary: 'Sloths, monkeys and tropical birds on flat paths, with a keeper to talk to.', hours: 3, price: 6500, activity: 'easy', wheelchair: true, family: true, interests: ['nature'], rating: 4.5, reviews: 1402, meeting: MEET_PIER, start: '10:00', capacity: 40 },
  { id: 'rtb-drive', port: 'roatan', name: 'Island drive and beach stop', summary: 'A van around the island with three photo stops and half an hour on the beach.', hours: 3, price: 5500, activity: 'easy', wheelchair: true, family: true, interests: ['relax', 'culture'], rating: 4.2, reviews: 457, meeting: MEET_PIER, start: '12:30', capacity: 24 },
]

export const excursionById = (id: unknown): ExcursionItem | undefined => EXCURSIONS.find((x) => x.id === id)

/** Children under this age pay the child price. */
export const CHILD_AGE = 12
export const CHILD_SHARE = 0.7
/** Anyone under this age may only join with an adult from their party. */
export const MIN_AGE_UNACCOMPANIED = 18

/** What one guest pays. */
export const guestPrice = (x: ExcursionItem, age: number): Cents => (age < CHILD_AGE ? Math.round((x.price * CHILD_SHARE) / 100) * 100 : x.price)

/** Tours that need real fitness or sure footing have a minimum age. */
export const minAge = (x: ExcursionItem): number => (x.activity === 'strenuous' ? 12 : 0)

export interface Filter {
  port: ExcursionPort | null
  interests: Interest[]
  /** The most demanding level wanted: 'easy' shows only easy tours. */
  maxActivity: Activity | null
  /** Dollars. */
  maxPrice: number | null
  family: boolean
  accessible: boolean
}

export const NO_FILTER: Filter = { port: null, interests: [], maxActivity: null, maxPrice: null, family: false, accessible: false }

export function filterExcursions(list: readonly ExcursionItem[], f: Filter): ExcursionItem[] {
  const level = (a: Activity) => ACTIVITIES.indexOf(a)
  return list.filter(
    (x) =>
      (!f.port || x.port === f.port) &&
      (f.interests.length === 0 || f.interests.some((i) => x.interests.includes(i))) &&
      (!f.maxActivity || level(x.activity) <= level(f.maxActivity)) &&
      (f.maxPrice === null || x.price <= f.maxPrice * 100) &&
      (!f.family || x.family) &&
      (!f.accessible || x.wheelchair),
  )
}

const hash = (text: string): number => {
  let h = 5381
  for (const ch of text) h = (Math.imul(h, 33) + ch.charCodeAt(0)) >>> 0
  return h
}

/** Tours that are full on a sailing, whatever the count says: so the "sold out" state can be seen. */
const SOLD_OUT: Record<string, readonly string[]> = { 'sun-2027-03-21': ['rtb-zip'] }

/** Places left on a tour on a sailing: the same number every time, never fewer than 5 unless it is sold out. */
export function spotsLeft(x: ExcursionItem, sailingId: string, bookedHere = 0): number {
  if (SOLD_OUT[sailingId]?.includes(x.id)) return 0
  const taken = hash(`${x.id}|${sailingId}`) % (x.capacity - 4)
  return Math.max(0, x.capacity - taken - bookedHere)
}

/** The itinerary day a tour runs on. */
export const dayOf = (s: Sailing, x: ExcursionItem): ItineraryDay => itinerary(s).find((d) => d.port === x.port)!

const minutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
export const formatHours = (hours: number): string => `${hours % 1 === 0 ? hours : hours.toFixed(1)} hours`

/** Minutes a guest needs to get ashore and to the meeting point, and to get back and aboard: longer at a tender port. */
export const landingBuffer = (port: ExcursionPort): { out: number; back: number } => (PORTS[port].tender ? { out: 75, back: 90 } : { out: 30, back: 45 })

/** End of the tour in minutes after midnight, local port time. */
export const endMinutes = (x: ExcursionItem): number => minutes(x.start) + Math.round(x.hours * 60)

export type TimingProblem = 'tooEarly' | 'tooLate'

/** Whether a tour fits the ship's day: it cannot start before guests can be ashore, and must finish with time to be back before all aboard (itinerary-aware, PRE-02). */
export function timingProblem(x: ExcursionItem, day: ItineraryDay): TimingProblem | null {
  if (!day.arrive || !day.allAboard) return null
  const { out, back } = landingBuffer(x.port)
  if (minutes(x.start) < minutes(day.arrive) + out) return 'tooEarly'
  if (endMinutes(x) + back > minutes(day.allAboard)) return 'tooLate'
  return null
}

/** When the guest must be back at the landing to be safe, as "HH:MM" local port time. */
export function backBy(x: ExcursionItem, day: ItineraryDay): string {
  const t = minutes(day.allAboard ?? '23:59') - landingBuffer(x.port).back
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Two tours on the same day overlap when their hours cross. */
export function overlaps(a: ExcursionItem, b: ExcursionItem): boolean {
  return a.port === b.port && minutes(a.start) < endMinutes(b) && minutes(b.start) < endMinutes(a)
}

/** A booked tour as far as conflict checking cares. */
export interface BookedTour { excursionId: string; guests: string[] }

/** Guests on both a tour already booked and the new one, where the hours overlap. */
export function conflictingGuests(booked: readonly BookedTour[], x: ExcursionItem, guests: readonly string[]): string[] {
  const clash = new Set<string>()
  for (const b of booked) {
    const other = excursionById(b.excursionId)
    if (!other || other.id === x.id || !overlaps(other, x)) continue
    for (const g of b.guests) if (guests.includes(g)) clash.add(g)
  }
  return [...clash]
}

/** Cancelling a ship tour: free until two days before the port day, then no refund (authored; verify before real use). */
export const FREE_CANCEL_DAYS = 2

export interface TourRefund { fee: Cents; refund: Cents; free: boolean }

export function tourRefund(paid: Cents, daysToTour: number): TourRefund {
  const free = daysToTour >= FREE_CANCEL_DAYS
  return free ? { fee: 0, refund: paid, free } : { fee: paid, refund: 0, free }
}

/** Days from `today` ("YYYY-MM-DD") to the day a tour runs. */
export const daysToTour = (today: string, s: Sailing, x: ExcursionItem): number => daysBetween(today, dayOf(s, x).date)

/** The tender-port rule in words, shown on any tour at Belize City. */
export const needsTender = (x: ExcursionItem): boolean => PORTS[x.port].tender
