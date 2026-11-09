// Test support only. One signed-in person with a booking, aboard on day 3, as the server would describe them. Typed against the API types where the
// type is small; the rest are checked by the app's own guards when a screen reads them. Times are on the server clock `NOW`.
import type { BoardingView, DiningView, ExcursionsView, FamilyView, FolioView, OnboardToday, OrderMenuView, PackagesView, ProgramView, TripsView } from '../api/types'
import fixture from './reference-fixture.json'

/** 3:00 pm UTC on 2 March 2027: day 3 of the 28 February sailing. */
export const NOW = Date.UTC(2027, 2, 2, 15, 0)
export const SAILING = 'sun-2027-02-28'
export const BOOKING = 'B1'
const P = 'u1'
const TRIP = `/bookings/${BOOKING}`

export const SESSION = {
  accessToken: 'a', expiresAt: NOW + 900_000, refreshToken: 'r', refreshExpiresAt: NOW + 9e8,
  user: { id: P, accountNumber: '1234567890', email: 'tess@example.com', firstName: 'Tess', lastName: 'Tester', role: 'guest', tier: 'none', isDemo: false },
}

export const CONTEXT = {
  person: { id: P, name: 'Tess Tester', firstName: 'Tess', age: 40, child: false, booker: P, tier: 'none' },
  party: [{ id: P, name: 'Tess Tester', firstName: 'Tess', age: 40, child: false, booker: P, tier: 'none' }],
  booking: { number: BOOKING, sailingId: SAILING, package: 'plus', category: 'balcony' },
  sailingId: SAILING, phoneZone: null, isDemo: false, nowMs: NOW,
}

export const TRIPS = {
  upcoming: [{
    number: BOOKING, kind: 'current', sailingId: SAILING, departure: '2027-02-28', categoryName: 'Balcony', guests: 1, daysToDeparture: -2,
    plan: { total: 250_000, deposit: 50_000, balance: 200_000, finalDue: '2027-01-13', booked: '2026-10-01' }, payment: 'paid',
    documents: { guests: 1, missing: 0, passportProblems: 0 }, checkin: { state: 'done', opensAt: NOW - 9e8, closesAt: NOW - 8e8 },
  }],
  past: [],
} as unknown as TripsView

export const BOARDING = {
  number: BOOKING, departure: '2027-02-28', checkinDone: true, lane: 'green', terminal: { name: 'Terminal 2' },
  arrival: { id: 'w3', label: '12:30 pm to 1:00 pm', start: '12:30', end: '13:00' }, waitMinutes: 10,
  passes: [{ id: P, name: 'Tess Tester', printed: 'TESTER/TESS', seq: 1, ready: true, code: 'PRN|B1|1', cabin: '8412', deck: 8, muster: 'C', group: '4' }],
  inWallet: false, issuedAt: NOW,
} as unknown as BoardingView

export const TODAY = {
  aboard: true, day: 3, date: '2027-03-02', port: 'belize', shipZone: 'America/New_York',
  weather: { summary: 'Sunny', highF: 86, lowF: 77, sea: 'Light breeze, calm sea.' },
  portDay: null, muster: { required: false, done: true, at: NOW - 2 * 86_400_000 }, sailAwayAt: null, changes: false, clockChange: null,
} as unknown as OnboardToday

const event = (id: string, start: string, title: string, placeId: string) => ({
  id, days: [3], start, minutes: 45, title, placeId, age: 'all', interest: 'music', extra: 0, day: 3, date: '2027-03-02',
  startAt: NOW, endAt: NOW + 2_700_000, status: 'on',
})
export const PROGRAM = {
  day: 3, date: '2027-03-02', port: 'belize', mine: ['stage-show'], changed: false, canEdit: true,
  events: [event('trivia', '14:00', 'Team trivia', 'piazza'), event('stage-show', '20:30', 'Broadway at sea', 'theatre')],
} as unknown as ProgramView

export const DINING = {
  window: 'open', plan: 'anytime', seating: null, mealsLeft: 3, canBook: true, daysToDeparture: -2,
  party: [{ id: P, name: 'Tess Tester', age: 40, child: false }],
  reservations: [{ id: 'r1', venueId: 'crown', day: 4, time: '19:00', guests: [P], note: '', dietary: [], covered: [P], charge: 0, at: NOW - 86_400_000, reminderOn: '2027-03-03' }],
} as unknown as DiningView

export const FOLIO = {
  lines: [
    { id: 'f1', day: 2, at: NOW - 86_400_000, category: 'drinks', description: 'Bar tab, Lido', guest: P, cents: 1_450 },
    { id: 'f2', day: 3, at: NOW - 3_600_000, category: 'spa', description: 'Massage', guest: P, cents: 14_900 },
    { id: 'f3', day: 3, at: NOW - 7_200_000, category: 'dining', description: 'Dinner, Crown Grill', guest: P, cents: 0, value: 4_500, coveredBy: 'package' },
  ],
  totals: { charges: 16_350, credits: 0, covered: 4_500, balance: 16_350, pending: 0 }, guests: [{ id: P, name: 'Tess Tester' }], throughDay: 3,
} as unknown as FolioView


const BELIZE = fixture.excursions.find((e) => e.port === 'belize') ?? fixture.excursions[0]
export const EXCURSIONS = {
  offers: [{ item: BELIZE, date: '2027-03-02', day: 3, spots: 12, timing: null, backBy: '14:00', daysToTour: 0, tender: true }],
  booked: [], cart: [], cartTotal: 0, creditLeft: 30_000, creditApplied: 0, party: [{ id: P, name: 'Tess Tester', age: 40, child: false }], canBook: true, daysToDeparture: -2,
} as unknown as ExcursionsView

export const PACKAGES = {
  addOns: [{ id: 'drinks', unit: 'personNight', price: 6_500, base: 6_500, changeOn: '2027-02-20', changesTo: 6_500, eligible: [{ id: P, name: 'Tess Tester', age: 40, child: false }] }, { id: 'wifi', unit: 'personNight', price: 1_800, base: 1_800, changeOn: '2027-02-20', changesTo: 1_800, eligible: [{ id: P, name: 'Tess Tester', age: 40, child: false }] }],
  upgrades: [{ guest: P, name: 'Tess Tester', from: 'plus', options: [{ to: 'premier', price: 3_500, changeOn: '2027-02-20', changesTo: 3_500 }] }],
  purchases: [], credit: { total: 30_000, used: 0, remaining: 30_000 }, party: [{ id: P, name: 'Tess Tester', age: 40, child: false }], daysToDeparture: -2, canBuy: true, window: { from: '2027-03-01', until: '2027-03-08', status: 'active' },
  people: [{ id: P, name: 'Tess Tester', package: 'plus', entitlements: { drinkCapUsd: 15, wifiDevices: 1, specialtyMeals: 4, excursionCreditUsd: 0, gratuitiesIncluded: true, diningWindow: 'afterFullPayment', perks: [] },
    balances: { specialtyMeals: { total: 4, used: 1, remaining: 3 }, wifiDevices: { total: 1, used: 0, remaining: 1 }, excursionCreditUsd: { total: 0, used: 0, remaining: 0 } } }],
} as unknown as PackagesView

export const FAMILY = {
  kids: [{ id: 'k1', name: 'Sam Tester', age: 9, club: { id: 'camp', name: 'Camp Discovery', open: true, opens: '09:00', closes: '22:00' }, inClub: { clubId: 'camp', at: NOW - 600_000 },
    seen: { placeId: 'camp', at: NOW - 600_000, source: 'club' }, status: 'inClub', zones: ['camp', 'lido-pool'], auth: { pickup: [P], signOutAlone: false, photos: false }, canCheckOut: true }],
  adults: [{ id: P, name: 'Tess Tester' }], reunion: { placeId: 'guest-services', backupId: 'piazza', note: '' }, log: [], canEdit: true,
} as unknown as FamilyView

export const ORDER_MENU = {
  open: true, outOfStock: [], guests: [{ id: P, name: 'Tess Tester', age: 40, drinkCapUsd: 15 }], cabin: '8412', deck: 8, mornings: [], isolating: false, canOrder: true,
} as unknown as OrderMenuView

/** A port day with the all-aboard moment 90 minutes ahead (a busy afternoon in Belize). */
export const PORT_DAY = {
  day: 3, port: 'belize', date: '2027-03-02', allAboardShip: '4:30 pm', allAboardLocal: '3:30 pm', allAboardAt: NOW + 90 * 60_000, arriveAt: NOW - 6 * 3_600_000, departAt: NOW + 120 * 60_000,
  shipZone: 'America/New_York', portZone: 'America/Belize', tender: true,
  state: { at: NOW + 90 * 60_000, minutesLeft: 90, level: 'info', reminders: [120], nextReminder: 60 },
}
export const TODAY_IN_PORT = { ...TODAY, portDay: PORT_DAY } as unknown as OnboardToday

export const EMERGENCY = {
  guest: 'Tess Tester', stateroom: '8412', deck: 8, muster: 'C', musterPlace: null,
  contacts: [{ id: 'bridge', name: 'Medical emergency', number: '911', note: 'From a ship phone' }], script: 'This is a medical emergency. Stateroom 8412.',
}

/** What the stubbed server knows. Keys are paths after `/api/v1`. */
export const SERVER = {
  'POST /auth/login': SESSION,
  '/me/context': CONTEXT,
  '/trips': TRIPS,
  [`${TRIP}/boarding`]: BOARDING,
  [`${TRIP}/onboard/today`]: TODAY,
  [`${TRIP}/onboard/program/3`]: PROGRAM,
  [`${TRIP}/onboard/folio`]: FOLIO,
  [`${TRIP}/dining`]: DINING,
  [`${TRIP}/excursions`]: EXCURSIONS,
  [`${TRIP}/packages`]: PACKAGES,
  [`${TRIP}/family`]: FAMILY,
  [`${TRIP}/orders/menu`]: ORDER_MENU,
  [`${TRIP}/orders`]: [],
  [`${TRIP}/onboard/emergency`]: EMERGENCY,
}
