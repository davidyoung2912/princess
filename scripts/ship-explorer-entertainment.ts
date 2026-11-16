// The Entertainment Explorer content of each ship (docs/princess-entertainment.md and the casino part of docs/princess-spa-casino.md): the show rooms, music lounges, pool decks, Princess Live!
// and the casino, and the events that run there on each kind of day. The docs give each event as Morning / Noon / Night, so the start times and lengths are authored here for review.
// A bar that is also in Dining (Wheelhouse, O'Malley's) appears here as its own "live music" venue, so its music is in Entertainment and its drinks stay in Dining.
//
// The doc's week maps onto day kinds: Day 1 `embark`, Day 2 `firstSea` (formal), Day 3 `earlyPortOdd`, Day 6 `lastPort`, Day 4 `portEven`, Day 5 `laterSea`, Day 7 `last`. A day kind repeats on a longer sailing.
import type { HoursRule } from '../src/domain/explorer/types.ts'
import type { ExplorerEventRow, ExplorerVenueRow } from './ship-explorer-data.ts'

const OPEN_DAY: HoursRule[] = [{ kind: 'fixed', when: ['night'], windows: [['07:00', '24:00']] }]
const OPEN_STAGE: HoursRule[] = [{ kind: 'fixed', when: ['night'], windows: [['08:00', '24:00']] }]
const OPEN_EVENING: HoursRule[] = [{ kind: 'fixed', when: ['night'], windows: [['18:30', '24:00']] }]
/** Closed in port; opens 45 minutes after the ship sails; on embarkation day it opens as the ship leaves. */
const CASINO_HOURS: HoursRule[] = [
  { kind: 'sailaway', when: ['port'], afterMinutes: 45, until: '24:00' },
  { kind: 'fixed', when: ['embark'], windows: [['17:30', '24:00']] },
  { kind: 'fixed', when: ['night'], windows: [['09:00', '24:00']] },
]

type Kind = 'show' | 'music' | 'deck' | 'studio' | 'casino'

interface VenueSpec { key: string; kind: Kind; title: string; deck: string; short: string; long: string; hours: HoursRule[]; minAge?: number; features?: string[]; accessibility?: string[] }

const STEP_FREE = ['Step-free from the lifts']

const CASINO_LONG = 'Slot machines, live table games and electronic roulette, paid with your Medallion through ticket-in, ticket-out. It is run in international waters, so it is closed in port and opens 30 to 45 minutes after the ship sails.'

interface ShipSpec { prefix: string; venues: VenueSpec[] }

const SHIPS: Record<string, ShipSpec> = {
  'sun-princess': {
    prefix: '',
    venues: [
      { key: 'arena', kind: 'show', title: 'Princess Arena', deck: 'Decks 6 to 8 forward', hours: OPEN_STAGE, short: 'The transformable theatre-in-the-round for the headline production shows.',
        long: 'Movable seating banks and a rotating central stage, with surround sound, LED backdrops and aerial rigging. It hosts Viva La Música, Vallora: A Pirate Quest, Stage Struck and Fiera!, as well as guest comedians and vocalists.', accessibility: ['Wheelchair spaces on both sides of the middle block; ask an usher'] },
      { key: 'dome', kind: 'show', title: 'The Dome', deck: 'Decks 17 and 18 forward', hours: OPEN_DAY, short: 'A glass dome that is a pool deck by day and an acrobatic theatre by night.',
        long: 'A glass-roofed dome with a waterfall pool and tiered lounge seating. At night the pool is covered to make a stage for the Cirque Éloize productions Blue, Come Fly Away and ArtBeat, aerialists and late-night DJ parties.', accessibility: STEP_FREE },
      { key: 'piazza', kind: 'music', title: 'The Piazza', deck: 'Decks 7 to 9 midship', hours: OPEN_DAY, short: 'The three-deck glass atrium for live music, street performers and pop-up parties.',
        long: 'A glass sphere looking out to sea, around a central stage and an LED screen. From morning until midnight there are string quartets, acoustic duos, classical pianists, aerial pop-up acts, dance classes and the Captain’s Champagne Waterfall.', accessibility: ['Each level has a lift to the others'] },
      { key: 'live', kind: 'studio', title: 'Princess Live!', deck: 'Deck 7 midship', hours: OPEN_STAGE, short: 'A TV-studio lounge for game shows, trivia and late-night comedy.',
        long: 'Styled like a television soundstage, with camera rigs and banquette seating. By day it has trivia, cooking demonstrations and Wake Show tapings; at night it is a comedy club and game-show arena.', accessibility: STEP_FREE },
      { key: 'live-omalleys', kind: 'music', title: 'O’Malley’s live music', deck: 'Deck 7 midship', hours: OPEN_DAY, short: 'Nightly live folk and acoustic rock in the Irish pub.',
        long: 'Resident soloists and duos play Celtic classics, sing-alongs and pub rock every evening, with Irish whiskey tastings. Food and drink are in the Dining Explorer.' },
      { key: 'live-wheelhouse', kind: 'music', title: 'Wheelhouse live music', deck: 'Deck 7 midship', hours: OPEN_DAY, short: 'Piano, jazz combos and ballroom dancing in the nautical lounge.',
        long: 'A refined lounge of wood panelling and brass ship models. Afternoon board games give way to resident pianists, jazz combos and slow dancing in the evening. Drinks are in the Dining Explorer.' },
      { key: 'seaview', kind: 'deck', title: 'SeaView and Wake View Terraces', deck: 'Decks 17 and 8', hours: OPEN_DAY, short: 'The outdoor decks for sailaway parties, deck bands and Movies Under the Stars.',
        long: 'The forward SeaView Terrace has the giant LED screen and the main pool stage; the aft Wake View Terrace has an infinity pool and a sunset bar. Weather permitting.' },
      { key: 'spellbound', kind: 'show', title: 'Spellbound by Magic Castle', deck: 'Deck 8 midship', hours: OPEN_EVENING, minAge: 18, short: 'A speakeasy parlour of close-up magic and theatrical cocktails, by ticket.',
        long: 'Made with Hollywood’s Magic Castle, behind an unmarked door: secret rooms, smoking cocktails in the Music Room and a 30-seat velvet theatre for illusionists. Seatings are ticketed and small.', features: ['Ticketed seatings'] },
      { key: 'casino', kind: 'casino', title: 'Princess Casino', deck: 'Deck 6 midship', hours: CASINO_HOURS, minAge: 18, short: 'The largest casino in the fleet, closed in port.',
        long: `Over 9,000 square feet with more than 200 video slots, progressive jackpots and 13 live tables, including blackjack, craps, roulette, three-card poker, Ultimate Texas Hold’em and baccarat. A separate smoke-free annex has its own bar. ${CASINO_LONG}`, features: ['Adults 18+', 'Closed in port'] },
    ],
  },
  'sky-princess': {
    prefix: 'sky-',
    venues: [
      { key: 'theater', kind: 'show', title: 'Princess Theater', deck: 'Decks 6 and 7 forward', hours: OPEN_STAGE, short: 'The two-deck Broadway-style theatre for production shows and headliners.',
        long: 'Tiered seating with clear sightlines, a live showband and digital projection mapping. It headlines Rock Opera, 5-SKIES and Spotlight Bar alongside touring vocalists and illusionists.', accessibility: ['Wheelchair spaces at the back and sides; ask an usher'] },
      { key: 'takefive', kind: 'music', title: 'Take Five', deck: 'Deck 6 midship', hours: OPEN_DAY, short: 'The only dedicated jazz theatre at sea, with a live trio each night.',
        long: 'A mid-century Harlem jazz club of exposed brick and neon. By day there are salsa lessons and acoustic sessions; at night a resident trio plays themed sets, with craft cocktails.', accessibility: STEP_FREE },
      { key: 'vista', kind: 'show', title: 'Vista Lounge', deck: 'Deck 7 aft', hours: OPEN_DAY, short: 'The aft cabaret lounge for comedians, party bands, bingo and theme parties.',
        long: 'A wrap-around-window lounge with a central dance floor. Daytime art auctions and bingo give way to stand-up, tribute bands and 70s and 80s disco nights.', accessibility: STEP_FREE },
      { key: 'live', kind: 'studio', title: 'Princess Live! and Café', deck: 'Deck 7 midship', hours: OPEN_STAGE, short: 'A TV-studio venue for trivia, culinary shows, game shows and late-night comedy.',
        long: 'A studio audience with audience keypads and cameras feeding the cabin TVs, and its own espresso and cocktail bar. Daily trivia, talent auditions and adult comedy at night.', accessibility: STEP_FREE },
      { key: 'piazza', kind: 'music', title: 'The Piazza', deck: 'Decks 5 to 7 midship', hours: OPEN_DAY, short: 'The three-deck marble atrium with continuous live music and gala parties.',
        long: 'A European town square at sea. String ensembles, ballroom demonstrations, fruit-carving demonstrations and the Captain’s Champagne Waterfall, from morning to night.', accessibility: ['Each level has a lift to the others'] },
      { key: 'pool', kind: 'deck', title: 'Top Deck Pool and Movies Under the Stars', deck: 'Decks 16 and 17 midship', hours: OPEN_DAY, short: 'The twin-pool lido deck with an outdoor LED cinema screen and stage.',
        long: 'By day, live party bands, poolside games and ice carving; by night, blankets and popcorn for the big screen, between Water and Light fountain shows. Weather permitting.' },
      { key: 'crooners', kind: 'music', title: 'Crooners', deck: 'Deck 6 midship', hours: OPEN_DAY, short: 'The piano martini lounge for requests and sing-alongs.',
        long: 'Looking over the Piazza, with a Rat Pack soundtrack and a piano entertainer taking requests late into the night. Drinks are in the Dining Explorer.' },
      { key: 'casino', kind: 'casino', title: 'Princess Casino', deck: 'Deck 6 forward', hours: CASINO_HOURS, minAge: 18, short: 'Slots and table games, closed in port.',
        long: `The forward casino has 150 to 180 slots, live table pits and automated Texas Hold’em tables, and is smoke-free on most sailings. ${CASINO_LONG}`, features: ['Adults 18+', 'Closed in port'] },
    ],
  },
  'sapphire-princess': {
    prefix: 'sapphire-',
    venues: [
      { key: 'theater', kind: 'show', title: 'Princess Theater', deck: 'Decks 6 and 7 forward', hours: OPEN_STAGE, short: 'The classic two-tier theatre for production revues, concerts and variety.',
        long: 'Warm wood and plush seating. Evening revues (Bravo, Encore, Magic to Do or Born to Dance) with the Princess Singers, Dancers and showband, and afternoon lectures and classical recitals.', accessibility: ['Wheelchair spaces at the back and sides; ask an usher'] },
      { key: 'fusion', kind: 'show', title: 'Club Fusion', deck: 'Deck 7 aft', hours: OPEN_DAY, short: 'The aft lounge for Pop Star karaoke, line dancing, bingo and party bands.',
        long: 'Dozens of synchronised screens, theatrical lighting and a wooden dance floor at the end of the Promenade Deck: Princess Pop Star, dance lessons, bingo and live bands.', accessibility: STEP_FREE },
      { key: 'explorers', kind: 'show', title: 'Explorers Lounge', deck: 'Deck 7 midship', hours: OPEN_DAY, short: 'A midship lounge for trivia, auctions, comedy and cover bands.',
        long: 'Safari, Egyptian and Silk Road decor with its own bar and stage. Morning trivia and port talks, then audience game shows, guest comedians and live rock and pop.', accessibility: STEP_FREE },
      { key: 'live-wheelhouse', kind: 'music', title: 'Wheelhouse live music', deck: 'Deck 7 forward', hours: OPEN_DAY, short: 'Ballroom, swing and blues bands in the clubby nautical lounge.',
        long: 'Dark mahogany and a hardwood dance floor: quiet cards by day, then live ballroom, swing and classic blues in the evening. Drinks are in the Dining Explorer.' },
      { key: 'skywalkers', kind: 'music', title: 'Skywalkers Nightclub', deck: 'Deck 17 aft', hours: OPEN_DAY, short: 'The glass lounge high over the stern: a quiet viewpoint by day and a nightclub after 10 pm.',
        long: 'Reached by a glass-walled moving walkway, with 270-degree ocean views from 150 feet up. Quiet tiered seating by day, especially for scenic cruising; a resident DJ and a neon dance floor after 10 pm.' },
      { key: 'piazza', kind: 'music', title: 'The Piazza', deck: 'Decks 5 to 7 midship', hours: OPEN_DAY, short: 'The three-deck atrium, the heart of the ship, for quartets, lessons and the Champagne Waterfall.',
        long: 'Around the International Café and Vines Wine Bar: string quartets, ballroom lessons, street-style variety acts and the Captain’s Welcome Champagne Waterfall.', accessibility: ['Each level has a lift to the others'] },
      { key: 'crooners', kind: 'music', title: 'Crooners', deck: 'Deck 7 midship', hours: OPEN_DAY, short: 'The piano martini bar for Rat Pack requests.',
        long: 'A piano bar beside the Piazza with Rat Pack classics and martini requests. Drinks are in the Dining Explorer.' },
      { key: 'pool', kind: 'deck', title: 'Neptune’s Reef Pool and Movies Under the Stars', deck: 'Deck 14 midship', hours: OPEN_DAY, short: 'The main lido pool with a giant screen, bandstand and deck parties.',
        long: 'Tiered sun decks and hot tubs around the main pool, for sailaway parties, live bands and games by day and an open-air cinema with blankets and popcorn at night. Weather permitting.' },
      { key: 'casino', kind: 'casino', title: 'Princess Casino', deck: 'Deck 6 midship', hours: CASINO_HOURS, minAge: 18, short: 'Slots and table games, closed in port.',
        long: `A classic midship casino with 150 to 180 slots, live table pits and automated Texas Hold’em tables. ${CASINO_LONG}`, features: ['Adults 18+', 'Closed in port'] },
    ],
  },
}

const idOf = (s: ShipSpec, key: string) => `${s.prefix}${key}`

/** The entertainment venues of a ship, numbered from `firstOrder`. Sun Princess keeps the place ids the deck plan already has. */
export function entertainmentVenues(shipId: string, firstOrder: number): ExplorerVenueRow[] {
  const s = SHIPS[shipId]
  const deckPlan: Record<string, string> = { arena: 'arena', dome: 'dome', piazza: 'piazza', live: 'live', seaview: 'lido-pool' }
  return s.venues.map((v, i) => ({
    id: idOf(s, v.key), explorer: 'entertainment', kind: v.kind, title: v.title, short: v.short, long: v.long,
    placeId: shipId === 'sun-princess' ? deckPlan[v.key] ?? idOf(s, v.key) : idOf(s, v.key),
    deckLabel: v.deck, hours: v.hours, bookable: 'none', order: firstOrder + i, features: v.features ?? ['Included'], accessibility: v.accessibility ?? [],
    ...(v.minAge !== undefined ? { minAge: v.minAge } : {}),
  }))
}

type Interest = 'shows' | 'music' | 'games' | 'wellness' | 'learning' | 'family' | 'nightlife'
interface Opts { age?: ExplorerEventRow['age']; extra?: number; cap?: number }

const E = 'embark', F = 'firstSea', P1 = 'earlyPortOdd', P6 = 'lastPort', P2 = 'portEven', S2 = 'laterSea', L = 'last', PORT = 'port'

/** One row of a ship's week: slug, kinds of day, start, minutes, title, venue key, interest, options. */
type Row = [slug: string, when: string[], start: string, minutes: number, title: string, venue: string, interest: Interest, opts?: Opts]

function build(s: ShipSpec, rows: readonly Row[]): ExplorerEventRow[] {
  return rows.map(([slug, when, start, minutes, title, venue, interest, o = {}]) => ({
    id: `${s.prefix}${slug}`, venueId: idOf(s, venue), when, start, minutes, title, detail: '', age: o.age ?? 'all', interest, extra: o.extra ?? 0, ...(o.cap ? { capacity: o.cap } : {}),
  }))
}

/** The casino's events, the same week on every ship (docs/princess-spa-casino.md). */
const casinoRows = (): Row[] => [
  ['casino-open', [E], '17:45', 30, 'Casino grand opening and learn-to-play table lessons', 'casino', 'games', { age: 'adults' }],
  ['casino-welcome', [E], '21:30', 60, '$500 welcome aboard slot tournament', 'casino', 'games', { age: 'adults', cap: 60 }],
  ['casino-blackjack', [F], '13:00', 90, '$1,000 sea day blackjack tournament ($25 buy-in)', 'casino', 'games', { age: 'adults', extra: 2500, cap: 40 }],
  ['casino-holdem-signup', [F], '15:00', 30, 'Texas Hold’em cash game sign-up', 'casino', 'games', { age: 'adults' }],
  ['casino-formal', [F], '21:00', 120, 'Formal night high-limit play and champagne slots', 'casino', 'nightlife', { age: 'adults' }],
  ['casino-hotseat', [F], '23:00', 30, 'Late-night hot seat cash drawings', 'casino', 'games', { age: 'adults' }],
  ['casino-spin', [P1], '19:30', 60, '$500 spin-to-win slot tournament', 'casino', 'games', { age: 'adults', cap: 60 }],
  ['casino-craps', [P1], '22:00', 90, 'Craps and roulette hot-streak challenge', 'casino', 'games', { age: 'adults' }],
  ['casino-gala6', [P6], '20:30', 90, 'Gala formal night $2,500 lotto and bingo jackpot', 'casino', 'games', { age: 'adults', cap: 80 }],
  ['casino-roller', [P6], '22:00', 90, 'High-roller blackjack and baccarat challenge', 'casino', 'games', { age: 'adults' }],
  ['casino-holdem', [P2], '20:00', 120, '$500 Texas Hold’em no-limit tournament', 'casino', 'games', { age: 'adults', extra: 5000, cap: 30 }],
  ['casino-mystery', [P2], '22:30', 30, 'Midnight mystery jackpot drawings', 'casino', 'games', { age: 'adults' }],
  ['casino-bloody', [S2], '09:00', 90, 'Morning slots and Bloody Mary bar', 'casino', 'games', { age: 'adults' }],
  ['casino-champ', [S2], '13:30', 120, '$1,500 championship slot tournament (qualifying rounds)', 'casino', 'games', { age: 'adults', cap: 60 }],
  ['casino-poker', [S2], '15:30', 90, 'Three-card poker and roulette tournament', 'casino', 'games', { age: 'adults', cap: 40 }],
  ['casino-final', [S2], '21:30', 60, 'Slot tournament grand finale', 'casino', 'games', { age: 'adults', cap: 60 }],
  ['casino-dj', [S2], '23:00', 60, 'Late-night table games and DJ lounge', 'casino', 'nightlife', { age: 'adults' }],
  ['casino-gala', [L], '13:00', 90, 'Final voyage slot and blackjack showdown', 'casino', 'games', { age: 'adults', cap: 40 }],
  ['casino-cashout', [L], '20:00', 180, 'Final cash-out and ticket redemption window', 'casino', 'games', { age: 'adults' }],
]

const sunRows = (): Row[] => [
  // Embarkation
  ['piazza-duo', [E], '10:00', 45, 'Embarkation violin and cello duo', 'piazza', 'music'],
  ['arena-orient', [E], '11:30', 30, 'Ship orientation and shore excursion briefing', 'arena', 'learning'],
  ['piazza-guitar', [E], '12:30', 45, 'Welcome aboard acoustic guitar and vocalist', 'piazza', 'music'],
  ['seaview-sailaway', [E], '16:00', 60, 'Sailaway deck party with resident band Xcite', 'seaview', 'music'],
  ['arena-welcome', [E], '20:30', 75, 'Welcome aboard variety showcase: comedian and vocalist', 'arena', 'shows', { cap: 1100 }],
  ['omalleys-folk', [E], '21:30', 90, 'Live Celtic folk and pub sing-along', 'live-omalleys', 'music', { age: 'adults' }],
  ['dome-dj-kickoff', [E], '22:30', 120, 'Late-night DJ kickoff party', 'dome', 'nightlife', { age: 'adults' }],
  // First sea day (formal)
  ['seaview-zumba', [F], '08:00', 45, 'Morning stretch and Zumba', 'seaview', 'wellness'],
  ['live-wake', [F], '09:00', 60, 'Live Wake Show taping and morning trivia', 'live', 'games', { cap: 150 }],
  ['piazza-waltz', [F], '10:30', 45, 'Ballroom waltz dance class', 'piazza', 'learning'],
  ['live-culinary', [F], '11:30', 45, 'Culinary demo and galley tour preview', 'live', 'learning'],
  ['seaview-movie', [F], '13:00', 120, 'Afternoon feature on Movies Under the Stars', 'seaview', 'family'],
  ['piazza-quartet', [F], '14:00', 60, 'Classical string quartet recital', 'piazza', 'music'],
  ['dome-acoustic', [F], '15:00', 60, 'Poolside acoustic sessions', 'dome', 'music'],
  ['piazza-waterfall', [F], '18:00', 30, 'Captain’s Welcome Champagne Waterfall and gala orchestra', 'piazza', 'music'],
  ['arena-viva-1', [F], '19:00', 60, 'Production show: Viva La Música, early showing', 'arena', 'shows', { cap: 1100 }],
  ['spell-1', [F], '19:30', 45, 'Magic parlour seating, first', 'spellbound', 'shows', { age: 'adults', extra: 2500, cap: 30 }],
  ['spell-2', [F], '21:00', 45, 'Magic parlour seating, second', 'spellbound', 'shows', { age: 'adults', extra: 2500, cap: 30 }],
  ['arena-viva-2', [F], '21:15', 60, 'Production show: Viva La Música, late showing', 'arena', 'shows', { cap: 1100 }],
  ['wheelhouse-formal', [F], '21:00', 120, 'Formal night piano and slow dancing', 'live-wheelhouse', 'music', { age: 'adults' }],
  // Port days
  ['piazza-piano', [PORT], '08:30', 60, 'Morning coffee and classical piano', 'piazza', 'music'],
  ['live-lecture', [PORT], '10:00', 45, 'Destination port lecture and cultural insights', 'live', 'learning'],
  ['seaview-dj', [PORT], '14:00', 120, 'Afternoon poolside DJ', 'seaview', 'music'],
  ['wheelhouse-cards', [PORT], '14:30', 90, 'Board games and bridge club social', 'live-wheelhouse', 'games'],
  ['piazza-trio', [PORT], '17:30', 45, 'Sailaway string trio', 'piazza', 'music'],
  ['dome-blue', [P1], '20:00', 60, 'Cirque Éloize: Blue', 'dome', 'shows', { cap: 700 }],
  ['live-marriage', [P1], '21:15', 60, 'The Marriage Match game show', 'live', 'games', { age: 'adults', cap: 150 }],
  ['omalleys-whiskey', [P1], '21:30', 90, 'Live Irish duo and whiskey tasting', 'live-omalleys', 'music', { age: 'adults' }],
  ['seaview-blockbuster', [P1], '21:00', 150, 'Evening blockbuster on Movies Under the Stars', 'seaview', 'family'],
  ['dome-yoga', [P2], '07:30', 45, 'Sunrise yoga under the glass canopy', 'dome', 'wellness'],
  ['live-brain', [P2], '09:30', 45, 'Morning brainteasers and music trivia', 'live', 'games'],
  ['piazza-carving', [P2], '14:30', 45, 'Fruit and vegetable carving demonstration', 'piazza', 'learning'],
  ['live-bingo', [P2], '15:30', 60, 'Afternoon movie trivia and bingo', 'live', 'games', { extra: 2000 }],
  ['wake-sunset', [P2], '17:45', 45, 'Sunset acoustic guitarist', 'seaview', 'music'],
  ['arena-vallora-1', [P2], '19:00', 60, 'Production show: Vallora: A Pirate Quest, early showing', 'arena', 'shows', { cap: 1100 }],
  ['arena-vallora-2', [P2], '21:15', 60, 'Production show: Vallora: A Pirate Quest, late showing', 'arena', 'shows', { cap: 1100 }],
  ['piazza-disco', [P2], '21:30', 90, '70s and 80s disco street party', 'piazza', 'nightlife'],
  ['live-comedy', [P2], '22:15', 60, 'Late-night adult stand-up comedy showcase', 'live', 'shows', { age: 'adults' }],
  ['dome-silent', [P2], '23:00', 60, 'Silent disco under the stars', 'dome', 'nightlife', { age: 'adults' }],
  // Later sea days
  ['seaview-walk', [S2], '07:45', 45, 'Walk-a-Mile and morning tai chi', 'seaview', 'wellness'],
  ['arena-lecture', [S2], '10:00', 45, 'Enrichment lecture: history of the seas', 'arena', 'learning'],
  ['live-yesno', [S2], '11:00', 45, 'Yes/No interactive game show', 'live', 'games'],
  ['seaview-olympics', [S2], '14:00', 90, 'Poolside Olympics and the crew versus guests belly flop contest', 'seaview', 'games'],
  ['piazza-aerial', [S2], '15:30', 45, 'Pop-up aerialist and contortionist showcase', 'piazza', 'shows'],
  ['live-deal', [S2], '16:30', 60, 'Deal or No Deal live game show', 'live', 'games', { cap: 150 }],
  ['dome-flyaway', [S2], '20:00', 60, 'Cirque Éloize: Come Fly Away', 'dome', 'shows', { cap: 700 }],
  ['wheelhouse-jazz', [S2], '20:30', 90, 'Jazz trio and craft cocktails', 'live-wheelhouse', 'music', { age: 'adults' }],
  ['arena-illusionist', [S2], '21:15', 60, 'Headline guest illusionist and mentalist', 'arena', 'shows', { cap: 1100 }],
  ['omalleys-rock', [S2], '22:30', 90, 'Late-night rock and pop anthems', 'live-omalleys', 'nightlife', { age: 'adults' }],
  // Last day
  ['piazza-coffee', [L], '08:30', 60, 'Morning acoustic guitar and coffee', 'piazza', 'music'],
  ['live-finale', [L], '10:00', 60, 'Final jackpot trivia and Wake Show finale', 'live', 'games'],
  ['dome-craft', [L], '11:00', 60, 'Family craft and origami workshop', 'dome', 'family'],
  ['arena-voice', [L], '14:00', 60, 'The Voice of the Ocean finale matinee', 'arena', 'shows', { cap: 1100 }],
  ['seaview-reggae', [L], '15:30', 90, 'Farewell poolside reggae and party band', 'seaview', 'music'],
  ['piazza-choir', [L], '17:00', 45, 'Passenger choir and dance showcase', 'piazza', 'shows'],
  ['arena-farewell', [L], '20:00', 75, 'Farewell variety spectacular', 'arena', 'shows', { cap: 1100 }],
  ['dome-artbeat', [L], '21:30', 60, 'Cirque Éloize encore: ArtBeat', 'dome', 'shows', { cap: 700 }],
  ['omalleys-farewell', [L], '22:00', 90, 'Last-night farewell sing-along', 'live-omalleys', 'music'],
  ['seaview-midnight', [L], '22:30', 90, 'Midnight Movies Under the Stars', 'seaview', 'family'],
  // Day 6, the second formal port day
  ['piazza-harp', [P6], '09:15', 45, 'Morning harp and flute duet', 'piazza', 'music'],
  ['live-trivia6', [P6], '10:30', 45, 'General knowledge trivia challenge', 'live', 'games'],
  ['dome-crossover', [P6], '14:00', 60, 'Afternoon classical crossover concert', 'dome', 'music', { cap: 700 }],
  ['piazza-tango', [P6], '15:00', 45, 'Tango and salsa dance workshop', 'piazza', 'learning'],
  ['seaview-concert', [P6], '15:00', 120, 'Afternoon concert screening on the big screen', 'seaview', 'music'],
  ['arena-fiera-1', [P6], '19:00', 60, 'Production show: Fiera!, early showing', 'arena', 'shows', { cap: 1100 }],
  ['arena-fiera-2', [P6], '21:15', 60, 'Production show: Fiera!, late showing', 'arena', 'shows', { cap: 1100 }],
  ['spell-p6-1', [P6], '19:30', 45, 'Magic parlour seating, first', 'spellbound', 'shows', { age: 'adults', extra: 2500, cap: 30 }],
  ['spell-p6-2', [P6], '21:00', 45, 'Magic parlour seating, second', 'spellbound', 'shows', { age: 'adults', extra: 2500, cap: 30 }],
  ['piazza-balloon', [P6], '21:30', 90, 'Balloon drop gala party with the resident band Xcite', 'piazza', 'nightlife'],
  ['live-majority', [P6], '22:15', 60, 'Majority Rules adult game show', 'live', 'games', { age: 'adults', cap: 150 }],
  ...casinoRows(),
]

const skyRows = (): Row[] => [
  ['piazza-trio', [E], '10:00', 45, 'Embarkation classical string trio', 'piazza', 'music'],
  ['pool-dj', [E], '11:00', 90, 'Sunbathing and poolside DJ', 'pool', 'music'],
  ['theater-brief', [E], '11:30', 30, 'Welcome aboard briefing and raffle', 'theater', 'learning'],
  ['pool-sailaway', [E], '16:00', 60, 'Sailaway celebration with live party band and dance staff', 'pool', 'music'],
  ['theater-welcome', [E], '20:30', 75, 'Welcome aboard showtime: comedian and variety act', 'theater', 'shows', { cap: 900 }],
  ['takefive-harlem', [E], '21:15', 75, 'Opening night jazz set: A Night in Harlem', 'takefive', 'music', { cap: 90 }],
  ['crooners-ratpack', [E], '21:30', 90, 'Rat Pack piano and martini sing-along', 'crooners', 'music', { age: 'adults' }],
  ['vista-karaoke', [E], '22:00', 90, 'Welcome aboard karaoke and DJ', 'vista', 'nightlife'],

  ['pool-zumba', [F], '08:00', 45, 'Morning Zumba and deck walk', 'pool', 'wellness'],
  ['live-wake', [F], '09:00', 60, 'Wake Show live and morning trivia', 'live', 'games', { cap: 150 }],
  ['piazza-foxtrot', [F], '10:30', 45, 'Foxtrot and waltz dance lesson', 'piazza', 'learning'],
  ['live-culinary', [F], '11:30', 45, 'Culinary demonstration and galley tour', 'live', 'learning'],
  ['pool-movie', [F], '13:00', 120, 'Afternoon feature film on Movies Under the Stars', 'pool', 'family'],
  ['vista-auction', [F], '14:00', 60, 'Fine art auction and champagne preview', 'vista', 'learning'],
  ['takefive-salsa', [F], '15:30', 45, 'Latin salsa dance class', 'takefive', 'learning'],
  ['piazza-waterfall', [F], '18:00', 30, 'Captain’s Welcome Champagne Waterfall and string quartet', 'piazza', 'music'],
  ['theater-rock-1', [F], '19:00', 60, 'Production show: Rock Opera, early showing', 'theater', 'shows', { cap: 900 }],
  ['theater-rock-2', [F], '21:15', 60, 'Production show: Rock Opera, late showing', 'theater', 'shows', { cap: 900 }],
  ['takefive-bebop', [F], '21:30', 75, 'The Birth of Big Band and BeBop: live jazz trio', 'takefive', 'music', { cap: 90 }],
  ['vista-comedy', [F], '22:15', 60, 'Late-night stand-up comedy', 'vista', 'shows', { age: 'adults' }],

  ['piazza-guitar', [PORT], '08:30', 60, 'Morning acoustic guitar and espresso', 'piazza', 'music'],
  ['theater-lecture', [PORT], '10:00', 45, 'Port destination and history talk', 'theater', 'learning'],
  ['pool-music', [PORT], '14:00', 120, 'Relaxed afternoon poolside music', 'pool', 'music'],
  ['vista-games', [PORT], '14:30', 90, 'Afternoon board games and trivia', 'vista', 'games'],
  ['piazza-sailaway', [PORT], '17:30', 45, 'Sailaway jazz and pop duo', 'piazza', 'music'],
  ['vista-marriage', [P1], '21:00', 60, 'The Marriage Match game show', 'vista', 'games', { age: 'adults', cap: 250 }],
  ['takefive-tribute', [P1], '21:30', 75, 'The Way You Look Tonight: women of jazz tribute', 'takefive', 'music', { cap: 90 }],
  ['pool-fountain', [P1], '21:15', 150, 'Water and Light fountain show and Movies Under the Stars', 'pool', 'family'],
  ['crooners-request', [P1], '22:30', 90, 'Late-night request piano', 'crooners', 'music', { age: 'adults' }],
  ['pool-yoga', [P2], '07:30', 45, 'Sunrise stretch and yoga', 'pool', 'wellness'],
  ['live-trivia', [P2], '09:30', 45, 'Morning music and movie trivia', 'live', 'games'],
  ['piazza-ice', [P2], '14:30', 45, 'Live ice carving and culinary artistry', 'piazza', 'learning'],
  ['live-popstar', [P2], '15:30', 75, 'Princess Pop Star auditions', 'live', 'games'],
  ['wake-sunset', [P2], '17:45', 45, 'Sunset acoustic session', 'pool', 'music'],
  ['theater-skies-1', [P2], '19:00', 60, '5-SKIES, a VR-inspired musical, early showing', 'theater', 'shows', { cap: 900 }],
  ['theater-skies-2', [P2], '21:15', 60, '5-SKIES, a VR-inspired musical, late showing', 'theater', 'shows', { cap: 900 }],
  ['vista-disco', [P2], '21:30', 90, '70s and 80s Disco Inferno theme party', 'vista', 'nightlife'],
  ['takefive-cuban', [P2], '21:45', 75, 'Toda La Noche: fiery Afro-Cuban jazz', 'takefive', 'music', { cap: 90 }],
  ['live-improv', [P2], '22:30', 60, 'Late-night improv and comedy', 'live', 'shows', { age: 'adults' }],

  ['theater-lecture-2', [S2], '09:30', 45, 'Discovery at Sea enrichment lecture', 'theater', 'learning'],
  ['live-brain', [S2], '11:00', 45, 'Morning brainteasers and crossword challenge', 'live', 'games'],
  ['piazza-line', [S2], '11:45', 45, 'Line dancing class', 'piazza', 'learning'],
  ['pool-caribbean', [S2], '14:00', 90, 'Poolside games and live Caribbean band', 'pool', 'music'],
  ['vista-bingo', [S2], '15:00', 60, 'Afternoon jackpot bingo', 'vista', 'games', { extra: 2500 }],
  ['live-deal', [S2], '16:30', 60, 'Deal or No Deal interactive game show', 'live', 'games', { cap: 150 }],
  ['theater-headline', [S2], '20:00', 75, 'Headline guest vocalist and tribute concert', 'theater', 'shows', { cap: 900 }],
  ['pool-concert', [S2], '21:00', 90, 'Evening concert under the stars', 'pool', 'music'],
  ['vista-majority', [S2], '21:15', 75, 'Majority Rules game show and DJ dance floor', 'vista', 'games', { age: 'adults' }],
  ['takefive-jam', [S2], '22:00', 90, 'Late-night jazz jam session', 'takefive', 'music', { cap: 90 }],

  ['live-final-trivia', [L], '09:00', 60, 'Final trivia tournament and Wake Show', 'live', 'games'],
  ['piazza-piano', [L], '09:30', 60, 'Morning piano and pastries', 'piazza', 'music'],
  ['vista-craft', [L], '11:00', 60, 'Family craft and trivia hour', 'vista', 'family'],
  ['theater-voice', [L], '14:00', 60, 'The Voice of the Ocean live finale', 'theater', 'shows', { cap: 900 }],
  ['pool-bbq', [L], '15:30', 90, 'Farewell poolside band and barbecue music', 'pool', 'music'],
  ['piazza-dance', [L], '17:00', 45, 'Passenger dance showcase', 'piazza', 'shows'],
  ['theater-farewell', [L], '20:00', 75, 'Farewell variety show: comedians and singers', 'theater', 'shows', { cap: 900 }],
  ['takefive-gala', [L], '21:30', 75, 'Farewell jazz gala', 'takefive', 'music', { cap: 90 }],
  ['crooners-final', [L], '22:00', 90, 'Final night piano sing-along', 'crooners', 'music', { age: 'adults' }],
  ['pool-midnight', [L], '22:30', 90, 'Late-night Movies Under the Stars', 'pool', 'family'],
  // Day 6, the second formal port day
  ['piazza-harp', [P6], '09:15', 45, 'Morning classical harp and violin', 'piazza', 'music'],
  ['live-trivia6', [P6], '10:30', 45, 'General knowledge trivia', 'live', 'games'],
  ['takefive-swing', [P6], '14:00', 60, 'Afternoon swing dance workshop', 'takefive', 'learning'],
  ['piazza-acrobat', [P6], '15:00', 45, 'Pop-up acrobat and juggling variety act', 'piazza', 'shows'],
  ['pool-film6', [P6], '15:00', 120, 'Afternoon blockbuster movie', 'pool', 'family'],
  ['theater-spotlight-1', [P6], '19:00', 60, 'Production show: Spotlight Bar, early showing', 'theater', 'shows', { cap: 900 }],
  ['theater-spotlight-2', [P6], '21:15', 60, 'Production show: Spotlight Bar, late showing', 'theater', 'shows', { cap: 900 }],
  ['piazza-balloon', [P6], '21:30', 90, 'Gala balloon drop party and live band', 'piazza', 'nightlife'],
  ['takefive-cool', [P6], '21:45', 75, 'Classic cool jazz and craft cocktails', 'takefive', 'music'],
  ['vista-comedy6', [P6], '22:30', 90, 'Adult comedy and late-night clubbing', 'vista', 'nightlife', { age: 'adults' }],
  ...casinoRows(),
]

const sapphireRows = (): Row[] => [
  ['piazza-duo', [E], '10:00', 45, 'Embarkation piano and violin duo', 'piazza', 'music'],
  ['skywalkers-view', [E], '10:30', 90, 'Panoramic observation and quiet lounge', 'skywalkers', 'wellness'],
  ['theater-orient', [E], '11:30', 30, 'Ship orientation and shore excursion talk', 'theater', 'learning'],
  ['pool-sailaway', [E], '16:00', 60, 'Sailaway deck party with live band and cruise staff', 'pool', 'music'],
  ['theater-welcome', [E], '20:30', 75, 'Welcome aboard variety show', 'theater', 'shows', { cap: 800 }],
  ['fusion-karaoke', [E], '21:30', 90, 'Welcome aboard karaoke and party band', 'fusion', 'nightlife'],
  ['wheelhouse-easy', [E], '21:00', 120, 'Live ballroom and easy listening music', 'live-wheelhouse', 'music', { age: 'adults' }],
  ['skywalkers-dj', [E], '22:00', 120, 'Opening night DJ dance party', 'skywalkers', 'nightlife', { age: 'adults' }],

  ['pool-stretch', [F], '08:00', 45, 'Morning stretch and Walk-a-Mile', 'pool', 'wellness'],
  ['explorers-wake', [F], '09:00', 60, 'Morning trivia and Wake Show', 'explorers', 'games', { cap: 200 }],
  ['fusion-line', [F], '10:30', 45, 'Country line dancing lesson', 'fusion', 'learning'],
  ['theater-culinary', [F], '11:30', 45, 'Culinary demonstration and galley tour', 'theater', 'learning'],
  ['pool-movie', [F], '13:00', 120, 'Afternoon Movies Under the Stars', 'pool', 'family'],
  ['explorers-auction', [F], '14:00', 60, 'Fine art auction and champagne', 'explorers', 'learning'],
  ['piazza-quartet', [F], '15:00', 60, 'Classical string quartet concert', 'piazza', 'music'],
  ['piazza-waterfall', [F], '18:00', 30, 'Captain’s Welcome Champagne Waterfall', 'piazza', 'music'],
  ['theater-bravo-1', [F], '19:00', 60, 'Production show: Bravo (opera meets pop), early showing', 'theater', 'shows', { cap: 800 }],
  ['theater-bravo-2', [F], '21:15', 60, 'Production show: Bravo (opera meets pop), late showing', 'theater', 'shows', { cap: 800 }],
  ['wheelhouse-formal', [F], '21:00', 120, 'Formal night ballroom and swing band', 'live-wheelhouse', 'music', { age: 'adults' }],
  ['explorers-comedy', [F], '22:15', 60, 'Late-night stand-up comedian', 'explorers', 'shows', { age: 'adults' }],

  ['piazza-guitar', [PORT], '08:30', 60, 'Morning classical guitar', 'piazza', 'music'],
  ['theater-lecture', [PORT], '10:00', 45, 'Destination port and wildlife lecture', 'theater', 'learning'],
  ['skywalkers-scenic', [PORT], '14:00', 120, 'Scenic cruising and quiet reading lounge', 'skywalkers', 'wellness'],
  ['wheelhouse-cards', [PORT], '14:30', 90, 'Afternoon card games and bridge social', 'live-wheelhouse', 'games'],
  ['piazza-sailaway', [PORT], '17:30', 45, 'Sailaway acoustic duo', 'piazza', 'music'],
  ['fusion-popstar', [P1], '21:00', 90, 'Princess Pop Star singing competition', 'fusion', 'games'],
  ['explorers-charades', [P1], '21:15', 75, 'Musical charades and game show night', 'explorers', 'games'],
  ['crooners-ratpack', [P1], '21:30', 90, 'Rat Pack piano and martini requests', 'crooners', 'music', { age: 'adults' }],
  ['pool-blockbuster', [P1], '21:00', 150, 'Evening blockbuster on Movies Under the Stars', 'pool', 'family'],
  ['pool-tai-chi', [P2], '07:30', 45, 'Sunrise tai chi and yoga', 'pool', 'wellness'],
  ['explorers-pop', [P2], '09:30', 45, 'Morning music and pop culture trivia', 'explorers', 'games'],
  ['piazza-carving', [P2], '14:30', 45, 'Fruit carving and ice sculpting demo', 'piazza', 'learning'],
  ['fusion-bingo', [P2], '15:00', 60, 'Afternoon jackpot bingo', 'fusion', 'games', { extra: 2500 }],
  ['wheelhouse-blues', [P2], '17:15', 75, 'Late-afternoon blues and jazz combo', 'live-wheelhouse', 'music'],
  ['theater-magic-1', [P2], '19:00', 60, 'Production show: Magic to Do, early showing', 'theater', 'shows', { cap: 800 }],
  ['theater-magic-2', [P2], '21:15', 60, 'Production show: Magic to Do, late showing', 'theater', 'shows', { cap: 800 }],
  ['fusion-disco', [P2], '21:30', 90, '70s and 80s disco night theme party', 'fusion', 'nightlife'],
  ['explorers-magic', [P2], '22:00', 60, 'Guest comedian and magician showcase', 'explorers', 'shows', { age: 'adults' }],
  ['skywalkers-neon', [P2], '22:30', 90, 'Late-night DJ and neon dance floor', 'skywalkers', 'nightlife', { age: 'adults' }],

  ['theater-lecture-2', [S2], '09:30', 45, 'Discovery at Sea enrichment talk', 'theater', 'learning'],
  ['explorers-brain', [S2], '11:00', 45, 'Morning brainteasers and trivia', 'explorers', 'games'],
  ['piazza-chacha', [S2], '11:45', 45, 'Ballroom cha-cha and rumba lesson', 'piazza', 'learning'],
  ['pool-caribbean', [S2], '14:00', 90, 'Poolside games and live Caribbean band', 'pool', 'music'],
  ['piazza-balance', [S2], '15:30', 45, 'Pop-up variety and balancing act', 'piazza', 'shows'],
  ['explorers-liars', [S2], '16:30', 60, 'Liar’s Club comedy game show', 'explorers', 'games', { cap: 200 }],
  ['theater-headline', [S2], '20:00', 75, 'Headline guest vocalist or instrumental virtuoso', 'theater', 'shows', { cap: 800 }],
  ['fusion-hoedown', [S2], '21:15', 90, 'Country and western hoe-down with a live band', 'fusion', 'nightlife'],
  ['wheelhouse-blues2', [S2], '21:30', 90, 'Classic blues and slow dancing', 'live-wheelhouse', 'music', { age: 'adults' }],
  ['pool-concert', [S2], '21:00', 90, 'Concert screening under the stars', 'pool', 'family'],

  ['explorers-final', [L], '09:00', 60, 'Final trivia championship and Wake Show', 'explorers', 'games'],
  ['piazza-coffee', [L], '09:30', 60, 'Morning acoustic guitar and coffee', 'piazza', 'music'],
  ['fusion-crafts', [L], '11:00', 60, 'Family crafts and games', 'fusion', 'family'],
  ['theater-voice', [L], '14:00', 60, 'The Voice of the Ocean live finale', 'theater', 'shows', { cap: 800 }],
  ['pool-farewell', [L], '15:30', 90, 'Farewell poolside band', 'pool', 'music'],
  ['piazza-choir', [L], '17:00', 45, 'Passenger choir and dance showcase', 'piazza', 'shows'],
  ['theater-farewell', [L], '20:00', 75, 'Farewell variety spectacular', 'theater', 'shows', { cap: 800 }],
  ['fusion-grand', [L], '21:15', 90, 'Princess Pop Star grand finale and karaoke', 'fusion', 'games'],
  ['crooners-final', [L], '22:00', 90, 'Farewell piano sing-along', 'crooners', 'music', { age: 'adults' }],
  ['pool-midnight', [L], '22:30', 90, 'Late-night Movies Under the Stars', 'pool', 'family'],
  // Day 6, the second formal port day
  ['piazza-violin', [P6], '09:15', 45, 'Morning violin and piano recital', 'piazza', 'music'],
  ['explorers-trivia6', [P6], '10:30', 45, 'General knowledge trivia', 'explorers', 'games'],
  ['fusion-swing', [P6], '14:00', 60, 'Swing and salsa dance workshop', 'fusion', 'learning'],
  ['skywalkers-tea', [P6], '15:00', 90, 'Scenic observation and tea service', 'skywalkers', 'learning'],
  ['pool-film6', [P6], '15:00', 120, 'Afternoon feature film', 'pool', 'family'],
  ['theater-encore-1', [P6], '19:00', 60, 'Production show: Encore, early showing', 'theater', 'shows', { cap: 800 }],
  ['theater-encore-2', [P6], '21:15', 60, 'Production show: Encore, late showing', 'theater', 'shows', { cap: 800 }],
  ['piazza-balloon', [P6], '21:30', 90, 'Gala balloon drop party and live orchestra', 'piazza', 'nightlife'],
  ['explorers-majority', [P6], '22:00', 60, 'Majority Rules adult game show', 'explorers', 'games', { age: 'adults' }],
  ['skywalkers-dj6', [P6], '22:30', 90, 'Formal night DJ clubbing', 'skywalkers', 'nightlife', { age: 'adults' }],
  ...casinoRows(),
]

const ROWS: Record<string, () => Row[]> = { 'sun-princess': sunRows, 'sky-princess': skyRows, 'sapphire-princess': sapphireRows }

/** The entertainment events of a ship. A one-line `detail` is made from where and when, so every event reads the same way on its venue's page. */
export function entertainmentEvents(shipId: string): ExplorerEventRow[] {
  const s = SHIPS[shipId]
  const titles = new Map(s.venues.map((v) => [idOf(s, v.key), v.title]))
  return build(s, ROWS[shipId]()).map((e) => ({ ...e, detail: DETAIL(e, titles.get(e.venueId) ?? '') }))
}

const DETAIL = (e: ExplorerEventRow, where: string): string => {
  const parts = [`At ${where}.`]
  if (e.extra > 0) parts.push('Extra cost, paid on board.')
  if (e.capacity) parts.push('Places are limited.')
  return parts.join(' ')
}
