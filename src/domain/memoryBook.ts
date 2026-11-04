import { formatDate } from './cruise'
import type { Hindsight } from './wrapped'
import type { FareId } from './fares'
import { FUTURE_DEPARTURES } from './pricing'
import { earliestRebook, milesPhrase } from './postcruise'
import type { Recap } from './recap'
import { itinerary, PORTS, type Sailing } from './sailings'
import type { CategoryId } from './ship'
import type { Mood, TripEntry } from './tripDiary'

/**
 * The memory loop, part two (S8-02, S8-03, S8-05, S8-06): the memory book, "what I'd change", a seeded next trip and staying in touch.
 * All of it is the guest's own, kept on the device. The next trip is only ever a draft; nothing is booked or held here.
 */

// ---- Journal and memory book (S8-02) ----

export const NOTE_MAX = 600
export type Journal = Record<number, string>

export interface BookSection { id: string; heading: string; lines: string[] }

const MOOD_LABEL: Record<Mood, string> = { great: 'Loved it', good: 'Good', ok: 'Fine', tired: 'Tired' }

const dayName = (port: string): string => (port === 'sea' ? 'At sea' : (PORTS[port as keyof typeof PORTS]?.name ?? port))

/** The pages of the book: a title page, each day with the guest's note (a day with no note is still shown), and the facts. Plain text so it prints and works offline. */
export function memoryBook(sailing: Sailing, recap: Recap, journal: Journal, reflections: readonly Reflection[], includeReflections: boolean, diary: readonly TripEntry[] = []): BookSection[] {
  const sections: BookSection[] = [{ id: 'title', heading: recap.title, lines: [`${recap.nights} nights on Sun Princess`, recap.dates] }]
  // Before the ship (day 0): booking, documents and check-in lines, so the book starts where the trip did.
  const before = diary.filter((e) => e.day === 0).map((e) => (e.mood ? `${MOOD_LABEL[e.mood]}: ${e.text}` : e.text))
  if (before.length) sections.push({ id: 'day-0', heading: 'Before the ship', lines: before })
  for (const d of itinerary(sailing)) {
    const note = (journal[d.day] ?? '').trim()
    // The guest's own diary lines for the day (and what the app wrote) fill the page, so a day with no journal note is not empty.
    const diaryLines = diary.filter((e) => e.day === d.day).map((e) => (e.mood ? `${MOOD_LABEL[e.mood]}: ${e.text}` : e.text))
    const lines = [formatDate(d.date), ...(note ? [note] : []), ...diaryLines]
    sections.push({ id: `day-${d.day}`, heading: `Day ${d.day}: ${dayName(d.port)}`, lines: note || diaryLines.length ? lines : [...lines, 'No note for this day.'] })
  }
  const facts = [`Ports: ${recap.ports.join(', ')}`, `${recap.seaDays} days at sea${milesPhrase(recap.nauticalMiles)}`]
  if (recap.tourNames.length) facts.push(`Ashore: ${recap.tourNames.join('; ')}`)
  if (recap.favouriteMeal) facts.push(`Favourite table: ${recap.favouriteMeal.name}`)
  sections.push({ id: 'facts', heading: 'The trip in numbers', lines: facts })
  if (includeReflections && reflections.length) sections.push({ id: 'change', heading: 'What I would change', lines: reflections.map((r) => `${TOPIC_LABEL[r.topic]}: ${r.text}`) })
  return sections
}

export const bookText = (sections: readonly BookSection[]): string => sections.map((s) => `${s.heading}\n${s.lines.join('\n')}`).join('\n\n')

// ---- What I'd change (S8-03) ----

export const TOPICS = ['package', 'cabin', 'port', 'dining', 'other'] as const
export type Topic = (typeof TOPICS)[number]
export const TOPIC_LABEL: Record<Topic, string> = { package: 'Package', cabin: 'Cabin', port: 'Port', dining: 'Dining', other: 'Something else' }
export const isTopic = (v: unknown): v is Topic => TOPICS.includes(v as Topic)

export interface Reflection { id: string; topic: Topic; text: string; /** Shared with friends on this trip; private otherwise. */ shared: boolean }
export const REFLECTION_MAX = 300
export const REFLECTIONS_MAX = 12

export function reflectionProblem(topic: unknown, text: string, existing: readonly Reflection[]): 'topic' | 'text' | 'tooMany' | null {
  if (!isTopic(topic)) return 'topic'
  if (text.trim() === '' || text.length > REFLECTION_MAX) return 'text'
  if (existing.length >= REFLECTIONS_MAX) return 'tooMany'
  return null
}

/** What goes to a friend: only the reflections the guest marked as shared, and nothing that names a cabin number. */
export function sharedReflections(list: readonly Reflection[]): string {
  const shared = list.filter((r) => r.shared)
  if (!shared.length) return ''
  return ['What I would change next time:', ...shared.map((r) => `- ${TOPIC_LABEL[r.topic]}: ${r.text.replace(/\b\d{4,5}\b/g, 'my cabin')}`)].join('\n')
}

// ---- Seeded next trip (S8-05) ----

export interface NextTripInput {
  sailing: Sailing
  category: CategoryId
  fare: FareId
  guests: number
  tourNames: readonly string[]
  favouriteMeal: string | null
  hindsight: Hindsight | null
  reflections: readonly Reflection[]
  /** The last day of the cruise just taken, "YYYY-MM-DD". */
  lastDay: string
}

export interface NextTrip {
  sailingId: string
  departure: string
  category: CategoryId
  fare: FareId
  guests: number
  repeat: string[]
  lessons: string[]
  priceWatch: boolean
  /** A draft is never booked; the guest confirms in the booking flow. */
  status: 'draft'
}

export function seedNextTrip(i: NextTripInput): NextTrip | null {
  const earliest = earliestRebook(i.lastDay)
  const dep = FUTURE_DEPARTURES.find((f) => f.departure >= earliest)
  if (!dep) return null
  const lessons: string[] = []
  let fare = i.fare
  if (i.hindsight?.verdict === 'notWorth' && fare !== 'standard') { fare = 'standard'; lessons.push('Your package did not pay for itself, so the draft starts with the Standard fare.') }
  if (i.hindsight?.verdict === 'worth') lessons.push('Your package paid for itself, so the draft keeps it.')
  for (const r of i.reflections) if (r.topic === 'cabin' || r.topic === 'port' || r.topic === 'dining') lessons.push(`${r.topic === 'cabin' ? 'Cabin' : r.topic === 'port' ? 'Port' : 'Dining'}: ${r.text}`)
  const repeat: string[] = [...i.tourNames.slice(0, 2).map((n) => `Ashore again: ${n}`)]
  if (i.favouriteMeal) repeat.push(`Dinner at ${i.favouriteMeal}`)
  return { sailingId: dep.id, departure: dep.departure, category: i.category, fare, guests: i.guests, repeat, lessons, priceWatch: true, status: 'draft' }
}

export const nextTripText = (n: NextTrip): string => [`Next trip (a draft, not booked): ${formatDate(n.departure)}, ${n.guests} ${n.guests === 1 ? 'guest' : 'guests'}.`, ...n.repeat, ...n.lessons].join('\n')

// ---- Stay in touch (S8-06) ----

export interface Contact {
  id: string
  /** First name only. */
  name: string
  /** One short line the guest chose to share. */
  note: string
  /** The guest opted in to swapping details. */
  consent: boolean
  /** The other person's reply. Nothing is sent in this demo, so this is a simulation. */
  reply: 'waiting' | 'accepted' | 'declined'
  at: number
}

export const CONTACT_NAME_MAX = 30
export const CONTACT_NOTE_MAX = 120
export const CONTACTS_MAX = 10

export type ContactProblem = 'name' | 'consent' | 'note' | 'blocked' | 'tooMany' | 'duplicate'

export function contactProblem(name: string, note: string, consent: boolean, existing: readonly Contact[], blocked: readonly string[]): ContactProblem | null {
  const n = name.trim()
  if (n === '' || n.length > CONTACT_NAME_MAX || /@|https?:|\d{5,}/.test(n)) return 'name'
  if (note.length > CONTACT_NOTE_MAX || /@|https?:|\d{6,}/.test(note)) return 'note'
  if (!consent) return 'consent'
  if (blocked.some((b) => b.toLowerCase() === n.toLowerCase())) return 'blocked'
  if (existing.some((c) => c.name.toLowerCase() === n.toLowerCase())) return 'duplicate'
  if (existing.length >= CONTACTS_MAX) return 'tooMany'
  return null
}

/** A "sail again together" group exists only when someone has accepted and a next trip is drafted. Everyone in it is someone the guest chose. */
export function sailAgainGroup(contacts: readonly Contact[], next: NextTrip | null): string[] {
  if (!next) return []
  return contacts.filter((c) => c.consent && c.reply === 'accepted').map((c) => c.name)
}
