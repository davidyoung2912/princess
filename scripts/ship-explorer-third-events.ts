// The third pass at the 7-day schedule (docs/review-and-completeness-plan.md, Phase A). The audit of the first two passes found five gaps: the morning of disembarkation had no events,
// most specialty restaurants and several bars had none (so a guest saw a menu but nothing to book or plan around), port days were thin on food and drink, the first afternoon had little
// beyond the muster, and children and teens had 16 events in a week. Authored concept content like the rest of the Explorer: start times and lengths are chosen here for review.
// One table is shared by the three ships. A role names a few candidate venues by id without the ship prefix; the first one the ship has is used, and a ship with none skips the row.
import type { HoursRule } from '../src/features/explorer/domain/types.ts'
import type { ExplorerEventRow } from './ship-explorer-data.ts'

const ROLES: Record<string, string[]> = {
  steak: ['crown'], italian: ['sabatini'], seafood: ['catch', 'crab-shack', 'love'], asian: ['makoto', 'umai', 'ocean-terrace-sushi'], chef: ['ex-360', 'butchers-block', 'sanctuary-restaurant', 'crown'],
  main: ['soleil', 'international'], diner: ['americana', 'salty-dog-grill', 'salty-dog-gastropub'], tacos: ['lido-grill', 'trident-grill'], pizza: ['promenade-pizzeria', 'slice', 'prego'],
  martini: ['crooners-bar'], sunbar: ['sun-bar', 'outrigger-bar', 'mermaids-tail', 'calypso-bar'], sweets: ['pastry-shop', 'swirls'], eatery: ['eatery'], lido: ['lido'], piazza: ['piazza'],
  pool: ['pool', 'seaview'], live: ['live', 'fusion'], camp: ['act-camp'], teens: ['act-teens'], court: ['fit-court'], studio: ['fit-studio'], gym: ['fit-gym'], tech: ['act-tech'], talks: ['act-talks'],
  spa: ['lotus'], cards: ['act-library'], meet: ['act-meet'], deck: ['act-deck'], cafe: ['intl-cafe'], casino: ['casino'],
}

const FAN_OUT = new Set(['seafood', 'asian', 'chef'])

type Age = ExplorerEventRow['age']
interface Opt { age?: Age; extra?: number; capacity?: number; after?: boolean }
/** slug, role, day kinds, start, minutes, interest, title, detail, options. */
type T = [string, string, string[], string, number, string, string, string, Opt?]

const TABLE: T[] = [
  // ---- Disembarkation morning (the last day, no night aboard): the only events that day
  ['d-breakfast', 'eatery', ['disembark'], '06:00', 150, 'food', 'Early breakfast before you leave', 'The buffet opens early for guests with a morning flight or a self-assist walk-off. Main dining rooms close their breakfast at nine.'],
  ['d-coffee', 'cafe', ['disembark'], '06:30', 150, 'food', 'Farewell coffee and pastries', 'A last coffee and a pastry while you wait for your colour or number to be called.', { age: 'all' }],
  ['d-desk', 'tech', ['disembark'], '07:00', 180, 'learning', 'Help with your bill, receipts and lost property', 'Staff answer questions about the final account, print receipts and take a report of anything left behind. Come early; the desk closes when the ship is cleared.'],
  ['d-walkoff', 'talks', ['disembark'], '07:30', 40, 'learning', 'Walk-off help: customs forms, transfers and luggage', 'A host explains the order of leaving, where to find your bags in the terminal and what to do if a bag is missing.'],
  ['d-camp', 'camp', ['disembark'], '07:30', 150, 'family', 'Youth centre waiting room', 'Children wait with a counselor while the family packs and queues. Parents must collect them before their group is called.', { age: 'kids' }],
  ['d-stretch', 'studio', ['disembark'], '06:30', 30, 'wellness', 'Gentle stretch before the travel day', 'A short stretch to loosen up before the airport or the drive home. Mats provided.'],

  // ---- Embarkation day: the first afternoon and evening
  ['e-lunch', 'eatery', ['embark'], '11:30', 210, 'food', 'Welcome aboard lunch', 'The buffet is open from late morning for guests who board early. The main dining rooms stay closed until dinner.'],
  ['e-toast', 'piazza', ['embark'], '17:30', 30, 'community', 'Captain’s welcome toast', 'The captain and officers welcome the new voyage with a glass of sparkling wine or juice, then the Piazza band plays.', { age: 'all' }],
  ['e-pizza', 'pizza', ['embark'], '15:30', 120, 'food', 'Sailing day pizza slices', 'Fresh slices for guests who board between lunch and dinner. Included with your fare.'],
  ['e-camp', 'camp', ['embark'], '15:30', 60, 'family', 'Welcome to Camp: sign your children up', 'Meet the counselors, tour the youth centre and register your children for the week. A parent must be there to sign.', { age: 'kids' }],
  ['e-spa', 'spa', ['embark'], '12:00', 360, 'wellness', 'Sailing day spa tours and offers', 'Tour the spa and thermal suite and ask about the offers that are only made on the first day. Treatments sell out fast.'],
  ['e-cards', 'cards', ['embark'], '16:00', 60, 'games', 'Meet your bridge and mahjong table', 'Players introduce themselves and set up the week’s games. Beginners welcome.'],

  // ---- Specialty restaurants: the dinners, tastings and lunches the first two passes left out
  ['s-steak-table', 'steak', ['laterSea'], '18:00', 150, 'food', 'Chef’s table: five-course steak tasting', 'A five-course tasting from the grill chef, with a kitchen visit and a glass of wine with each course. Twelve places.', { extra: 8500, capacity: 12 }],
  ['s-steak-wine', 'steak', ['portEven'], '19:00', 120, 'food', 'Steak and red wine pairing dinner', 'The sommelier pairs three cuts with three reds. Booked ahead, one seating.', { age: 'adults', extra: 6500, capacity: 24 }],
  ['s-ital-wine', 'italian', ['firstSea'], '18:30', 120, 'food', 'Italian wine pairing dinner', 'Four regional dishes with a wine from each region, introduced by the sommelier.', { age: 'adults', extra: 5500, capacity: 24 }],
  ['s-ital-pasta', 'italian', ['seaMid'], '17:30', 90, 'food', 'Pasta and prosecco early supper', 'An early, relaxed sea-day supper of fresh pasta, a glass of prosecco and a dessert, before the evening shows.', { extra: 3500, capacity: 30 }],
  ['s-sea-tasting', 'seafood', ['laterSea'], '18:30', 120, 'food', 'Seafood tasting menu', 'Five small plates from the day’s catch, from raw to grilled, with a matching white wine.', { extra: 6000, capacity: 20 }],
  ['s-sea-lunch', 'seafood', ['seaMid'], '18:00', 90, 'food', 'Early seafood supper', 'A shorter, lower-priced early menu of the restaurant’s best known dishes.', { extra: 2500, capacity: 30 }],
  ['s-asia-sake', 'asian', ['portEven'], '17:30', 60, 'food', 'Sake and small plates tasting', 'Three sakes with a guide to how they differ, and bites to match.', { age: 'adults', extra: 2500, capacity: 16 }],
  ['s-asia-show', 'asian', ['firstSea', 'portOdd'], '19:00', 90, 'food', 'Live cooking dinner', 'The chef cooks at your table with a flourish. Seats are shared with other guests.', { extra: 4500, capacity: 16 }],
  ['s-chef-tasting', 'chef', ['seaMid'], '19:00', 150, 'food', 'Chef’s tasting menu', 'The chef’s menu for the evening in six small courses, with a vegetarian version on request.', { extra: 9500, capacity: 14 }],
  ['s-chef-lunch', 'chef', ['laterSea'], '18:30', 90, 'food', 'Early two-course special', 'A two-course early menu with a glass of wine, at a lower price than the full dinner.', { extra: 3000, capacity: 24 }],

  // ---- Main dining rooms, casual rooms and bars with no events yet
  ['m-gala', 'main', ['firstSea'], '18:00', 150, 'food', 'Gala dinner night', 'The formal night: the best table settings, a lobster tail on the menu and photographers at the door. Dress is formal but not required.'],
  ['m-lobster', 'main', ['laterSea'], '17:30', 240, 'food', 'Lobster tail night', 'Lobster tail is added to the entrée list tonight, with the usual choices alongside.'],
  ['m-photos', 'main', ['firstSea'], '17:30', 120, 'community', 'Formal portraits at the dining room door', 'The photographer takes couple, family and group portraits before dinner. No purchase needed.'],
  ['c-shake', 'diner', ['seaMid'], '15:00', 90, 'food', 'Milkshake happy hour', 'Half-price milkshakes and floats in the afternoon.', { age: 'all' }],
  ['c-taco', 'tacos', ['port'], '13:30', 120, 'food', 'Late lunch for guests back from shore', 'Tacos and burgers served after the morning’s tours. Walk in, no booking.'],
  ['c-pizza-night', 'pizza', ['firstSea', 'laterSea'], '22:00', 60, 'food', 'Late-night pizza', 'Hot pizza for the late crowd after the shows. Included with your fare.', { age: 'all' }],
  ['c-sweets', 'sweets', ['laterSea'], '15:30', 60, 'food', 'Afternoon sweets and a sundae special', 'Today’s special sundae or pastry at a lower price, with a free taster for the first twenty.', { age: 'all' }],
  ['b-martini', 'martini', ['seaMid'], '17:30', 45, 'food', 'Martini masterclass', 'The bartender shows three classic martinis, shaken and stirred, and you taste each one.', { age: 'adults', extra: 2000, capacity: 16 }],
  ['b-tiki', 'sunbar', ['laterSea'], '16:30', 60, 'food', 'Tiki cocktails and a steel drum duo', 'Rum drinks with a garnish at the bar by the pool, with live steel drums.', { age: 'adults' }],
  ['b-sunset', 'sunbar', ['port'], '17:30', 60, 'food', 'Sail-away happy hour', 'Two-for-one signature drinks as the ship leaves the harbour.', { age: 'adults', after: true }],

  // ---- Port days: things to come back to
  ['p-spa', 'spa', ['port'], '10:00', 240, 'wellness', 'Port day spa special', 'Treatments are offered at a lower price while many guests are ashore. Book at the spa desk.', { age: 'adults' }],
  ['p-deck', 'pool', ['earlyPortOdd'], '17:00', 60, 'music', 'Sail-away deck party', 'A DJ and a band play as the ship leaves port, with drinks specials at the bar.', { age: 'all', after: true }],
  ['p-quiz', 'live', ['portEven', 'lastPort'], '18:30', 45, 'games', 'Port day quiz: how well did you see the town?', 'Teams answer questions about the place you visited. Prizes for the winners.', { age: 'all', after: true }],
  ['p-craft', 'cards', ['port'], '13:00', 120, 'games', 'Quiet afternoon at the card tables', 'The tables stay open for guests who stay aboard. A host deals the first hand.', { age: 'all' }],
  ['p-gym', 'gym', ['port'], '07:00', 120, 'wellness', 'Port day gym: the machines are free', 'The gym is at its quietest while the ship is in port. A trainer is on the floor until nine.'],
  ['p-camp', 'camp', ['port'], '09:00', 360, 'family', 'Port day youth club', 'Supervised play for registered children while parents are ashore. Lunch is served. Parents must be back at the dock by the time the ship sails.', { age: 'kids' }],

  // ---- Late night
  ['n-comedy', 'live', ['laterSea', 'portEven'], '22:30', 45, 'nightlife', 'Late-night adults-only comedy', 'Stand-up with no holds barred. Adults only; seats are first come.', { age: 'adults' }],
  ['n-silent', 'pool', ['laterSea'], '23:00', 90, 'nightlife', 'Silent disco on deck', 'Headphones, three channels and a DJ under the stars. Weather permitting.', { age: 'adults' }],
  ['n-casino', 'casino', ['seaMid'], '22:00', 120, 'games', 'Late-night slots tournament', 'A free-entry slots tournament with a prize pool. Adults only.', { age: 'adults' }],

  // ---- Children and teens
  ['k-pizza', 'camp', ['seaMid'], '18:00', 60, 'family', 'Kids’ pizza party', 'Children make and eat their own pizza with a counselor. Allergy-friendly options on request.', { age: 'kids' }],
  ['k-sitting', 'camp', ['laterSea', 'portEven'], '21:00', 180, 'family', 'Parents’ night out: late youth sitting', 'Supervised play, a film and a snack for registered children aged three to twelve while parents have dinner. A small fee applies.', { age: 'kids', extra: 1500, capacity: 30 }],
  ['k-ocean', 'camp', ['firstSea'], '10:30', 60, 'family', 'Junior ocean explorers', 'Hands-on science for children: plankton, currents and the ship’s weather station.', { age: 'kids' }],
  ['k-splash', 'pool', ['laterSea'], '10:00', 60, 'family', 'Toddler splash time', 'A shallow pool with a lifeguard for children under five and their parents.', { age: 'kids' }],
  ['k-games', 'pool', ['seaMid'], '15:30', 45, 'family', 'Family pool games', 'Relay races and a noodle toss for all ages. Hats on.', { age: 'all' }],
  ['k-sports', 'court', ['seaMid', 'portEven'], '15:30', 60, 'games', 'Teen basketball and football tournament', 'Teams of three play on the court with a counselor as referee.', { age: 'teens' }],
  ['k-movie', 'teens', ['seaMid'], '22:00', 120, 'family', 'Teen late-night movie', 'A film chosen by the teens’ vote, with popcorn. Supervised until midnight.', { age: 'teens' }],
  ['k-teen-ship', 'teens', ['firstSea'], '13:30', 90, 'games', 'Teen ship race', 'Teams race around the ship to find clues and take photos. Meet at the teen centre.', { age: 'teens' }],
  ['k-family-night', 'cards', ['seaMid'], '19:30', 60, 'family', 'Family board game night', 'Staff lend out games and teach the rules. Come as a family or join one.', { age: 'all' }],
  ['k-deck', 'deck', ['port'], '16:30', 45, 'family', 'Sail-away with the youngest guests', 'Children wave goodbye to the port from the rail with a counselor and a flag.', { age: 'kids', after: true }],
]

/**
 * Opening hours for the morning of disembarkation. A venue's rules say `sea` and `night`, and the last day has no night aboard, so everything read as closed that morning: no breakfast,
 * no help desk. These are the rooms that really do open before the ship is cleared; each gets one `disembark` rule (a venue with none stays closed).
 */
const DISEMBARK_HOURS: Record<string, [string, string][]> = {
  eatery: [['06:00', '10:30']], 'intl-cafe': [['06:00', '11:00']], cielo: [['07:00', '09:00']], soleil: [['07:00', '09:00']], international: [['07:00', '09:00']],
  'act-tech': [['07:00', '11:00']], 'act-talks': [['07:30', '09:00']], 'act-camp': [['07:30', '10:30']], 'fit-gym': [['06:00', '10:00']], 'fit-studio': [['06:30', '09:00']],
}

export function withDisembarkHours<V extends { id: string; hours: HoursRule[] }>(prefix: string, venues: readonly V[]): V[] {
  return venues.map((v) => {
    const windows = DISEMBARK_HOURS[prefix && v.id.startsWith(prefix) ? v.id.slice(prefix.length) : v.id]
    return windows ? { ...v, hours: [...v.hours, { kind: 'fixed' as const, when: ['disembark'], windows }] } : v
  })
}

/** The third-pass events for a ship, in the ship's own rooms. */
export function thirdEvents(prefix: string, venueIds: ReadonlySet<string>): ExplorerEventRow[] {
  const out: ExplorerEventRow[] = []
  for (const [slug, role, when, start, minutes, interest, title, detail, o = {}] of TABLE) {
    const found = (ROLES[role] ?? [role]).map((s) => `${prefix}${s}`).filter((id) => venueIds.has(id))
    // A specialty role runs at every restaurant of its kind the ship has; any other role at the first room the ship has.
    const venues = FAN_OUT.has(role) ? found : found.slice(0, 1)
    venues.forEach((venueId, i) => out.push({ id: `${prefix}y-${slug}${i > 0 ? `-${i + 1}` : ''}`, venueId, when, start, minutes, title, detail, age: o.age ?? 'all', interest, extra: o.extra ?? 0, ...(o.capacity ? { capacity: o.capacity } : {}), ...(o.after ? { afterAllAboard: true } : {}) }))
  }
  return out
}
