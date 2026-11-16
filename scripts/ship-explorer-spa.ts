// The Spa Explorer content of each ship (docs/princess-spa-casino.md): the spa, salon, thermal suite and sanctuary, the treatments that can be booked at them, and the events that run
// there (tours, seminars, port-day specials). Authored concept content; the start times and prices the doc leaves out are chosen here for review.
import type { HoursRule } from '../src/domain/explorer/types.ts'
import type { ExplorerEventRow, ExplorerVenueRow, SpaTreatmentRow } from './ship-explorer-data.ts'

/** The spa is open 8 am to 10 pm every day of the cruise, from 11:30 on embarkation day (the guided tours run first); closed on the morning of disembarkation. */
const SPA_HOURS: HoursRule[] = [
  { kind: 'fixed', when: ['embark'], windows: [['11:30', '22:00']] },
  { kind: 'fixed', when: ['night'], windows: [['08:00', '22:00']] },
]
const SANCTUARY_HOURS: HoursRule[] = [{ kind: 'fixed', when: ['night'], windows: [['08:00', '18:00']] }]

interface ShipSpa {
  /** '' for Sun Princess, 'sky-' or 'sapphire-' for the others, so a venue or treatment id names its ship. */
  prefix: string
  lotusDeck: string
  salonDeck: string
  /** Sapphire has a classic thermal suite on Deck 15 in place of the Enclave. */
  thermal: { key: 'enclave' | 'thermal'; title: string; deck: string; short: string; long: string }
  sanctuary: { title: string; deck: string; short: string; long: string }
}

const SHIPS: Record<string, ShipSpa> = {
  'sun-princess': {
    prefix: '', lotusDeck: 'Decks 5 and 6 forward', salonDeck: 'Deck 6 forward',
    thermal: { key: 'enclave', title: 'The Enclave Thermal Suite', deck: 'Deck 5 forward', short: 'A paid-access hydrotherapy and thermal sanctuary with a Himalayan Salt Room.',
      long: 'A warm hydrotherapy pool with cascading rain showers and air jets, heated ceramic loungers, a Turkish hammam, an aromatic herbal steam room, a dry Finnish sauna and, on Sun Princess, a Himalayan Salt Room and sensory experience showers. A thermal pass is about $149 to $199 a week, or a session can be booked here.' },
    sanctuary: { title: 'Sanctuary Club', deck: 'Deck 18 forward', short: 'The adults-only sun deck for Sanctuary Collection guests, with an infinity pool and private bar.',
      long: 'Reserved for Sanctuary Collection suite and stateroom guests: an infinity pool, a private bar and live DJ chill sessions on the top deck. Weather permitting.' },
  },
  'sky-princess': {
    prefix: 'sky-', lotusDeck: 'Deck 5 forward', salonDeck: 'Deck 5 forward',
    thermal: { key: 'enclave', title: 'The Enclave Thermal Suite', deck: 'Deck 5 forward', short: 'A paid-access hydrotherapy and thermal sanctuary.',
      long: 'A warm hydrotherapy pool with cascading rain showers and air jets, heated ceramic loungers, a Turkish hammam, an aromatic herbal steam room and a dry Finnish sauna. A thermal pass is about $149 to $199 a week, or a session can be booked here.' },
    sanctuary: { title: 'The Sanctuary', deck: 'Deck 17 forward', short: 'An adults-only (18+) open-air retreat with teak loungers and steward service.',
      long: 'A tranquil adults-only retreat with thick-cushioned teak loungers, chilled face towels, misters and light healthy fare, with outdoor massage cabanas. Half a day is $20 and a full day $40. Weather permitting.' },
  },
  'sapphire-princess': {
    prefix: 'sapphire-', lotusDeck: 'Deck 15 forward', salonDeck: 'Deck 15 forward',
    thermal: { key: 'thermal', title: 'Thermal Suite', deck: 'Deck 15', short: 'A classic thermal suite with heated tile beds and aroma steam rooms.',
      long: 'Sapphire Princess has no Enclave. Its Lotus Spa Thermal Suite on Deck 15 has heated tile beds and aroma steam rooms, and the locker rooms have complimentary dry saunas and steam rooms.' },
    sanctuary: { title: 'The Sanctuary', deck: 'Deck 16 forward', short: 'An adults-only (18+) open-air retreat with teak loungers and steward service.',
      long: 'A tranquil adults-only retreat with thick-cushioned teak loungers, chilled face towels, misters and light healthy fare, with outdoor massage cabanas. Half a day is $20 and a full day $40. Weather permitting.' },
  },
}

const venueId = (s: ShipSpa, key: string) => `${s.prefix}${key}`

/** The spa venues of a ship, numbered from `firstOrder`. */
export function spaVenues(shipId: string, firstOrder: number): ExplorerVenueRow[] {
  const s = SHIPS[shipId]
  const base = { bookable: 'none' as const, features: [] as string[], accessibility: [] as string[] }
  return [
    { ...base, id: venueId(s, 'lotus'), explorer: 'spa', kind: 'spa', title: 'Lotus Spa', placeId: 'lotus', deckLabel: s.lotusDeck, hours: SPA_HOURS, bookable: 'spa', order: firstOrder,
      short: 'Massages, facials, acupuncture and medi-spa treatments, run with OneSpaWorld.',
      long: 'The ship’s wellness sanctuary: bamboo and hot-stone massages, ELEMIS Pro-Collagen facials, seaweed wraps, acupuncture and physician-administered medi-spa services. On embarkation day the spa opens with guided tours.',
      minAge: 16, features: ['Appointments', 'Adults 18+ for most treatments; facials from 16'], accessibility: ['Step-free from the lifts'] },
    { ...base, id: venueId(s, 'salon'), explorer: 'spa', kind: 'salon', title: 'Lotus Salon and Barber', placeId: 'salon', deckLabel: s.salonDeck, hours: SPA_HOURS, bookable: 'spa', order: firstOrder + 1,
      short: 'Hair, nails, barber shaves and teeth whitening.',
      long: 'Hair styling, keratin treatments, barber shaves, manicures, pedicures and teeth whitening, next to the Lotus Spa. Formal-night updos and blowouts book up early.',
      features: ['Appointments'], accessibility: ['Step-free from the lifts'] },
    { ...base, id: venueId(s, s.thermal.key), explorer: 'spa', kind: 'thermal', title: s.thermal.title, placeId: 'lotus', deckLabel: s.thermal.deck, hours: SPA_HOURS, bookable: 'spa', order: firstOrder + 2,
      short: s.thermal.short, long: s.thermal.long, minAge: 18, features: ['Sessions or a weekly pass', 'Adults 18+'], accessibility: [] },
    { ...base, id: venueId(s, 'sanctuary'), explorer: 'spa', kind: 'sanctuary', title: s.sanctuary.title, placeId: 'lotus', deckLabel: s.sanctuary.deck, hours: SANCTUARY_HOURS, order: firstOrder + 3,
      short: s.sanctuary.short, long: s.sanctuary.long, minAge: 18, features: ['Adults 18+', 'Weather permitting'], accessibility: [] },
  ]
}

const PORT = ['port']

/** The treatments of a ship: prices are cents per person, `rooms` is how many can be given at the same time. */
export function spaTreatments(shipId: string): SpaTreatmentRow[] {
  const s = SHIPS[shipId]
  const lotus = venueId(s, 'lotus')
  const salon = venueId(s, 'salon')
  const thermal = venueId(s, s.thermal.key)
  const every = ['night']
  const row = (key: string, venue: string, title: string, detail: string, minutes: number, price: number, rooms: number, minAge?: number, when: string[] = every): SpaTreatmentRow =>
    ({ id: `${s.prefix}${key}`, venueId: venue, title, detail, minutes, price, rooms, when, ...(minAge !== undefined ? { minAge } : {}) })
  return [
    row('swedish', lotus, 'Swedish massage', '50 minutes, light to medium pressure.', 50, 13_900, 4, 18),
    row('hotstone', lotus, 'Hot stone massage', '75 minutes with warmed basalt stones.', 75, 18_900, 3, 18),
    row('facial', lotus, 'ELEMIS Pro-Collagen facial', '50 minutes. Please tell us about allergies when you book.', 50, 12_900, 4, 16),
    row('acupuncture', lotus, 'Acupuncture', '30 minutes for pain and stress relief, with a short consultation.', 30, 9_900, 1, 18),
    row('couples', lotus, 'Twilight couples massage', '60 minutes side by side. Book for two.', 60, 15_900, 2, 18),
    row('port-special', lotus, 'Port-day top-to-toe mini treatment', '45 minutes of back and shoulders, a mini facial and a scalp massage, while most guests are ashore.', 45, 9_900, 6, 18, PORT),
    row('cut', salon, 'Haircut and style', '45 minutes.', 45, 6_500, 3),
    row('manicure', salon, 'Manicure', '40 minutes.', 40, 4_500, 3),
    row('blowout', salon, 'Blowout or formal-night updo', '45 minutes.', 45, 5_500, 3),
    row('shave', salon, 'Barber shave', '30 minutes with a hot towel.', 30, 4_000, 2, 16),
    row('whitening', salon, 'Teeth whitening', '60 minutes.', 60, 19_900, 1, 18),
    row(s.thermal.key === 'enclave' ? 'enclave-session' : 'thermal-session', thermal, `${s.thermal.title.replace(/^The /, '')} session`, '2 hours in the thermal suite, towels and robe included.', 120, s.thermal.key === 'enclave' ? 4_500 : 3_500, 12, 18),
  ]
}

const ev = (id: string, venue: string, when: string[], start: string, minutes: number, title: string, detail: string, o: Partial<ExplorerEventRow> = {}): ExplorerEventRow =>
  ({ id, venueId: venue, when, start, minutes, title, detail, age: 'adults', interest: 'wellness', extra: 0, ...o })

/** The spa events of a ship, from the doc's seven-day week. */
export function spaEvents(shipId: string): ExplorerEventRow[] {
  const s = SHIPS[shipId]
  const lotus = venueId(s, 'lotus')
  const salon = venueId(s, 'salon')
  const thermal = venueId(s, s.thermal.key)
  const sanctuary = venueId(s, 'sanctuary')
  return [
    ev(`tour-${lotus}`, lotus, ['embark'], '11:30', 30, 'Spa and thermal suite guided tour', 'See the treatment rooms and the thermal suite, and sign up for the sailaway raffle.', { age: 'all' }),
    ev(`raffle-${lotus}`, lotus, ['embark'], '16:30', 30, 'Sailaway spa raffle', 'Win up to $500 in spa treatments. You must be present to win.'),
    ev(`evening-${lotus}`, lotus, ['embark'], '20:00', 90, 'Evening sailaway massage and facial specials', 'Special prices on massages and facials, booked at the spa desk.'),
    ev(`posture-${lotus}`, lotus, ['firstSea'], '10:00', 45, 'Good feet and posture analysis seminar', 'A free analysis and talk with a spa specialist.', { age: 'all' }),
    ev(`acu-${lotus}`, lotus, ['firstSea'], '14:00', 30, 'Acupuncture for pain and stress relief', 'A free consultation with the ship’s acupuncturist.'),
    ev(`updo-${salon}`, salon, ['firstSea'], '19:00', 120, 'Formal-night updo, blowout and barber shave express', 'Express appointments before the formal dinner.', { extra: 5_500 }),
    ev(`special-${lotus}`, lotus, PORT, '09:00', 45, 'Port-day mini-treatment special', 'A short treatment at a special price while most guests are ashore. Book it from this page.', { extra: 9_900 }),
    ev(`quiet-${thermal}`, thermal, PORT, '13:00', 180, 'Quiet port-day hydrotherapy hours', 'Three quiet afternoon hours in the thermal suite while the ship is alongside.', { extra: 4_500 }),
    ev(`medi-${lotus}`, lotus, ['portEven'], '14:00', 45, 'Medi-spa wrinkle and facial rejuvenation seminar', 'A free talk with the medi-spa physician.', { age: 'all' }),
    ev(`reflex-${lotus}`, lotus, ['portEven'], '21:00', 45, 'After-dinner foot and ankle reflexology', 'A relaxing evening reflexology session.', { extra: 6_500 }),
    ev(`couples-${thermal}`, thermal, ['earlyPortOdd'], '20:30', 90, 'Twilight couples massage and thermal suite experience', 'A couples massage followed by the thermal suite.', { extra: 19_900, capacity: 6 }),
    ev(`sampler-${lotus}`, lotus, ['lastPort'], '09:30', 60, 'Port-day 20/20/20 sampler: back massage, mini-facial and scalp massage', 'Three short treatments in one visit. Book it from this page.', { extra: 12_900 }),
    ev(`formal-${salon}`, salon, ['lastPort'], '15:00', 120, 'Formal-night express hair and makeup appointments', 'Express appointments before the second formal dinner.', { extra: 5_500 }),
    ev(`detox-${lotus}`, lotus, ['seaMid'], '11:00', 45, 'Detox for health and weight loss seminar', 'A free seminar with a spa specialist.', { age: 'all' }),
    ev(`night-${thermal}`, thermal, ['seaMid'], '20:00', 120, 'Private thermal suite night pass', 'The thermal suite after dinner, with a smaller crowd.', { extra: 4_900, capacity: 12 }),
    ev(`checkin-${sanctuary}`, sanctuary, ['portEven'], '10:00', 30, 'Morning lounger check-in', 'Reserve your lounger for the day with the steward.'),
    ev(`sale-${lotus}`, lotus, ['last'], '10:00', 120, 'Last-day ELEMIS skincare sale', 'Up to 25% off skincare products at the spa.', { age: 'all' }),
  ]
}
