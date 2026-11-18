/**
 * Where a pill can send a guest (docs/stanley-answers-plan.md, 5.10): every screen the engine may offer, with its path, its generic label and when it makes sense. One table, so a path is written once and a test
 * can check that each one is a real route and each label exists. `needs` says what must be true for the guest; `instead` is the screen offered when it is not.
 */
import { SCREEN_BY_ID } from '../../routes/screens'
import { SCREEN_SPECS } from './screenSpec'

export type Need = 'booking' | 'aboard' | 'ashore' | 'beforeSailing'

export interface Destination { path: string; needs?: Need; instead?: string }

const BASE_DESTINATIONS: Readonly<Record<string, Destination>> = {
  // explorers and the ship
  dining: { path: '/dining-today' }, 'dining.book': { path: '/dining-today?reserve=new', needs: 'booking', instead: 'dining' }, 'dining.mine': { path: '/dining-today?view=trip', needs: 'booking' },
  venues: { path: '/ship/venues' }, drinks: { path: '/ship/drinks' }, order: { path: '/ship/order', needs: 'aboard', instead: 'dining' },
  entertainment: { path: '/entertainment' }, activities: { path: '/activities-explorer' }, games: { path: '/games-explorer' }, challenges: { path: '/ship/games' },
  spa: { path: '/spa-explorer' }, 'spa.book': { path: '/spa-explorer?book=new', needs: 'booking', instead: 'spa' }, exercise: { path: '/exercise-explorer' }, shops: { path: '/shopping-today' },
  excursions: { path: '/excursions-explorer' }, 'excursions.mine': { path: '/excursions-explorer?view=trip', needs: 'booking' },
  ports: { path: '/home/ports' }, portguide: { path: '/ship/port/guide', needs: 'aboard', instead: 'ports' }, portday: { path: '/ship/port', needs: 'aboard', instead: 'ports' }, safeashore: { path: '/ship/safe-ashore', needs: 'aboard' },
  map: { path: '/ship/map' }, deckplans: { path: '/deck-plans' }, shipinfo: { path: '/home/ship' }, ships: { path: '/home/ships' }, shipcompare: { path: '/home/ships/compare' },
  photos: { path: '/ship/photos' }, community: { path: '/ship/community' }, room: { path: '/ship/room', needs: 'aboard' }, requests: { path: '/ship/requests', needs: 'aboard' }, tv: { path: '/ship/tv', needs: 'aboard' },
  laundry: { path: '/ship/laundry' }, wifi: { path: '/ship/wifi' }, textHelp: { path: '/ship/text-help' },
  // finding and booking a cruise
  cabins: { path: '/home/cabins' }, sailings: { path: '/home/sailings' }, explore: { path: '/home/explore' }, book: { path: '/book' }, decide: { path: '/home/decide' }, saved: { path: '/home/saved' }, quiz: { path: '/home/quiz' }, cost: { path: '/home/cruise/cost' },
  // the trip, before and after
  trips: { path: '/me/trips' }, checkin: { path: '/home/check-in' }, boardingpass: { path: '/home/boarding-pass' }, findpass: { path: '/home/find-pass' }, embarkation: { path: '/home/embarkation' }, muster: { path: '/ship/muster', needs: 'aboard' },
  documents: { path: '/me/documents' }, disembark: { path: '/home/disembark' }, bags: { path: '/home/disembark/bags' }, customs: { path: '/home/disembark/customs' }, onward: { path: '/home/disembark/onward' },
  // my plan and money
  plan: { path: '/plan' }, 'plan.day': { path: '/plan/day' }, reservations: { path: '/plan/reservations', needs: 'booking' }, packing: { path: '/plan/packing' }, reminders: { path: '/me/reminders' }, poll: { path: '/plan/group-poll' }, party: { path: '/plan/party' },
  weatherplan: { path: '/plan/weather' }, phoneplan: { path: '/plan/phone' }, checklist: { path: '/plan/checklist', needs: 'booking' },
  bill: { path: '/me/bill', needs: 'booking' }, payments: { path: '/me/payments' }, packages: { path: '/me/packages' }, loyalty: { path: '/me/loyalty' }, money: { path: '/me/money' },
  // help, people and the app
  health: { path: '/ship/health' }, access: { path: '/ship/access' }, planaccess: { path: '/plan/access' }, helpnow: { path: '/ship/help-now', needs: 'aboard' }, lostfound: { path: '/ship/lost-found' }, cases: { path: '/me/cases' }, contact: { path: '/me/contact' },
  guestchat: { path: '/chat/service' }, chat: { path: '/chat' }, people: { path: '/chat/people' }, rooms: { path: '/chat/rooms' },
  weather: { path: '/weather' }, settings: { path: '/me/settings' }, notifications: { path: '/me/notifications' }, privacy: { path: '/me/privacy' }, help: { path: '/me/help' }, feedback: { path: '/me/feedback' }, reportproblem: { path: '/me/report-problem' },
  allergy: { path: '/plan/allergy' }, medallion: { path: '/home/medallion' }, gettingthere: { path: '/plan/getting-there' }, sustain: { path: '/me/sustainability' },
  family: { path: '/ship/family' }, teen: { path: '/ship/teen' }, solo: { path: '/ship/solo' }, itinerary: { path: '/itinerary' }, today: { path: '/today' }, search: { path: '/ship/search' },
}

/** The names the base table uses, so a long tail screen can be checked against them. */
export const BASE_DESTINATION_NAMES: ReadonlySet<string> = new Set(Object.keys(BASE_DESTINATIONS))

/** The base destinations and the screens of the long tail topics, by their path in the screen list. */
export const DESTINATIONS: Readonly<Record<string, Destination>> = {
  ...BASE_DESTINATIONS,
  ...Object.fromEntries(SCREEN_SPECS.flatMap((x) => x.dests.split(' ').map((d) => { const [name, id] = d.split('='); return [name!, { path: SCREEN_BY_ID.get(id!)!.path }] as const }))),
}

export type DestinationId = keyof typeof DESTINATIONS & string
