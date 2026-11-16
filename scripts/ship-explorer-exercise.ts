// The Exercise Explorer content of each ship (docs/princess-exercise.md): the gym, studios, courts, tracks and pools, and the classes and sports that run there. The doc gives a
// 7-day calendar with a start time for most items; the lengths, capacities and the few missing times are authored here for review. Boutique studio classes are $30 for about 30 minutes
// and are signed up for at the fitness desk (the doc says embarkation day), so they carry a price and a limited number of places.
//
// The doc's week maps onto day kinds as in the Entertainment content: Day 1 `embark`, Day 2 `firstSea`, Day 3 `earlyPortOdd`, Day 6 `lastPort`, Day 4 `portEven`, Day 5 `laterSea`, Day 7 `last`.
import type { HoursRule } from '../src/domain/explorer/types.ts'
import type { ExplorerEventRow, ExplorerVenueRow } from './ship-explorer-data.ts'

/** Open round the clock; staff are on duty during the day. */
const gymHours = (staffed: [string, string]): HoursRule[] => [{ kind: 'fixed', when: ['night'], windows: [['00:00', '24:00']], staffed: [staffed] }]
const daily = (from: string, to: string): HoursRule[] => [{ kind: 'fixed', when: ['night'], windows: [[from, to]] }]

type Kind = 'gym' | 'studio' | 'court' | 'track' | 'pool'
type Key = 'gym' | 'studio' | 'court' | 'track' | 'pool' | 'green'

interface VenueSpec { key: Key; kind: Kind; title: string; deck: string; short: string; long: string; hours: HoursRule[]; minAge?: number; features?: string[]; accessibility?: string[] }

const STEP_FREE = ['Step-free from the lifts']
const OUTDOOR = ['Outdoors, weather permitting']

interface ShipSpec {
  prefix: string
  venues: VenueSpec[]
  /** Where each kind of event runs on this ship; a ship without a place for it leaves the event out. */
  at: { yoga: Key; walk: Key; putting: Key | null; swim: Key | null; poolside: Key | null; sports: Key }
  puttingTitle: string
}

const SHIPS: Record<string, ShipSpec> = {
  'sun-princess': {
    prefix: 'fit-', puttingTitle: 'Shuffleboard and ping pong challenge',
    at: { yoga: 'pool', walk: 'court', putting: 'court', swim: 'pool', poolside: 'pool', sports: 'court' },
    venues: [
      { key: 'gym', kind: 'gym', title: 'Lotus Fitness Center', deck: 'Deck 18 midship', hours: gymHours(['07:00', '20:00']), short: 'A 24-hour ocean-view gym with Precor cardio and strength equipment.',
        long: 'Overlooking the main Lido pool deck through floor-to-ceiling windows, this complimentary gym has Precor treadmills with personal screens, ellipticals, adaptive motion trainers, bikes, free weights, kettlebells, a Smith machine and a Total Gym Elevate core station. The doors stay unlocked all day and night, and fitness staff are on duty from 7 am to 8 pm.',
        features: ['Included', 'Open 24 hours'], accessibility: STEP_FREE },
      { key: 'studio', kind: 'studio', title: 'Fitness and Wellness Studios', deck: 'Deck 18 midship', hours: daily('07:00', '20:00'), short: 'Two studios next to the gym for group classes and recovery.',
        long: 'The Fitness Studio hosts Xponential Fitness classes (Pure Barre, YogaSix, Club Pilates, CycleBar and StretchLab) during scheduled blocks. The Wellness Studio next door has zero-gravity chairs, personal training and metabolic assessments by appointment. Closed overnight outside scheduled sessions.',
        features: ['Free classes and $30 boutique classes'], accessibility: STEP_FREE },
      { key: 'court', kind: 'court', title: 'SkyDeck Sport Court and Track', deck: 'Deck 19 aft', hours: daily('08:00', '20:00'), short: 'An open-air multi-sport court inside an elevated running track.',
        long: 'A 240-metre (790-foot) jogging track, where about 6.7 laps make a mile, circles a court set up for basketball, pickleball, tennis, ping pong and shuffleboard. The track can be walked at any hour, but running and court play stop at 8 pm so the noise does not carry to the decks below.',
        features: ['Included', ...OUTDOOR] },
      { key: 'pool', kind: 'pool', title: 'The Dome and Lido Pools', deck: 'Decks 17 and 18', hours: daily('06:00', '22:00'), short: 'Glass-enclosed and open-air pools for lap swimming and morning yoga.',
        long: 'The main Lido pools open at 6 am and close at 10 pm; The Dome is open from 7 am to 11 pm. Swim tethers for stationary endurance swimming can be checked out during pool hours, and select morning YogaSix sessions are held in The Dome before the lounge fills. The pools close overnight for netting and maintenance.',
        features: ['Included', 'Swim tethers on loan'], accessibility: STEP_FREE },
    ],
  },
  'sky-princess': {
    prefix: 'sky-fit-', puttingTitle: 'Putting competition at The Greens',
    at: { yoga: 'studio', walk: 'court', putting: 'green', swim: 'pool', poolside: 'pool', sports: 'court' },
    venues: [
      { key: 'gym', kind: 'gym', title: 'Fitness Center', deck: 'Deck 17 aft', hours: gymHours(['07:00', '19:30']), short: 'A large aft-facing gym with cardio machines and weight stations, open 24 hours.',
        long: 'At the rear of the Sun Deck, this complimentary gym has treadmills, ellipticals, stationary bikes, resistance machines and a free-weight area. The doors stay unlocked all day and night, and the staffed desk is open from 7 am to 7:30 pm.',
        features: ['Included', 'Open 24 hours'], accessibility: STEP_FREE },
      { key: 'studio', kind: 'studio', title: 'Aerobics Studio', deck: 'Deck 17 aft', hours: daily('07:00', '19:30'), short: 'The enclosed group exercise room for cycling, barre, yoga and stretching.',
        long: 'Open during staffed hours for indoor cycling (CycleBar), Pure Barre, YogaSix and StretchLab sessions, next to the gym.', features: ['Free classes and $30 boutique classes'], accessibility: STEP_FREE },
      { key: 'court', kind: 'court', title: 'Centre Court and Jogging Track', deck: 'Deck 18 aft', hours: daily('08:00', '20:00'), short: 'A fenced rooftop court surrounded by an outdoor walking and running loop.',
        long: 'On the Sports Deck above the aft gym, Centre Court hosts pick-up games and tournaments for basketball, pickleball, volleyball, tennis and badminton. Walkers can use the loop at any hour; running and ball games stop at 8 pm so the cabins on Deck 17 are not disturbed.',
        features: ['Included', ...OUTDOOR] },
      { key: 'green', kind: 'court', title: 'The Greens', deck: 'Deck 19 aft', hours: daily('08:00', '20:00'), short: 'A rooftop miniature golf putting green for gentle, low-impact play.',
        long: 'The highest aft deck, overlooking the sports court. Putters and balls are on loan from the Sports Desk until dusk, and there are scheduled putting competitions.', features: ['Included', ...OUTDOOR] },
      { key: 'pool', kind: 'pool', title: 'Sky Pool and Fountain Pool', deck: 'Deck 16 midship', hours: daily('06:00', '22:00'), short: 'The two Lido pools, open early for lap swimming and used for poolside fitness.',
        long: 'The Sky Pool and the Fountain Pool sit mid-ship on the Lido deck. Open lap swimming runs in the middle of the day on port days, and poolside dance and Zumba fitness take over a pool deck on sea days. Pools close at 10 pm.', features: ['Included', 'Open to all ages'], accessibility: STEP_FREE },
    ],
  },
  'sapphire-princess': {
    prefix: 'sapphire-fit-', puttingTitle: 'Lawn Court putting and croquet tournament',
    at: { yoga: 'studio', walk: 'track', putting: 'court', swim: 'pool', poolside: null, sports: 'court' },
    venues: [
      { key: 'gym', kind: 'gym', title: 'Lotus Spa Fitness Center', deck: 'Deck 15 forward', hours: gymHours(['07:00', '19:30']), short: 'A bow-facing gym with 35 cardio machines and 17 weight stations.',
        long: 'Next to the Lotus Spa at the front of the Sun Deck, with forward ocean views, Precor treadmills, ellipticals, bikes, a rowing machine, cable machines and free weights. The floor is open 24 hours, but treadmills may be roped off from 8 pm to 8 am on some sailings because staterooms are directly below. The staffed desk is open from 7 am to 7:30 pm.',
        features: ['Included', 'Open 24 hours'], accessibility: STEP_FREE },
      { key: 'studio', kind: 'studio', title: 'Spin and Aerobics Studio', deck: 'Deck 15 forward', hours: daily('07:00', '19:30'), short: 'Twelve indoor cycling bikes and floor space for mat classes.',
        long: 'Beside the gym, for CycleBar, Pilates, yoga and boot camp classes during staffed hours.', features: ['Free classes and $30 boutique classes'], accessibility: STEP_FREE },
      { key: 'track', kind: 'track', title: 'Promenade and Sun Deck Tracks', deck: 'Decks 7 and 15', hours: gymHours(['08:00', '20:00']), short: 'A wrap-around teak promenade and an upper-deck loop for walking and jogging.',
        long: 'Deck 7 has the classic wrap-around promenade, where 2.5 laps make a mile. Because the cabins are directly below, jogging is only allowed from 8 am to 8 pm, while quiet walking is welcome day and night. A second loop on the upper deck is open in daylight.',
        features: ['Included', 'Walking at any hour', ...OUTDOOR] },
      { key: 'court', kind: 'court', title: 'Center Court and Lawn Court', deck: 'Decks 16 and 17 aft', hours: daily('08:00', '20:00'), short: 'Upper-deck courts for basketball, paddle tennis, golf putting and croquet.',
        long: 'Center Court is a netted multi-sport arena for basketball, soccer and paddle tennis. The Lawn Court nearby on Deck 17 is synthetic grass for golf putting and lawn games. Closed overnight.', features: ['Included', ...OUTDOOR] },
      { key: 'pool', kind: 'pool', title: 'Lotus Spa Lap Pool', deck: 'Deck 15 forward', hours: daily('06:00', '22:00'), minAge: 18, short: 'An adults-only resistance pool with a swim-against-the-current jet.',
        long: 'Just outside the fitness centre, opening at 6 am for early swimmers. An adjustable current lets you swim continuous freestyle laps without turning. Closed overnight for maintenance.', features: ['Adults 18+', 'Included'] },
    ],
  },
}

const idOf = (s: ShipSpec, key: string) => `${s.prefix}${key}`

/** The exercise venues of a ship, numbered from `firstOrder`. */
export function exerciseVenues(shipId: string, firstOrder: number): ExplorerVenueRow[] {
  const s = SHIPS[shipId]
  return s.venues.map((v, i) => ({
    id: idOf(s, v.key), explorer: 'exercise', kind: v.kind, title: v.title, short: v.short, long: v.long, placeId: idOf(s, v.key), deckLabel: v.deck, hours: v.hours,
    bookable: 'none', order: firstOrder + i, features: v.features ?? ['Included'], accessibility: v.accessibility ?? [],
    ...(v.minAge !== undefined ? { minAge: v.minAge } : {}),
  }))
}

type Interest = 'games' | 'wellness' | 'learning' | 'family'
interface Opts { extra?: number; cap?: number }
/** One row of a ship's week: slug, kinds of day, start, minutes, title, venue key, interest, options. */
type Row = [slug: string, when: string[], start: string, minutes: number, title: string, venue: Key, interest: Interest, opts?: Opts]

const E = 'embark', F = 'firstSea', P1 = 'earlyPortOdd', P6 = 'lastPort', P2 = 'portEven', S2 = 'laterSea', L = 'last'
/** A boutique studio class: $30, about 24 places, signed up for at the fitness desk. */
const CLASS: Opts = { extra: 3000, cap: 24 }

function week(s: ShipSpec): Row[] {
  const a = s.at
  const rows: Row[] = [
    // Day 1, embarkation: the desk opens, the courts are open from the afternoon
    ['desk', [E], '12:00', 60, 'Fitness desk and studio class sign-ups open', 'gym', 'learning'],
    ['court-open', [E], '13:00', 120, 'Open court basketball and pickleball', a.sports, 'games'],
    ['tour', [E], '16:30', 30, 'Complimentary detox stretch and gym tour', 'gym', 'wellness'],
    // Day 2, first sea day
    ['stretch-f', [F], '07:30', 30, 'Morning stretch', 'studio', 'wellness'],
    ['cycle-f', [F], '08:30', 30, 'CycleBar spin', 'studio', 'wellness', CLASS],
    ['barre-f', [F], '09:30', 30, 'Pure Barre', 'studio', 'wellness', CLASS],
    ['walk-f', [F], '11:00', 45, 'Walk-a-Mile group meetup', a.walk, 'wellness'],
    ['hoops-f', [F], '13:30', 60, '3-on-3 basketball tournament', a.sports, 'games', { cap: 24 }],
    ['yoga-f', [F], '15:00', 30, 'YogaSix Vinyasa Flow', 'studio', 'wellness', CLASS],
    ['stretchlab-f', [F], '16:30', 30, 'StretchLab one-on-one sessions', 'studio', 'wellness', { extra: 3000, cap: 6 }],
    // Day 3, port day
    ['yoga-p1', [P1], '07:30', 30, 'Sunrise YogaSix', a.yoga, 'wellness', CLASS],
    ['pilates-p1', [P1], '08:30', 30, 'Club Pilates mat class', 'studio', 'wellness', CLASS],
    ['pickle-p1', [P1], '14:00', 90, 'Open pickleball play', a.sports, 'games'],
    ['release-p1', [P1], '17:00', 30, 'Post-excursion stretch and release', 'studio', 'wellness'],
    // Day 6, the second port day
    ['stretch-p6', [P6], '08:00', 30, 'Morning stretch', 'studio', 'wellness'],
    ['barre-p6', [P6], '09:00', 30, 'Pure Barre', 'studio', 'wellness', CLASS],
    ['volley-p6', [P6], '13:00', 90, 'Open court volleyball and soccer', a.sports, 'games'],
    ['yoga-p6', [P6], '17:00', 30, 'YogaSix Restorative Flow', 'studio', 'wellness', CLASS],
    ['stretchlab-p6', [P6], '18:00', 30, 'StretchLab sessions', 'studio', 'wellness', { extra: 3000, cap: 6 }],
    // Day 4, port day
    ['cycle-p2', [P2], '08:00', 30, 'CycleBar Rhythm Ride', 'studio', 'wellness', CLASS],
    ['posture-p2', [P2], '09:00', 45, 'Foot and posture wellness seminar', 'studio', 'learning'],
    ['table-p2', [P2], '13:00', 60, 'Ping pong and shuffleboard challenge', a.sports, 'games'],
    ['barre-p2', [P2], '16:30', 30, 'Pure Barre full-body', 'studio', 'wellness', CLASS],
    ['walk-p2', [P2], '17:30', 45, 'Sunset Walk-a-Mile', a.walk, 'wellness'],
    // Day 5, sea day
    ['abs-s2', [S2], '07:30', 30, 'Fab Abs and Core', 'studio', 'wellness'],
    ['boot-s2', [S2], '08:30', 45, 'Boot camp circuit', 'studio', 'wellness', CLASS],
    ['yoga-s2', [S2], '09:30', 30, 'YogaSix', 'studio', 'wellness', CLASS],
    ['pickle-s2', [S2], '11:30', 90, 'Pickleball doubles tournament', a.sports, 'games', { cap: 24 }],
    ['cycle-s2', [S2], '15:30', 30, 'CycleBar endurance ride', 'studio', 'wellness', CLASS],
    ['pilates-s2', [S2], '16:30', 30, 'Club Pilates', 'studio', 'wellness', CLASS],
    // Day 7, last sea day
    ['stretch-l', [L], '07:30', 30, 'Morning stretch', 'studio', 'wellness'],
    ['cycle-l', [L], '08:30', 30, 'CycleBar finale ride', 'studio', 'wellness', CLASS],
    ['pilates-l', [L], '09:30', 30, 'Club Pilates', 'studio', 'wellness', CLASS],
    ['walk-l', [L], '11:00', 45, 'Farewell Walk-a-Mile', a.walk, 'wellness'],
    ['match-l', [L], '13:30', 45, 'Passengers versus officers sports match', a.sports, 'games', { cap: 30 }],
    ['release-l', [L], '15:30', 30, 'Stretch and release', 'studio', 'wellness'],
  ]
  if (a.putting) rows.push(['putting-s2', [S2], '14:00', 60, s.puttingTitle, a.putting, 'games'])
  if (a.swim) rows.push(['swim-p1', [P1], '12:00', 60, 'Open lap swimming', a.swim, 'wellness'])
  if (a.poolside) rows.push(['zumba-f', [F, S2], '10:30', 45, 'Poolside dance and Zumba fitness', a.poolside, 'wellness'])
  return rows
}

const DETAIL = (e: ExplorerEventRow, where: string): string => {
  const parts = [`At ${where}.`]
  if (e.extra > 0) parts.push('Extra cost, paid on board. Sign up at the fitness desk.')
  else if (e.capacity) parts.push('Places are limited.')
  return parts.join(' ')
}

/** The exercise events of a ship. A one-line `detail` is made from where and what it costs, so every event reads the same way on its venue's page. */
export function exerciseEvents(shipId: string): ExplorerEventRow[] {
  const s = SHIPS[shipId]
  const titles = new Map(s.venues.map((v) => [idOf(s, v.key), v.title]))
  return week(s).map(([slug, when, start, minutes, title, venue, interest, o = {}]) => {
    const e: ExplorerEventRow = {
      id: `${s.prefix}${slug}`, venueId: idOf(s, venue), when, start, minutes, title, detail: '', age: 'all', interest, extra: o.extra ?? 0, ...(o.cap ? { capacity: o.cap } : {}),
    }
    return { ...e, detail: DETAIL(e, titles.get(e.venueId) ?? '') }
  })
}
