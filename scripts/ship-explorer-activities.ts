// The Activities Explorer content of each ship (docs/princess-cruises-sea-vs-port-activities.md and docs/princess-activities.md): the quiet and hobby corners, the enrichment talks and workshops, the faith and
// community meet-ups, Camp Discovery and the teen centre, and the open decks. What the catalogue lists under shows, music, trivia, bingo, parties, tastings, auctions, classes and spa seminars lives in the
// Entertainment, Dining, Shopping, Exercise and Spa Explorers, so it is not repeated here. The catalogue gives each activity as a time band with a sea-day and a port-day variant; the start times, lengths and
// places are authored here for review. Nothing here is booked or charged by the app, so the only prices are the late-night youth sitting, which is paid on board.
//
// Day kinds as in the other Explorers. Embarkation day carries only the solo travellers' meet-up and the youth centre's open hours; the rest of the programme starts on the first full day.
import type { HoursRule } from '../src/domain/explorer/types.ts'
import type { ExplorerEventRow, ExplorerVenueRow } from './ship-explorer-data.ts'

const daily = (from: string, to: string): HoursRule[] => [{ kind: 'fixed', when: ['night'], windows: [[from, to]] }]

type Kind = 'quiet' | 'talks' | 'workshop' | 'community' | 'family' | 'deck'
type Key = 'library' | 'talks' | 'workshop' | 'meet' | 'camp' | 'teens' | 'deck'

interface VenueSpec { key: Key; kind: Kind; title: string; deck: string; short: string; long: string; hours: HoursRule[]; features?: string[]; accessibility?: string[] }

const STEP_FREE = ['Step-free from the lifts']
const FREE = ['Included']
const CAMP_LONG = 'Three age groups: The Treehouse (ages 3 to 7), The Lodge (8 to 12) and The Beach House (13 to 17). Counselors run Discovery at SEA science, scavenger hunts and games, and port-day supervised play for children whose parents are ashore. Register at the centre on embarkation day or in the app.'

interface ShipSpec { prefix: string; venues: VenueSpec[] }

const SHIPS: Record<string, ShipSpec> = {
  'sun-princess': {
    prefix: 'act-',
    venues: [
      { key: 'library', kind: 'quiet', title: 'Signature Lounge Card and Game Tables', deck: 'Deck 7 midship', hours: daily('08:00', '22:00'), short: 'Quiet tables stocked with cards, mahjong sets, board games and chess.',
        long: 'A calm corner of the Signature Lounge set aside for bridge, mahjong, cribbage, Scrabble, chess and Catan. The tables are unstaffed and open all day; on sea days a bridge director and the cruise staff host lessons and meet-ups here.', features: FREE, accessibility: STEP_FREE },
      { key: 'talks', kind: 'talks', title: 'Princess Arena Daytime Talks', deck: 'Decks 6 to 8 forward', hours: daily('08:30', '18:00'), short: 'Discovery at SEA lectures, port talks and the captain’s question-and-answer panel.',
        long: 'The main show lounge by day: Discovery at SEA talks by naturalists, historians and marine biologists, port and shopping presentations, the captain’s panel and the disembarkation talk. Talks are replayed on the stateroom TV.', features: FREE, accessibility: STEP_FREE },
      { key: 'workshop', kind: 'workshop', title: 'The Conservatory Workshops', deck: 'Lido Deck 17', hours: daily('09:00', '18:00'), short: 'Hands-on crafts, art and music lessons with supplies provided.',
        long: 'Staff hand out the supplies for origami, paper flowers, watercolor postcards and, on Pacific voyages, ribbon leis. Ukuleles are loaned for the lessons, and choir rehearsals build to a last-day showcase. Supplies are limited, so come early.', features: ['Included', 'Supplies provided'], accessibility: STEP_FREE },
      { key: 'meet', kind: 'community', title: 'Hearts & Minds Chapel and Meeting Rooms', deck: 'Deck 7 midship', hours: daily('07:00', '22:00'), short: 'Faith services, fellowship and hosted meet-ups for shared interests.',
        long: 'A quiet chapel and meeting rooms for interdenominational devotionals, Catholic Mass when a priest is aboard, interfaith reflection and the Shabbat service. The same rooms host the solo travellers, veterans, LGBTQ+ and Friends of Bill W. gatherings. All are welcome and nothing is charged.', features: FREE, accessibility: STEP_FREE },
      { key: 'camp', kind: 'family', title: 'Camp Discovery Youth Centre', deck: 'Upper aft decks', hours: daily('08:30', '24:00'), short: 'Supervised play, science and movie nights for ages 3 to 12.',
        long: CAMP_LONG, features: ['Included until 10 pm', 'Registration required'], accessibility: STEP_FREE },
      { key: 'teens', kind: 'family', title: 'The Beach House Teen Centre', deck: 'Upper aft decks', hours: daily('10:00', '24:00'), short: 'A hangout for ages 13 to 17 with game tournaments and scavenger hunts.',
        long: 'Video game tournaments, hunts around the ship and a late-evening music night for teens. The Beach House is part of Camp Discovery, so the same registration applies.', features: ['Included', 'Ages 13 to 17'], accessibility: STEP_FREE },
      { key: 'deck', kind: 'deck', title: 'Open Decks and Viewing Areas', deck: 'Forward and upper decks', hours: daily('05:30', '24:00'), short: 'The bow, promenade and upper decks for harbor arrivals, scenic cruising and stargazing.',
        long: 'The forward observation decks and railings where guests gather for harbor pilot and docking, Glacier Bay or canal commentary and Discovery at SEA stargazing. Weather permitting; dress warmly.', features: ['Included', 'Outdoors, weather permitting'] },
    ],
  },
  'sky-princess': {
    prefix: 'sky-act-',
    venues: [
      { key: 'library', kind: 'quiet', title: 'Vista Lounge Card Corner', deck: 'Deck 7 aft', hours: daily('08:00', '22:00'), short: 'Quiet daytime tables for bridge, mahjong, board games and chess.',
        long: 'A corner of the Vista Lounge, and on some days the Crown Grill Bar, stocked with cards, mahjong sets, Scrabble, chess and Catan. The tables are unstaffed and open all day; on sea days a bridge director and the cruise staff host lessons and meet-ups.', features: FREE, accessibility: STEP_FREE },
      { key: 'talks', kind: 'talks', title: 'Princess Theater Daytime Talks', deck: 'Decks 6 and 7 forward', hours: daily('08:30', '18:00'), short: 'Discovery at SEA lectures, port talks and the captain’s question-and-answer panel.',
        long: 'The main theater by day: Discovery at SEA talks by naturalists, historians and marine biologists, port and shopping presentations, the captain’s panel and the disembarkation talk. Talks are replayed on the stateroom TV.', features: FREE, accessibility: STEP_FREE },
      { key: 'workshop', kind: 'workshop', title: 'Horizon Court Activity Corner', deck: 'Lido Deck 16', hours: daily('09:00', '18:00'), short: 'Hands-on crafts, art and music lessons with supplies provided.',
        long: 'Staff hand out the supplies for origami, paper flowers, watercolor postcards and, on Pacific voyages, ribbon leis. Ukuleles are loaned for the lessons, and choir rehearsals build to a last-day showcase. Supplies are limited, so come early.', features: ['Included', 'Supplies provided'], accessibility: STEP_FREE },
      { key: 'meet', kind: 'community', title: 'Hearts & Minds Chapel and Meeting Rooms', deck: 'Deck 7 midship', hours: daily('07:00', '22:00'), short: 'Faith services, fellowship and hosted meet-ups for shared interests.',
        long: 'A quiet chapel and meeting rooms for interdenominational devotionals, Catholic Mass when a priest is aboard, interfaith reflection and the Shabbat service. The same rooms host the solo travellers, veterans, LGBTQ+ and Friends of Bill W. gatherings. All are welcome and nothing is charged.', features: FREE, accessibility: STEP_FREE },
      { key: 'camp', kind: 'family', title: 'Camp Discovery Youth Centre', deck: 'Upper aft decks', hours: daily('08:30', '24:00'), short: 'Supervised play, science and movie nights for ages 3 to 12.',
        long: CAMP_LONG, features: ['Included until 10 pm', 'Registration required'], accessibility: STEP_FREE },
      { key: 'teens', kind: 'family', title: 'The Beach House Teen Centre', deck: 'Upper aft decks', hours: daily('10:00', '24:00'), short: 'A hangout for ages 13 to 17 with game tournaments and scavenger hunts.',
        long: 'Video game tournaments, hunts around the ship and a late-evening music night for teens. The Beach House is part of Camp Discovery, so the same registration applies.', features: ['Included', 'Ages 13 to 17'], accessibility: STEP_FREE },
      { key: 'deck', kind: 'deck', title: 'Open Decks and Viewing Areas', deck: 'Forward and upper decks', hours: daily('05:30', '24:00'), short: 'The bow, promenade and upper decks for harbor arrivals, scenic cruising and stargazing.',
        long: 'The forward observation decks and railings where guests gather for harbor pilot and docking, Glacier Bay or fjord commentary and Discovery at SEA stargazing. Weather permitting; dress warmly.', features: ['Included', 'Outdoors, weather permitting'] },
    ],
  },
  'sapphire-princess': {
    prefix: 'sapphire-act-',
    venues: [
      { key: 'library', kind: 'quiet', title: 'Library and Card Room', deck: 'Deck 5', hours: daily('08:00', '22:00'), short: 'A quiet room of books, cards, mahjong sets and board games.',
        long: 'A calm room for bridge, mahjong, cribbage, Scrabble, chess and Catan, with a shelf of books to borrow. The tables are unstaffed and open all day; on sea days a bridge director and the cruise staff host lessons and meet-ups here, and the Wheelhouse Bar takes the overflow.', features: FREE, accessibility: STEP_FREE },
      { key: 'talks', kind: 'talks', title: 'Princess Theater Daytime Talks', deck: 'Decks 6 and 7 forward', hours: daily('08:30', '18:00'), short: 'Discovery at SEA lectures, port talks and the captain’s question-and-answer panel.',
        long: 'The main theater by day: Discovery at SEA talks by naturalists, historians and marine biologists, port and shopping presentations, the captain’s panel and the disembarkation talk. Talks are replayed on the stateroom TV.', features: FREE, accessibility: STEP_FREE },
      { key: 'workshop', kind: 'workshop', title: 'Lido Activity Corner', deck: 'Lido Deck 14', hours: daily('09:00', '18:00'), short: 'Hands-on crafts, art and music lessons with supplies provided.',
        long: 'Staff hand out the supplies for origami, paper flowers, watercolor postcards and, on Pacific voyages, ribbon leis. Ukuleles are loaned for the lessons, and choir rehearsals build to a last-day showcase. Supplies are limited, so come early.', features: ['Included', 'Supplies provided'], accessibility: STEP_FREE },
      { key: 'meet', kind: 'community', title: 'Hearts & Minds Chapel and Meeting Rooms', deck: 'Deck 5', hours: daily('07:00', '22:00'), short: 'Faith services, fellowship and hosted meet-ups for shared interests.',
        long: 'A quiet chapel and meeting rooms for interdenominational devotionals, Catholic Mass when a priest is aboard, interfaith reflection and the Shabbat service. The same rooms host the solo travellers, veterans, LGBTQ+ and Friends of Bill W. gatherings. All are welcome and nothing is charged.', features: FREE, accessibility: STEP_FREE },
      { key: 'camp', kind: 'family', title: 'Camp Discovery Youth Centre', deck: 'Upper aft decks', hours: daily('08:30', '24:00'), short: 'Supervised play, science and movie nights for ages 3 to 12.',
        long: CAMP_LONG, features: ['Included until 10 pm', 'Registration required'], accessibility: STEP_FREE },
      { key: 'teens', kind: 'family', title: 'The Beach House Teen Centre', deck: 'Upper aft decks', hours: daily('10:00', '24:00'), short: 'A hangout for ages 13 to 17 with game tournaments and scavenger hunts.',
        long: 'Video game tournaments, hunts around the ship and a late-evening music night for teens. The Beach House is part of Camp Discovery, so the same registration applies.', features: ['Included', 'Ages 13 to 17'], accessibility: STEP_FREE },
      { key: 'deck', kind: 'deck', title: 'Open Decks and Viewing Areas', deck: 'Forward and upper decks', hours: daily('05:30', '24:00'), short: 'The bow, promenade and upper decks for harbor arrivals, scenic cruising and stargazing.',
        long: 'The forward observation decks, Promenade Deck 7 and the Sun Deck, where guests gather for harbor pilot and docking, Alaska, fjord or canal commentary and Discovery at SEA stargazing. Weather permitting; dress warmly.', features: ['Included', 'Outdoors, weather permitting'] },
    ],
  },
}

const idOf = (s: ShipSpec, key: string) => `${s.prefix}${key}`

/** The activities venues of a ship, numbered from `firstOrder`. */
export function activitiesVenues(shipId: string, firstOrder: number): ExplorerVenueRow[] {
  const s = SHIPS[shipId]
  return s.venues.map((v, i) => ({
    id: idOf(s, v.key), explorer: 'activities', kind: v.kind, title: v.title, short: v.short, long: v.long, placeId: idOf(s, v.key), deckLabel: v.deck, hours: v.hours,
    bookable: 'none', order: firstOrder + i, features: v.features ?? FREE, accessibility: v.accessibility ?? [],
  }))
}

type Interest = 'games' | 'learning' | 'family' | 'community'
type Age = 'all' | 'kids' | 'teens' | 'adults'
interface Opts { extra?: number; cap?: number; age?: Age; detail?: string }
/** One row of the week: slug, kinds of day, start, minutes, title, venue key, interest, options. */
type Row = [slug: string, when: string[], start: string, minutes: number, title: string, venue: Key, interest: Interest, opts?: Opts]

const E = 'embark', F = 'firstSea', S2 = 'laterSea', L = 'last', SEA = 'seaMid', PORT = 'port', FRI = 'friday'
/** Every day after embarkation: sea days, ports and the last night. */
const DAYS = ['seaMid', 'port', 'last']

/** The programme is the same on all three ships, at the venues each ship has. */
const WEEK: Row[] = [
  // Open decks: arrivals, scenic cruising, stargazing, ship-wide hunts
  ['gangway', [PORT], '06:30', 60, 'Harbor arrival and gangway viewing', 'deck', 'family', { detail: 'Watch the pilot come aboard and the ship dock from the forward decks.' }],
  ['scenic', [S2], '07:00', 120, 'Scenic cruising with naturalist narration', 'deck', 'learning', { detail: 'On itineraries with scenic cruising, such as Glacier Bay, a fjord or the Panama Canal. Hot drinks are served on deck.' }],
  ['stars-am', [S2], '05:45', 60, 'Pre-dawn stargazing with Discovery at SEA', 'deck', 'learning', { detail: 'On the forward deck with the lights dimmed. Weather and cloud permitting.' }],
  ['stars-pm', [SEA], '22:30', 60, 'Night-sky stargazing with Discovery at SEA', 'deck', 'learning', { detail: 'On the forward deck with the lights dimmed. Clear nights only.' }],
  ['hunt', DAYS, '10:30', 45, 'Self-guided scavenger hunt and ship art quest', 'deck', 'games', { detail: 'Ship-wide and at your own pace; pick up the clue sheet at Guest Services.' }],
  ['olympics', [SEA], '14:30', 60, 'Pool Olympics and belly-flop contest', 'deck', 'games', { detail: 'At the main pool on warm-weather itineraries. Volunteers sign up poolside shortly before the start.' }],
  // Daytime talks
  ['discovery', [SEA], '14:00', 45, 'Discovery at SEA: marine life and wildlife talk', 'talks', 'learning'],
  ['ports', [F], '10:30', 45, 'Port and shopping presentation', 'talks', 'learning', { detail: 'The shore excursions manager and port shopping ambassador cover maps, dock logistics and local merchants, with raffle prizes.' }],
  ['captain', [S2], '11:00', 60, 'Captain and officers question-and-answer panel', 'talks', 'learning', { detail: 'The captain, staff captain, chief engineer and hotel general manager take questions from the audience.' }],
  ['photo', [SEA], '11:30', 45, 'Smartphone and travel photography workshop', 'talks', 'learning', { detail: 'Led by the photo team: composition, light and night-sky tips.' }],
  ['guest', [F, S2], '15:30', 45, 'Guest speaker: ocean history and maritime lore', 'talks', 'learning'],
  ['debark', [L], '10:00', 30, 'Disembarkation and customs talk', 'talks', 'learning', { detail: 'How luggage, colour-coded departure groups and customs work on the last morning.' }],
  // Workshops
  ['crafts', [SEA], '10:30', 60, 'Arts and crafts: origami and paper flowers', 'workshop', 'family', { cap: 24, detail: 'Supplies are limited, so arrive early.' }],
  ['postcards', [S2], '15:00', 60, 'Watercolor postcard workshop', 'workshop', 'family', { cap: 20, detail: 'Supplies are provided.' }],
  ['ukulele', [F, S2], '09:30', 60, 'Beginner ukulele lesson', 'workshop', 'learning', { cap: 20, detail: 'Ukuleles are loaned for the class. Sign up on the first sea day.' }],
  ['choir', [F, S2], '16:30', 45, 'Choir at Sea rehearsal', 'workshop', 'learning', { detail: 'Rehearsals build to a showcase on the last day.' }],
  ['showcase', [L], '16:00', 30, 'Choir at Sea and ukulele showcase', 'workshop', 'family', { detail: 'The group performs for fellow guests.' }],
  // Card and game tables
  ['bridge', DAYS, '10:00', 120, 'Bridge and mahjong meet-up', 'library', 'games', { detail: 'Open play. Cards and mahjong sets are on the tables.' }],
  ['board', DAYS, '14:00', 120, 'Board games and chess', 'library', 'games', { detail: 'Open play. Scrabble, chess and Catan are on the tables.' }],
  ['duplicate', [SEA], '15:00', 120, 'Duplicate bridge', 'library', 'games', { detail: 'Hosted by the bridge director. Sign-up sheets are posted at the tables.' }],
  ['book', [SEA], '16:00', 60, 'Book Club at Sea', 'library', 'community'],
  ['knit', [SEA], '11:30', 60, 'Knitters and stitchers get-together', 'library', 'community', { detail: 'An unhosted gathering. Bring your own project.' }],
  // Faith and community
  ['devotional', DAYS, '07:30', 30, 'Interdenominational morning devotional', 'meet', 'community', { detail: 'Quiet morning prayer and reflection. All are welcome.' }],
  ['mass', [SEA], '08:30', 40, 'Catholic Mass', 'meet', 'community', { detail: 'All welcome. Offered when a priest is aboard.' }],
  ['reflection', [SEA], '09:30', 30, 'Interfaith reflection', 'meet', 'community', { detail: 'A quiet half hour of reading and silence.' }],
  ['shabbat', [FRI], '18:00', 40, 'Shabbat service', 'meet', 'community', { detail: 'Led by a guest volunteer. Kosher grape juice is provided.' }],
  ['bill-w', DAYS, '17:00', 60, 'Friends of Bill W. meet-up', 'meet', 'community', { detail: 'A private room; ask Guest Services for the door.' }],
  ['solo', [E, SEA], '17:30', 45, 'Solo travellers’ meet-up', 'meet', 'community', { detail: 'Drinks and introductions.' }],
  ['lgbtq', [F, S2], '16:30', 45, 'LGBTQ+ gathering', 'meet', 'community', { detail: 'An unhosted social. Drinks are at bar prices.' }],
  ['veterans', [S2], '15:30', 45, 'Veterans and military meet-up', 'meet', 'community', { detail: 'An unhosted social. Drinks are at bar prices.' }],
  // Camp Discovery and the teen centre
  ['camp-am', DAYS, '09:30', 120, 'Camp Discovery morning: science and games', 'camp', 'family', { age: 'kids', detail: 'Ages 3 to 12. Register at the youth centre or in the app.' }],
  ['camp-port', [PORT], '12:00', 150, 'Port-day supervised play and lunch', 'camp', 'family', { age: 'kids', detail: 'For children whose parents are ashore. Pre-register for lunch supervision.' }],
  ['camp-sci', [SEA], '14:00', 90, 'Discovery at SEA experiments: volcanoes and squid', 'camp', 'learning', { age: 'kids', detail: 'Hands-on science with the counselors. Ages 8 to 12.' }],
  ['camp-pj', DAYS, '19:30', 120, 'Pajama party and movie', 'camp', 'family', { age: 'kids', detail: 'Wear your pajamas. Included until 10 pm.' }],
  ['camp-late', DAYS, '22:00', 180, 'Late-night group sitting', 'camp', 'family', { age: 'kids', extra: 500, detail: 'About $5 an hour per child, paid on board. Pick up by 1 am.' }],
  ['teen-games', DAYS, '14:00', 90, 'Video game tournament', 'teens', 'games', { age: 'teens', detail: 'Ages 13 to 17 at the Beach House.' }],
  ['teen-hunt', [SEA], '16:00', 60, 'Teen scavenger hunt', 'teens', 'games', { age: 'teens', detail: 'Ages 13 to 17. Teams start from the Beach House.' }],
  ['teen-night', DAYS, '20:00', 120, 'Teen hangout and music night', 'teens', 'family', { age: 'teens', detail: 'Ages 13 to 17 at the Beach House.' }],
]

/** The activities events of a ship. Nothing is charged by the app; the late-night youth sitting is paid on board. */
export function activitiesEvents(shipId: string): ExplorerEventRow[] {
  const s = SHIPS[shipId]
  const titles = new Map(s.venues.map((v) => [idOf(s, v.key), v.title]))
  return WEEK.map(([slug, when, start, minutes, title, venue, interest, o = {}]) => {
    const venueId = idOf(s, venue)
    return {
      id: `${s.prefix}${slug}`, venueId, when, start, minutes, title, detail: o.detail ?? `At ${titles.get(venueId) ?? ''}.`, age: o.age ?? 'all', interest, extra: o.extra ?? 0, ...(o.cap ? { capacity: o.cap } : {}),
    }
  })
}
