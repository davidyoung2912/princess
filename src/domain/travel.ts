import type { Cents } from './pricing'

/** Travel to the port (MNG-10): port facts, parking, hotels, ways to get there and an arrival window. Prices and places are authored concept values (verify before real use). */
export const PORT_FACTS = {
  name: 'Port Everglades, Fort Lauderdale',
  address: '1850 Eller Drive, Fort Lauderdale, Florida',
  airport: 'Fort Lauderdale–Hollywood International Airport (FLL), about 5 miles away',
  terminal: 'Terminal 2 is the usual terminal for Sun Princess. Your terminal is confirmed at check-in.',
  boarding: 'Boarding opens at 11:00 AM. The ship sails at 3:00 PM, and the gangway closes 90 minutes before that.',
  porters: 'Porters at the curb take your checked bags to your stateroom. A tip of $2 to $5 a bag is usual.',
} as const

export type ModeId = 'drive' | 'transfer' | 'rideshare' | 'shuttle'
export const MODES: readonly ModeId[] = ['drive', 'transfer', 'rideshare', 'shuttle']

export interface Mode {
  id: ModeId
  name: string
  blurb: string
  /** Rough cost, as a guide only. */
  cost: string
  /** Good for a guest who cannot manage steps or long walks. */
  stepFree: boolean
}

export const TRANSPORT: Record<ModeId, Mode> = {
  drive: { id: 'drive', name: 'Drive and park', blurb: 'Park in the terminal garage and walk across a covered bridge. Drop your bags with the porters before you park.', cost: 'About $20 a day to park', stepFree: true },
  transfer: { id: 'transfer', name: 'Cruise transfer from the airport', blurb: 'A coach from the airport to the terminal, booked with your cruise. Wheelchair-accessible coaches need a day’s notice.', cost: 'About $26 each way, per person', stepFree: true },
  rideshare: { id: 'rideshare', name: 'Taxi or ride-share', blurb: 'About 15 minutes from the airport. Ask for the cruise terminal and give the terminal number.', cost: 'About $25 to $35 for the car', stepFree: false },
  shuttle: { id: 'shuttle', name: 'Hotel shuttle', blurb: 'Several nearby hotels run a free or low-cost shuttle to the terminal on sailing day. Ask when you book.', cost: 'Free to about $10 each', stepFree: false },
}

export interface Hotel {
  id: string
  name: string
  blurb: string
  /** Per night, a guide. */
  rate: Cents
  shuttle: boolean
  stepFree: boolean
}

export const HOTELS: readonly Hotel[] = [
  { id: 'seabreeze', name: 'Seabreeze Airport Inn', blurb: 'Two miles from the airport, with a free airport pickup and a shuttle to the port on sailing day.', rate: 15900, shuttle: true, stepFree: true },
  { id: 'harbour', name: 'Harbour Palms Suites', blurb: 'Large rooms with a kitchen, 10 minutes from the terminal, with a pool.', rate: 18900, shuttle: true, stepFree: true },
  { id: 'beachside', name: 'Beachside Courtyard', blurb: 'A short drive from the port, a walk to the sand and restaurants. Parking is extra.', rate: 21900, shuttle: false, stepFree: false },
]

export interface Window {
  /** Start time, "HH:MM". */
  start: string
  end: string
  crowd: 'quiet' | 'busy' | 'busiest'
}

const slots: [string, string, Window['crowd']][] = [
  ['10:30', '11:00', 'quiet'],
  ['11:00', '11:30', 'quiet'],
  ['11:30', '12:00', 'busy'],
  ['12:00', '12:30', 'busiest'],
  ['12:30', '13:00', 'busiest'],
  ['13:00', '13:30', 'busy'],
]

/** The arrival windows. Priority guests (Platinum, Elite, Sanctuary suites) may also arrive at 10:30; everyone else starts at 11:00. */
export function arrivalWindows(priority: boolean): Window[] {
  return slots.filter(([s]) => priority || s !== '10:30').map(([start, end, crowd]) => ({ start, end, crowd }))
}

export const isWindow = (start: unknown, priority: boolean): start is string => typeof start === 'string' && arrivalWindows(priority).some((w) => w.start === start)
export const isMode = (v: unknown): v is ModeId => MODES.includes(v as ModeId)

/** The window we suggest: the quietest one that is not first thing, for a first-time guest; the first one for a priority guest. */
export function suggestedWindow(priority: boolean): string {
  return priority ? '10:30' : '11:00'
}

export interface TravelPlan {
  window: string | null
  mode: ModeId | null
  /** Staying the night before. */
  hotel: string | null
}

export const EMPTY_PLAN: TravelPlan = { window: null, mode: null, hotel: null }

export function normalizePlan(raw: unknown, priority: boolean): TravelPlan {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    window: isWindow(o.window, priority) ? o.window : null,
    mode: isMode(o.mode) ? o.mode : null,
    hotel: typeof o.hotel === 'string' && HOTELS.some((h) => h.id === o.hotel) ? o.hotel : null,
  }
}

export const planStarted = (p: TravelPlan): boolean => p.window !== null
