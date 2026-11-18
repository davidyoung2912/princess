/**
 * Direct answers with no model (docs/stanley-answers-plan.md, section 6). A question that names a thing the app holds (entity) and asks one plain attribute of it (hours, where, price, what it is, how long, ages,
 * fitness, dress) is answered by a template from the catalogue, as a card with its source. Pure: every word comes in through `say`, every time and amount through `Format`.
 *
 * Rules: only authored or served data, never inferred; a missing attribute gives null so the pill or the server answers instead; anything that depends on the guest (their booking, bill, whether a table is free) or on live
 * facts this module is not given (weather, the next port) gives null, so it reaches the server's resolvers and the pills. "Open now" is answered only when the ship clock is supplied, and then from the venue's own live state.
 */
import type { StanleyCard } from '../stanleyCard'
import { itemById } from '../../domain/catalogue'
import { placeById } from '../../domain/deck'
import { EVENTS } from '../../domain/program'
import { excursionById } from '../../domain/excursions'
import { coverOf, directoryVenue, hoursText, venueState, type DayType, type DirectoryVenue } from '../../domain/menus'
import { conceptsOf, type Understood } from './understand'
import { wordsOf } from './normalise'

export type Attribute = 'hours' | 'now' | 'where' | 'price' | 'about' | 'duration' | 'age' | 'fitness' | 'dress' | 'on'

export interface AnswerFormat { time: (hhmm: string) => string; money: (cents: number) => string }
export type Say = (key: string, params?: Record<string, string | number>) => string

/** What the device knows about the ship right now: the ship clock and the kind of day, and the next events on the programme. Absent means "do not answer what depends on it". */
export interface LiveShip { time: string; day: DayType; upcoming: readonly { title: string; start: string }[] }

const DRESS = { casual: 'understand.answer.dress.casual', smart: 'understand.answer.dress.smart', elegant: 'understand.answer.dress.elegant' } as const
const ACTIVITY = { easy: 'understand.answer.tourActivity.easy', moderate: 'understand.answer.tourActivity.moderate', strenuous: 'understand.answer.tourActivity.strenuous' } as const
const SHOW_AGE = { all: 'understand.answer.showAge.all', kids: 'understand.answer.showAge.kids', teens: 'understand.answer.showAge.teens', adults: 'understand.answer.showAge.adults' } as const

const has = (words: readonly string[], ...any: string[]): boolean => any.some((w) => words.includes(w))

/** Words that make a question about the moment, the guest or a live fact. Static data must not answer them. */
const LIVE = ['table', 'tables', 'seat', 'seats', 'slot', 'slots', 'reservation', 'reservations', 'booked', 'available', 'availability', 'full', 'crowded', 'busy', 'queue', 'wait', 'waiting', 'delayed', 'cancelled', 'canceled', 'weather', 'forecast', 'rain', 'sold']

/** The one attribute a question asks about, or null when it asks none (or more than we can answer plainly). */
export function attributeOf(text: string, acts: Understood['acts'], concepts: readonly string[]): Attribute | null {
  const w = wordsOf(text)
  if (has(w, ...LIVE) || concepts.includes('n.allergy') || concepts.includes('n.diet')) return null
  if (concepts.includes('n.dresscode')) return 'dress'
  if (w.includes('how') && has(w, 'long', 'duration')) return 'duration'
  if (has(w, 'age', 'ages', 'old', 'children', 'kids', 'toddler', 'toddlers', 'minimum') && !acts.includes('PRICE')) return 'age'
  if (has(w, 'easy', 'strenuous', 'walking', 'wheelchair', 'fitness', 'mobility', 'accessible', 'difficult', 'hard')) return 'fitness'
  if (has(w, 'now', 'currently') || acts.includes('STATUS')) return 'now'
  if (acts.includes('PRICE') || concepts.includes('n.cover')) return 'price'
  if (acts.includes('WHEN')) return 'hours'
  if (acts.includes('FIND')) return 'where'
  if (acts.includes('WHAT_IS')) return 'about'
  return null
}

const card = (id: string, title: string, lines: string[], say: Say, chip: StanleyCard['provenance']['chips']): StanleyCard => ({
  id: `direct.${id}`,
  title,
  lines,
  abstained: false,
  links: [],
  provenance: { chips: chip, owner: say('understand.answer.owner'), dataTime: null, freshness: 'provisional', checkWithPerson: false, note: say('understand.answer.note') },
})

const whereIs = (placeId: string, name: string, say: Say): string | null => {
  const p = placeById(placeId)
  return p ? say('understand.answer.where', { name, deck: p.deck, section: say(`map.section.${p.section}`).toLowerCase() }) : null
}

function venueAnswer(v: DirectoryVenue, a: Attribute, f: AnswerFormat, say: Say, live: LiveShip | null): string[] | null {
  const name = v.name
  const hrs = (d: DayType) => hoursText(v.hours[d], f.time)
  switch (a) {
    case 'hours': {
      const sea = hrs('sea'), port = hrs('port')
      if (!sea && !port) return [say('understand.answer.allDay', { name })]
      if (sea === port) return [say('understand.answer.hours', { name, hours: sea }), say('understand.answer.shipTime')]
      return [say('understand.answer.hoursSplit', { name, sea: sea || say('understand.answer.allDayShort'), port: port || say('understand.answer.allDayShort') }), say('understand.answer.shipTime')]
    }
    case 'now': {
      // Read from the venue's own live state (it includes "unavailable" when the ship has said so) and the ship clock; with no clock the guest is sent to the page.
      if (!live) return null
      const state = venueState(v, live.day, live.time)
      if (state === 'unavailable') return [say('understand.answer.unavailable', { name })]
      const today = hrs(live.day) || say('understand.answer.allDayShort')
      return [say(state === 'open' ? 'understand.answer.openNow' : 'understand.answer.closedNow', { name, hours: today, time: f.time(live.time) }), say('understand.answer.shipTime')]
    }
    case 'where': return [whereIs(v.placeId, name, say) ?? say('understand.answer.deck', { name, deck: v.deck })]
    case 'price': {
      if (v.price === 'included') return [say('understand.answer.priceIncluded', { name })]
      const cover = coverOf(v)
      if (v.price === 'specialty') return [cover ? say('understand.answer.priceCover', { name, amount: f.money(cover) }) : say('understand.answer.priceSpecialty', { name })]
      return [say('understand.answer.priceCasual', { name })]
    }
    case 'about': return v.blurb ? [v.blurb] : null
    case 'dress': return [say(DRESS[v.dress], { name })]
    default: return null
  }
}

function tourAnswer(id: string, a: Attribute, f: AnswerFormat, say: Say): { name: string; lines: string[] } | null {
  const x = excursionById(id)
  if (!x) return null
  const name = x.name
  let lines: string[] | null = null
  switch (a) {
    case 'hours': lines = [say('understand.answer.tourStart', { name, time: f.time(x.start), hours: x.hours }), say('understand.answer.portTime')]; break
    case 'duration': lines = [say('understand.answer.tourLong', { name, hours: x.hours })]; break
    case 'price': lines = [say('understand.answer.tourPrice', { name, amount: f.money(x.price) })]; break
    case 'where': lines = x.meeting ? [say('understand.answer.tourMeet', { name, meeting: x.meeting })] : null; break
    case 'about': lines = x.summary ? [x.summary] : null; break
    case 'age': lines = [say(x.family ? 'understand.answer.tourFamily' : 'understand.answer.tourNotFamily', { name })]; break
    case 'fitness': lines = [say(ACTIVITY[x.activity], { name }), say(x.wheelchair ? 'understand.answer.tourWheelchair' : 'understand.answer.tourNoWheelchair'), ...(x.confirmAccess ? [say('understand.answer.tourConfirm')] : [])]; break
    default: lines = null
  }
  return lines ? { name, lines } : null
}

function showAnswer(id: string, a: Attribute, f: AnswerFormat, say: Say): { name: string; lines: string[] } | null {
  const e = EVENTS.find((x) => x.id === id)
  if (!e) return null
  const name = e.title
  let lines: string[] | null = null
  switch (a) {
    case 'hours': lines = [say('understand.answer.showStart', { name, time: f.time(e.start), minutes: e.minutes }), say('understand.answer.shipTime')]; break
    case 'where': lines = [whereIs(e.placeId, name, say) ?? ''].filter(Boolean); break
    case 'price': lines = [say(e.extra > 0 ? 'understand.answer.showExtra' : 'understand.answer.showFree', { name, amount: f.money(e.extra) })]; break
    case 'about': lines = e.detail ? [e.detail] : null; break
    case 'age': lines = [say(SHOW_AGE[e.age], { name })]; break
    case 'duration': lines = [say('understand.answer.showLong', { name, minutes: e.minutes })]; break
    default: lines = null
  }
  return lines && lines.length > 0 ? { name, lines } : null
}

function serviceAnswer(id: string, a: Attribute, f: AnswerFormat, say: Say): { name: string; lines: string[] } | null {
  const i = itemById(id)
  if (!i) return null
  const name = i.title
  let lines: string[] | null = null
  switch (a) {
    case 'hours': lines = i.times.length > 0 ? [say('understand.answer.serviceTimes', { name, times: i.times.map(f.time).join(', ') }), say('understand.answer.shipTime')] : null; break
    case 'where': lines = i.placeId ? [whereIs(i.placeId, name, say) ?? ''].filter(Boolean) : null; break
    case 'price': lines = i.price === null ? null : [i.price === 0 ? say('understand.answer.serviceFree', { name }) : say('understand.answer.servicePrice', { name, amount: f.money(i.price) })]; break
    case 'about': lines = i.detail ? [i.detail] : null; break
    case 'duration': lines = i.minutes > 0 ? [say('understand.answer.showLong', { name, minutes: i.minutes })] : null; break
    case 'age': lines = i.minAge > 0 ? [say('understand.answer.serviceAge', { name, age: i.minAge })] : null; break
    default: lines = null
  }
  return lines && lines.length > 0 ? { name, lines } : null
}

/** "What is on" with no name: the next events on the programme, from the ship clock. Needs the live list; without it the question goes on to the server and the pills. */
function onNow(u: Understood, concepts: readonly string[], say: Say, f: AnswerFormat, live: LiveShip | null): StanleyCard | null {
  if (u.entities.length > 0 || !live || live.upcoming.length === 0) return null
  const asksWhatsOn = concepts.some((c) => ['n.schedule', 'n.show', 'n.activity', 'n.music', 'n.movie', 'n.trivia'].includes(c)) && (u.acts.includes('LIST') || u.acts.includes('WHEN'))
  if (!asksWhatsOn) return null
  const lines = live.upcoming.slice(0, 3).map((e) => say('understand.answer.eventLine', { time: f.time(e.start), title: e.title }))
  return card('on', say('understand.answer.onTitle'), [...lines, say('understand.answer.shipTime')], say, ['Ship schedule'])
}

/**
 * A card answering the question from data, or null (the server and the pills take it). Never for a question about the guest's own trip.
 */
export function directAnswer(text: string, u: Understood, f: AnswerFormat, say: Say, live: LiveShip | null = null): StanleyCard | null {
  if (u.personal) return null
  const concepts = conceptsOf(text)
  const known = onNow(u, concepts, say, f, live)
  if (known) return known
  const a = attributeOf(text, u.acts, concepts)
  const named = u.entities[0]
  if (!a || !named || u.entities.length > 1) return null
  const [kind, ...rest] = named.id.split(':')
  const id = rest.join(':')
  if (kind === 'venue') {
    const v = directoryVenue(id)
    const lines = v ? venueAnswer(v, a, f, say, live) : null
    return v && lines ? card(named.id, v.name, lines, say, ['Ship schedule']) : null
  }
  const r = kind === 'tour' ? tourAnswer(id, a, f, say) : kind === 'show' ? showAnswer(id, a, f, say) : kind === 'service' ? serviceAnswer(id, a, f, say) : null
  if (kind === 'place' && a === 'where') {
    const line = whereIs(id, named.name, say)
    return line ? card(named.id, named.name, [line], say, []) : null
  }
  return r ? card(named.id, r.name, r.lines, say, kind === 'show' ? ['Ship schedule'] : []) : null
}
