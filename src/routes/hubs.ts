import type { StringKey } from '../i18n'
import type { StageId } from '../domain/sailings'
import { ROUTES, type TabId } from './routes.ts'

/** The eleven stages of a guest's journey (customer-journey-priorities.md), in order. */
export const JOURNEY_STAGES = ['dream', 'discover', 'book', 'manage', 'prebook', 'getToShip', 'embark', 'sea', 'port', 'disembark', 'remember'] as const
export type JourneyStage = (typeof JOURNEY_STAGES)[number]

/** The journey stage a point on the sailing falls in. */
export const JOURNEY_OF_STAGE: Record<StageId, JourneyStage> = {
  booked: 'manage',
  preCruise: 'prebook',
  checkIn: 'getToShip',
  embarkation: 'embark',
  seaDay: 'sea',
  cozumel: 'port',
  belize: 'port',
  roatan: 'port',
  seaDay2: 'sea',
  farewell: 'sea',
  disembark: 'disembark',
  postCruise: 'remember',
}

/** The one screen to open for each stage of the trip. */
export const STAGE_ACTION: Record<JourneyStage, string> = {
  dream: '/home/quiz',
  discover: '/home/cruise',
  book: '/book',
  manage: '/plan/checklist',
  prebook: '/plan/checklist',
  getToShip: '/plan/getting-there',
  embark: '/home/embarkation',
  sea: '/plan/day',
  port: '/ship/port',
  disembark: '/home/disembark',
  remember: '/me/recap',
}

/** A group of screens on one of the five tabs. Opening a hub and then a screen is the third tap. */
export interface HubDef {
  id: string
  tab: TabId
  labelKey: StringKey
  /** The journey stage the hub mostly serves; the hub for the guest's current stage opens by itself. */
  stage: JourneyStage
  paths: readonly string[]
}

const plan = (s: string) => `/plan/${s}`
const ship = (s: string) => `/ship/${s}`
const me = (s: string) => `/me/${s}`
const home = (s: string) => `/home/${s}`

export const HUBS: readonly HubDef[] = [
  { id: 'home.discover', tab: 'home', labelKey: 'hub.home.discover', stage: 'discover', paths: [home('cruise'), home('cruise/cost'), home('sailings'), home('ship'), home('saved'), home('quiz'), home('advisors'), home('cabins'), home('decide'), home('offers'), '/book'] },
  { id: 'home.ask', tab: 'home', labelKey: 'hub.home.ask', stage: 'manage', paths: [home('concierge'), home('ask'), home('briefing'), home('summary'), home('updates')] },
  { id: 'home.board', tab: 'home', labelKey: 'hub.home.board', stage: 'embark', paths: [home('find-pass'), home('boarding-pass'), home('check-in'), home('check-in/receipt'), home('check-in/terminal'), home('embarkation'), home('embarkation/steps'), home('embarkation/plan'), home('medallion'), home('luggage'), home('clearance')] },
  { id: 'home.change', tab: 'home', labelKey: 'hub.home.change', stage: 'getToShip', paths: [home('disruption'), home('delayed')] },
  { id: 'home.leave', tab: 'home', labelKey: 'hub.home.leave', stage: 'disembark', paths: [home('disembark'), home('disembark/customs'), home('disembark/onward'), home('disembark/final-night'), home('disembark/sweep'), home('disembark/bags'), home('disembark/flight'), home('disembark/ride')] },

  { id: 'plan.money', tab: 'plan', labelKey: 'hub.plan.money', stage: 'book', paths: [plan('contract'), plan('money-plan'), plan('split'), plan('shares'), plan('price-watch'), plan('fare-check'), plan('guarantee'), plan('prepay'), plan('cart'), plan('upgrades')] },
  { id: 'plan.docs', tab: 'plan', labelKey: 'hub.plan.docs', stage: 'manage', paths: [plan('medical'), plan('access'), plan('assistance'), plan('allergy'), plan('health-prep'), plan('hold'), plan('paste'), plan('readiness')] },
  { id: 'plan.travel', tab: 'plan', labelKey: 'hub.plan.travel', stage: 'getToShip', paths: [plan('travel'), plan('getting-there'), plan('weather'), plan('storm'), plan('away'), plan('what-if')] },
  { id: 'plan.pack', tab: 'plan', labelKey: 'hub.plan.pack', stage: 'prebook', paths: [plan('checklist'), plan('packing'), plan('ship-packing'), plan('starter'), plan('phone'), plan('difficulty')] },
  { id: 'plan.week', tab: 'plan', labelKey: 'hub.plan.week', stage: 'sea', paths: [plan('day'), plan('reservations'), plan('excursions'), plan('dining'), plan('autopilot'), plan('rhythm'), plan('surprises'), plan('taste'), plan('organiser'), plan('traditions'), plan('compare')] },
  { id: 'plan.group', tab: 'plan', labelKey: 'hub.plan.group', stage: 'manage', paths: [plan('party'), plan('family-link'), plan('group-poll'), plan('child-story'), plan('child-brief'), plan('cabins')] },
  { id: 'plan.wish', tab: 'plan', labelKey: 'hub.plan.wish', stage: 'prebook', paths: [plan('ahead'), plan('clubs'), plan('gifts')] },

  { id: 'ship.safety', tab: 'ship', labelKey: 'hub.ship.safety', stage: 'embark', paths: [ship('emergency'), ship('muster'), ship('help-now'), ship('report'), ship('health'), ship('seasick'), ship('safe-ashore'), ship('allergy-chain'), ship('lost-found'), ship('access'), ship('dnd')] },
  { id: 'ship.find', tab: 'ship', labelKey: 'hub.ship.find', stage: 'sea', paths: [ship('map'), ship('venues'), ship('info'), ship('search'), ship('steps'), ship('loungers'), ship('sightings'), ship('sky'), ship('pulse'), ship('ask-ship')] },
  { id: 'ship.service', tab: 'ship', labelKey: 'hub.ship.service', stage: 'sea', paths: [ship('order'), ship('drinks'), ship('shops'), ship('spa'), ship('dining-prefs'), ship('laundry'), ship('requests'), ship('room'), ship('wifi'), ship('tv')] },
  { id: 'ship.port', tab: 'ship', labelKey: 'hub.ship.port', stage: 'port', paths: [ship('port'), ship('port/guide'), ship('port/snapshot')] },
  { id: 'ship.people', tab: 'ship', labelKey: 'hub.ship.people', stage: 'sea', paths: [ship('family'), ship('kids-report'), ship('teen'), ship('games'), ship('community'), ship('solo'), ship('ok-tap'), ship('you-said'), ship('photos'), ship('read-aloud')] },

  { id: 'me.money', tab: 'me', labelKey: 'hub.me.money', stage: 'manage', paths: [me('trips'), me('bill'), me('ledger'), me('money'), me('bill/final'), me('payments'), me('packages'), me('loyalty')] },
  { id: 'me.docs', tab: 'me', labelKey: 'hub.me.docs', stage: 'manage', paths: [me('profile'), me('documents'), me('helper')] },
  { id: 'me.after', tab: 'me', labelKey: 'hub.me.after', stage: 'remember', paths: [me('recap'), me('history'), me('feedback'), me('farewell'), me('follow-up'), me('rebook'), me('sustainability'), me('wrapped'), me('memories')] },
  { id: 'me.rules', tab: 'me', labelKey: 'hub.me.rules', stage: 'manage', paths: [me('privacy'), me('marketing'), me('print'), me('notifications'), me('alerts'), me('calm'), me('gentle'), me('anxiety'), me('settings')] },
  { id: 'me.help', tab: 'me', labelKey: 'hub.me.help', stage: 'manage', paths: [me('help'), me('contact'), me('cases'), me('fix-it'), me('assist'), me('status'), me('report-problem'), me('demo')] },
]

/** The few screens each tab keeps on its front page, one tap below the tab, because guests reach them most. */
export const QUICK: Record<TabId, readonly string[]> = {
  home: ['/home/boarding-pass', '/home/check-in', '/home/embarkation', '/home/sailings', '/book'],
  plan: ['/plan/day', '/plan/reservations', '/plan/excursions', '/plan/dining', '/plan/checklist', '/plan/packing', '/plan/travel'],
  ship: ['/ship/map', '/ship/venues', '/ship/order', '/ship/family', '/ship/help-now', '/ship/port'],
  chat: [],
  me: ['/me/trips', '/me/profile', '/me/bill', '/me/packages', '/me/documents', '/me/settings', '/me/help'],
}

/** Screens opened from a list screen with an id, filed under the list they come from. */
export const PARENT: Record<string, string> = {
  '/plan/reservations/:id': '/plan/reservations',
  '/home/sailings/:id': '/home/sailings',
  '/home/ports/:id': '/home/sailings',
  '/home/check-in/:id': '/home/check-in',
  '/ship/venues/:id': '/ship/venues',
  '/book/:id': '/book',
  '/book/confirmed/:id': '/book',
  '/book/resume/:id': '/book',
  '/book/pay/:id': '/book',
  '/me/trips/:id': '/me/trips',
  '/me/profile/:id': '/me/profile',
}

/** Screens that are not part of the guest's journey: the component kit and links opened by someone with no account. */
const OUTSIDE = (path: string): boolean => path === '/kit' || ROUTES.find((r) => r.path === path)?.public === true

const TAB_PATHS: ReadonlySet<string> = new Set(['/', '/plan', '/ship', '/chat', '/me'])

export const hubsOf = (tab: TabId): HubDef[] => HUBS.filter((h) => h.tab === tab)

/** The hub a screen is filed under, following an id screen to its list; null for a tab front page or a screen outside the journey. */
export function hubFor(path: string): HubDef | null {
  const own = HUBS.find((h) => h.paths.includes(path))
  if (own) return own
  const parent = PARENT[path]
  return parent ? hubFor(parent) : null
}

/** The journey stage of a screen: its hub's stage (tab front pages serve the stage of their tab's first hub). */
export function stageOfPath(path: string): JourneyStage | null {
  if (TAB_PATHS.has(path)) return path === '/' ? 'manage' : path === '/plan' ? 'prebook' : path === '/ship' ? 'sea' : path === '/chat' ? 'sea' : 'manage'
  return hubFor(path)?.stage ?? null
}

/**
 * How many taps a screen is from app launch: a tab is one, a screen kept on its tab's front page is two, a screen in a hub is
 * three (tab, open the hub, tap the screen), and an id screen is one more than its list. Null for screens outside the journey.
 */
export function depthOf(path: string): number | null {
  if (OUTSIDE(path)) return null
  if (TAB_PATHS.has(path)) return 1
  const parent = PARENT[path]
  if (parent) {
    const d = depthOf(parent)
    return d === null ? null : d + 1
  }
  const route = ROUTES.find((r) => r.path === path)
  if (!route || route.tab === null) return null
  if (QUICK[route.tab].includes(path)) return 2
  return hubFor(path) ? 3 : null
}

/** Problems with the hubs: a screen in no hub or two, an unknown path, a screen more than three taps deep, a quick link not in a hub. */
export function hubProblems(maxTaps = 3): string[] {
  const problems: string[] = []
  const known = new Set(ROUTES.map((r) => r.path))
  const count = new Map<string, number>()
  for (const h of HUBS) {
    for (const p of h.paths) {
      count.set(p, (count.get(p) ?? 0) + 1)
      if (!known.has(p)) problems.push(`hub ${h.id} lists unknown screen ${p}`)
      else if (ROUTES.find((r) => r.path === p)?.tab !== h.tab) problems.push(`hub ${h.id} lists ${p} from another tab`)
    }
  }
  for (const [p, n] of count) if (n > 1) problems.push(`${p} is in ${n} hubs`)
  for (const [tab, list] of Object.entries(QUICK)) for (const p of list) if (!count.has(p)) problems.push(`quick link ${p} on ${tab} is in no hub`)
  for (const r of ROUTES) {
    if (OUTSIDE(r.path) || TAB_PATHS.has(r.path)) continue
    const d = depthOf(r.path)
    if (d === null) problems.push(`${r.path} has no hub`)
    else if (d > maxTaps) problems.push(`${r.path} is ${d} taps deep`)
    if (!r.path.includes(':') || PARENT[r.path]) continue
    problems.push(`${r.path} has no parent list`)
  }
  return problems
}
