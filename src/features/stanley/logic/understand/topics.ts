/**
 * The topic table (docs/stanley-answers-plan.md, 5.7): what a guest might want help with, how to recognise it, and where to send them. It is data, written in a small notation so a line stays one line:
 *  - `ev`: the concepts that point to the topic, each with a weight (`n.spa:3.5`). An act can be evidence too (`a.REMIND:4`).
 *  - `acts`: what the guest wants to do, as a bonus or penalty for this topic (`BOOK:2`).
 *  - `stages`: a small lean towards the topic at a stage of the journey, never a rule.
 *  - `pills`: the screens to offer, from `destinations.ts`. `BOOK|CHANGE>dining.book` is offered only when one of those acts was asked; a bare name is always offered. Specific ones come first.
 *  - `risk`: `high` topics (health, entry rules, allergies) never carry an authored claim from the engine, only the official screens.
 * The words shown for a topic and its pills are in the locale file, never here.
 */
import type { JourneyStage } from '../../../../app/routes/hubs'
import type { Act } from './lexicon'
import { SCREEN_SPECS } from './screenSpec'

export interface TopicDef {
  id: string
  evidence: Readonly<Record<string, number>>
  acts: Readonly<Partial<Record<Act, number>>>
  stages: Readonly<Partial<Record<JourneyStage, number>>>
  risk: 'low' | 'high'
  pills: readonly PillRule[]
}
export interface PillRule { dest: string; when?: readonly Act[] }

const nums = (spec: string): Record<string, number> => Object.fromEntries(spec.split(/\s+/).filter(Boolean).map((p) => { const [k, v] = p.split(':'); return [k!, Number(v)] }))
const rule = (spec: string): PillRule => { const [a, b] = spec.split('>'); return b ? { dest: b, when: a!.split('|') as Act[] } : { dest: spec } }

const BEFORE = 'dream discover book'.split(' ') as JourneyStage[]
const PREP = 'manage prebook getToShip'.split(' ') as JourneyStage[]
const ABOARD = 'embark sea port disembark'.split(' ') as JourneyStage[]
const lean = (groups: readonly (readonly JourneyStage[])[], v: number, ...more: [JourneyStage[], number][]): Partial<Record<JourneyStage, number>> => {
  const out: Partial<Record<JourneyStage, number>> = {}
  for (const g of groups) for (const s of g) out[s] = v
  for (const [g, n] of more) for (const s of g) out[s] = n
  return out
}

const T = (id: string, ev: string, acts: string, pills: readonly string[], opts: { stages?: Partial<Record<JourneyStage, number>>; risk?: 'low' | 'high' } = {}): TopicDef =>
  ({ id, evidence: nums(ev), acts: nums(acts) as TopicDef['acts'], stages: opts.stages ?? {}, risk: opts.risk ?? 'low', pills: pills.map(rule) })

const BASE_TOPICS: readonly TopicDef[] = [
  // ---- the explorers ----
  T('dining', 'n.restaurant:3 n.dinner:3 n.lunch:3 n.breakfast:3 n.meal:2.5 n.buffet:3 n.table:2 n.reservation:1.5 n.casualfood:2 n.dessert:2 n.cover:1.5 n.bar:0.5', 'BOOK:2 FIND:1 WHEN:1.5 LIST:1 RECOMMEND:1.5 CHANGE:1 CANCEL:1 PRICE:0.5 STATUS:1',
    ['BOOK>dining.book', 'CHANGE|CANCEL>dining.mine', 'dining', 'venues', 'dining.mine']),
  T('dining.diet', 'n.diet:4 n.allergy:3 n.kidsmenu:1.5 n.meal:1 n.dinner:0.5 n.restaurant:0.5 n.casualfood:0.5 n.dessert:0.5', 'LIST:1 ALLOWED:1 FIND:1 REQUIRE:1 HOW:0.5', ['dining', 'allergy', 'venues'], { risk: 'high' }),
  T('drinks', 'n.drink:3 n.bar:3 n.coffee:2.5 n.package:0.5', 'FIND:1 WHEN:1 LIST:1 PRICE:1 RECOMMEND:1', ['drinks', 'venues', 'packages']),
  T('roomservice', 'n.roomservice:4.5 n.breakfast:0.5', 'ORDER:2 BOOK:1 WHEN:1 PRICE:1 HOW:1', ['order', 'dining']),
  T('packages', 'n.package:4 n.price:0.5 n.drink:0.5 n.wifi:0.5', 'PRICE:2 BOOK:1 WHAT_IS:1 COMPARE:1 RECOMMEND:1', ['packages', 'drinks']),
  T('entertainment', 'n.show:3.5 n.movie:3 n.music:2.5 n.trivia:2.5 q.tonight:1 n.schedule:1 n.activity:0.5', 'WHEN:1.5 LIST:1.5 BOOK:1 RECOMMEND:1', ['entertainment', 'plan.day', 'activities']),
  T('casino', 'n.casino:4', 'WHEN:1 FIND:1 ALLOWED:1 WHAT_IS:1', ['entertainment', 'map']),
  T('activities', 'n.activity:3.5 n.pool:2.5 n.sports:3 n.workshop:3 n.library:2.5 n.sun:2.5 n.view:1.5 n.schedule:1 n.seaday:1.5 q.kids:0.5', 'LIST:2 RECOMMEND:1.5 WHEN:1 FIND:1 PLAN:1.5', ['activities', 'plan.day', 'entertainment']),
  T('games', 'n.game:3.5 n.trivia:1', 'LIST:1 FIND:1 WHAT_IS:1', ['games', 'challenges']),
  T('spa', 'n.spa:3.5 n.massage:3.5 n.facial:3 n.treatment:3', 'BOOK:2 PRICE:1 WHEN:1 FIND:1 LIST:1 RECOMMEND:1 CANCEL:1 CHANGE:1', ['BOOK>spa.book', 'CHANGE|CANCEL>reservations', 'spa', 'exercise']),
  T('fitness', 'n.gym:3.5', 'WHEN:1.5 FIND:1 LIST:1 BOOK:1 PRICE:0.5', ['exercise', 'map']),
  T('shopping', 'n.shop:3.5 n.sundries:3 n.photo:0.5', 'FIND:1 WHEN:1 LIST:1 PRICE:0.5 BOOK:1 LOST:1', ['shops', 'map']),
  T('photos', 'n.photo:4', 'FIND:1 PRICE:1 BOOK:1 LIST:1', ['photos', 'shops']),
  T('excursions', 'n.excursion:4 n.port:0.7 q.cheap:0.4 q.kids:0.4', 'BOOK:2 LIST:1.5 RECOMMEND:1.5 PRICE:1 WHEN:1 CANCEL:1 CHANGE:1 COMPARE:1', ['BOOK|LIST|RECOMMEND|PRICE|WHEN|COMPARE>excursions', 'CANCEL|CHANGE>excursions.mine', 'excursions', 'excursions.mine']),
  T('port.allaboard', 'n.allaboard:4 n.missedship:4.5 n.tender:3', 'WHEN:1.5 PROBLEM:2 LOST:2 STATUS:1', ['PROBLEM|LOST>helpnow', 'portday', 'safeashore']),
  T('ports', 'n.port:3 n.region:1.5 n.itinerary:1 n.nextport:2.5', 'LIST:1.5 WHAT_IS:1 RECOMMEND:1 FIND:0.5 PLAN:1', ['portguide', 'ports', 'excursions']),
  T('port.practical', 'n.currency:3.5 n.language:3.5 n.taxi:3.5', 'WHAT_IS:1 HOW:1 PRICE:1 FIND:1', ['portguide', 'safeashore']),
  T('port.safety', 'n.scam:4 n.port:0.5', 'FIND:0.5 HOW:0.5 ALLOWED:1 RECOMMEND:0.5 WHAT_IS:1', ['safeashore', 'portguide']),
  T('port.nearby', 'n.nearby:4 n.port:0.5', 'FIND:2 WHEN:0.5 LIST:0.5', ['portguide', 'map']),
  T('weather', 'n.weather:4 n.seas:3 n.cabin:-2.5', 'WHAT_IS:1 STATUS:1 WHEN:0.5 REQUIRE:1', ['weather', 'weatherplan']),
  T('deckmap', 'n.deck:3.5 n.map:3.5 n.elevator:2.5 n.place:3 n.guestservices:2.5', 'FIND:3 LIST:0.5', ['map', 'deckplans']),
  T('cabinchoose', 'n.cabinchoice:4 n.cabin:0.8 n.compare:0.5', 'RECOMMEND:2 COMPARE:1.5 LIST:1 WHAT_IS:1', ['cabins', 'decide'], { stages: lean([BEFORE], 1.5, [ABOARD, -1.5]) }),
  T('cabin.room', 'n.cabin:3 n.steward:3.5 n.safe:3.5 n.amenity:3.5 n.charger:1', 'ORDER:2 PROBLEM:2 FIND:0.5 WHEN:1 CHANGE:1', ['PROBLEM|ORDER>requests', 'room', 'guestchat'], { stages: lean([ABOARD], 1, [BEFORE, -1.5]) }),
  T('tv', 'n.tv:4', 'PROBLEM:1 HOW:1 LIST:1 WHAT_IS:1', ['tv', 'room']),
  T('ships', 'n.ship:3 n.compare:1', 'WHAT_IS:1.5 COMPARE:2 LIST:1 RECOMMEND:1', ['ships', 'shipcompare', 'shipinfo'], { stages: lean([BEFORE], 1) }),
  T('sailings', 'n.cruise:3 n.region:3 n.month:2.5 n.besttime:3.5 n.decide:1 q.cheap:1', 'LIST:1.5 FIND:1.5 BOOK:0.5 PRICE:1 RECOMMEND:1.5', ['sailings', 'explore', 'cost'], { stages: lean([BEFORE], 1.5) }),
  T('booking', 'n.cruise:3 n.newbooking:4 n.trip:0.5', 'BOOK:3 PRICE:0.5', ['BOOK>book', 'sailings'], { stages: lean([BEFORE], 1) }),
  T('decide', 'n.decide:4 n.compare:1 n.saved:3', 'RECOMMEND:2 COMPARE:1.5 HOW:1 LIST:0.5', ['decide', 'quiz', 'saved']),
  // ---- the trip ----
  T('trips', 'n.trip:4', 'FIND:1 LIST:1 STATUS:1 CHANGE:1 CANCEL:0.5 WHAT_IS:1 PROBLEM:0.5', ['trips', 'plan']),
  T('checkin', 'n.checkin:4 n.document:1', 'HOW:1.5 WHEN:1.5 REQUIRE:1.5 STATUS:1 PROBLEM:1', ['checkin', 'documents', 'checklist']),
  T('boardingpass', 'n.boardingpass:4 n.medallion:1', 'FIND:1 PROBLEM:2.5 LOST:2.5 HOW:1 WHAT_IS:1', ['PROBLEM|LOST>findpass', 'boardingpass', 'findpass']),
  T('keycard', 'n.medallion:4', 'PROBLEM:2 LOST:2 WHAT_IS:1 HOW:1', ['PROBLEM|LOST>guestchat', 'medallion']),
  T('embarkation', 'n.embark:4 n.checkin:1 n.luggage:0.8 n.muster:0.5', 'HOW:1.5 WHEN:2 REQUIRE:1.5 PLAN:1', ['embarkation', 'checkin', 'gettingthere']),
  T('muster', 'n.muster:4.5', 'WHEN:1 WHAT_IS:1 FIND:1 REQUIRE:1', ['muster', 'embarkation']),
  T('documents', 'n.document:4', 'REQUIRE:2 PROBLEM:1.5 LOST:1.5 HOW:1 WHAT_IS:1 CHANGE:1', ['documents', 'checkin']),
  T('disembark', 'n.disembark:4 n.luggage:1', 'WHEN:2 HOW:1.5 REQUIRE:1 PLAN:1 WHAT_IS:1', ['disembark', 'bags', 'onward']),
  T('luggage', 'n.luggage:4', 'PROBLEM:2 LOST:2 HOW:1 WHEN:1 REQUIRE:1 ALLOWED:1', ['PROBLEM|LOST>lostfound', 'bags', 'packing']),
  T('customs', 'n.customs:4.5', 'REQUIRE:1.5 ALLOWED:1.5 HOW:1 WHAT_IS:1 WHEN:0.5', ['customs', 'documents'], { risk: 'high' }),
  T('packing', 'n.packing:4 n.charger:1.5 n.sundries:0.5 n.dresscode:1 n.weather:0.5 a.ALLOWED:1', 'REQUIRE:2 ALLOWED:2 LIST:1.5 HOW:0.5 RECOMMEND:1', ['packing', 'weatherplan'], { stages: lean([PREP], 1) }),
  T('dresscode', 'n.dresscode:4', 'REQUIRE:2 ALLOWED:2 WHAT_IS:1 WHEN:1', ['packing', 'dining']),
  T('power', 'n.charger:4', 'ALLOWED:1.5 REQUIRE:1 FIND:1 WHAT_IS:1', ['packing', 'room']),
  T('flights', 'n.flight:4', 'WHEN:1 HOW:1 PLAN:1 PROBLEM:1.5', ['gettingthere', 'onward']),
  // ---- my plan and money ----
  T('plan.day', 'n.plan:3.5 a.PLAN:1.5 n.schedule:2.5 n.today:3 q.today:1 q.tonight:1 q.tomorrow:1', 'PLAN:2 LIST:1.5 WHEN:1 WHAT_IS:0.5', ['plan.day', 'today', 'plan']),
  T('itinerary', 'n.itinerary:4 n.port:1 n.seaday:2.5 n.nextport:3', 'LIST:1.5 WHAT_IS:1 FIND:1 WHEN:1', ['itinerary', 'ports']),
  T('reservations', 'n.reservation:3 n.plan:1 n.table:1 a.CHANGE:1.5 a.CANCEL:1.5', 'CHANGE:2 CANCEL:2 LIST:1 STATUS:1', ['reservations', 'plan.day']),
  T('reminders', 'n.reminder:4 a.REMIND:4', 'REMIND:1 LIST:1 CHANGE:1 CANCEL:1', ['reminders']),
  T('bill', 'n.bill:4 n.tip:3 n.credit:2.5 n.price:0.5', 'WHAT_IS:1 FIND:1 PROBLEM:2 STATUS:1 PRICE:0.5', ['PROBLEM>cases', 'bill', 'money']),
  T('payments', 'n.payment:4', 'CHANGE:1.5 HOW:1 STATUS:1 WHEN:1 PROBLEM:1', ['payments', 'trips']),
  T('insurance', 'n.insurance:4.5', 'WHAT_IS:1 PRICE:1 HOW:1', ['trips', 'contact']),
  T('loyalty', 'n.loyalty:4.5', 'WHAT_IS:1 FIND:1 LIST:1', ['loyalty']),
  // ---- help, people and the app ----
  T('wifi', 'n.wifi:4.5', 'PROBLEM:2 PRICE:1.5 HOW:1.5 BOOK:1 WHAT_IS:1', ['wifi', 'packages', 'textHelp']),
  T('phone', 'n.phone:3.5', 'HOW:1 PRICE:1 PROBLEM:1.5 WHAT_IS:1', ['phoneplan', 'textHelp']),
  T('laundry', 'n.laundry:4.5', 'FIND:1 PRICE:1 HOW:1 WHEN:1 BOOK:1', ['laundry', 'requests']),
  T('health', 'n.health:4', 'FIND:1 WHEN:1 CONTACT:1', ['health', 'helpnow'], { risk: 'high' }),
  T('access', 'n.access:4.5', 'FIND:1 HOW:1 LIST:1 REQUIRE:1 BOOK:1', ['access', 'planaccess']),
  T('lostitem', 'n.lostitem:3.5 a.LOST:2', 'LOST:3 FIND:1 PROBLEM:0.5', ['lostfound', 'cases', 'guestchat']),
  T('contact', 'n.contact:3.5 n.guestservices:3 a.CONTACT:3.5', 'CONTACT:1 FIND:0.5', ['guestchat', 'contact', 'helpnow']),
  T('chat', 'n.chat:3.5', 'HOW:1 FIND:1 CONTACT:0.5 WHAT_IS:1', ['chat', 'people', 'rooms']),
  T('group', 'n.group:3.5', 'PLAN:2 HOW:1 RECOMMEND:1 LIST:0.5', ['poll', 'party', 'chat']),
  T('family', 'n.family:3 n.kidsclub:3.5 q.kids:1.5 n.kidsmenu:2', 'LIST:1.5 FIND:1 WHEN:1 RECOMMEND:1.5 ALLOWED:1', ['family', 'teen', 'activities']),
  T('solo', 'n.solo:4', 'RECOMMEND:1 HOW:1 LIST:1', ['solo', 'chat', 'people']),
  T('settings', 'n.settings:3.5', 'CHANGE:2 HOW:1.5 FIND:1', ['settings', 'notifications']),
  T('privacy', 'n.privacy:4.5', 'HOW:1 WHAT_IS:1 CHANGE:1 CANCEL:1', ['privacy']),
  T('feedback', 'n.survey:4 n.help:2.5 n.complaint:4', 'PROBLEM:1 CONTACT:1 HOW:1', ['feedback', 'reportproblem', 'help']),
  T('chapel', 'n.chapel:4.5', 'WHEN:1.5 FIND:1', ['community', 'map']),
  T('pets', 'n.pet:4.5', 'ALLOWED:1.5 HOW:1', ['help', 'contact']),
  T('sustainability', 'n.sustain:4.5', 'WHAT_IS:1', ['sustain', 'help']),
]
/** The base topics and one topic for each long tail screen (`screenSpec.ts`): its own noun is strong evidence, so an ordinary word never reaches it. */
export const TOPICS: readonly TopicDef[] = [...BASE_TOPICS, ...SCREEN_SPECS.map((x) => T(x.id, `n.${x.id}:5`, '', x.dests.split(' ').map((d) => d.split('=')[0]!), { risk: x.high ? 'high' : 'low' }))]

