import type { Handoff } from '../ai/guard'
import type { CaseTopic } from '../ai/stanleyHandoff'

/**
 * Handoff with context (XA-06): when the guest asks for a person, what they asked, the last of the conversation and a few booking facts
 * are put in one message, so nobody is asked twice. The guest sees the whole message and can edit it or leave parts out before it is sent.
 * An emergency never makes a message: it shows the numbers. A medical handoff leaves the conversation out until the guest ticks it. Pure.
 */
export const HANDOFF_MAX = 1000
export const QUESTION_MAX = 300

export interface Turn { role: 'user' | 'assistant'; text: string }
export interface BookingFacts { guest: string; sailing: string; party: number; /** Items still open on the checklist; null when not loaded. */ open: number | null }
export interface HandoffParts { question: boolean; conversation: boolean; booking: boolean }

const TOPIC: Record<Exclude<Handoff, 'emergency'>, string> = { person: 'Wants to talk to a person', medical: 'Medical question', legal: 'Legal or claim question' }

/** One thing a topic's draft asks for. `label` is the words that go in the message to the desk; the screen shows the same field with its own wording (`handoff.f.<topic>.<key>`). */
export interface TopicField { key: string; label: string; max: number }
export const FIELD_MAX = 150

/**
 * Each topic has its own short draft (the plan's "separate drafts per topic"): the few facts the desk would otherwise have to ask for, so the first reply can be an answer. A person-to-talk-to case has none:
 * the question and the booking are enough. The guest can leave any field empty, and sees the whole message before agreeing. No field asks for a medical detail: an allergy case asks what to avoid, not about symptoms.
 */
export const TOPIC_FIELDS: Record<CaseTopic, readonly TopicField[]> = {
  person: [],
  cabin: [{ key: 'cabin', label: 'Cabin', max: FIELD_MAX }, { key: 'what', label: 'What is wrong', max: FIELD_MAX }, { key: 'since', label: 'Since when', max: FIELD_MAX }],
  lostProperty: [{ key: 'item', label: 'Item', max: FIELD_MAX }, { key: 'where', label: 'Last seen', max: FIELD_MAX }, { key: 'describe', label: 'What it looks like', max: FIELD_MAX }],
  billing: [{ key: 'charge', label: 'Charge', max: FIELD_MAX }, { key: 'date', label: 'Date and place', max: FIELD_MAX }, { key: 'why', label: 'Why it looks wrong', max: FIELD_MAX }],
  allergy: [{ key: 'avoid', label: 'Needs to avoid', max: FIELD_MAX }, { key: 'meal', label: 'Next meal or venue', max: FIELD_MAX }, { key: 'who', label: 'Who it is for', max: FIELD_MAX }],
  special: [{ key: 'request', label: 'Request', max: FIELD_MAX }, { key: 'date', label: 'Date', max: FIELD_MAX }, { key: 'who', label: 'Who it is for', max: FIELD_MAX }],
  disruption: [{ key: 'what', label: 'What happened', max: FIELD_MAX }, { key: 'flight', label: 'Flight or booking affected', max: FIELD_MAX }, { key: 'when', label: 'When', max: FIELD_MAX }],
  missedShip: [{ key: 'port', label: 'Port', max: FIELD_MAX }, { key: 'where', label: 'Where I am now', max: FIELD_MAX }, { key: 'phone', label: 'Phone to reach me', max: FIELD_MAX }],
}

/** What the guest typed for each field of one topic, by field key. */
export type TopicAnswers = Record<string, string>

/** The filled-in fields of a topic as lines for the message, in the topic's own order. Empty and blank answers are left out, and each answer is one trimmed line of at most the field's length. */
export function topicLines(topic: CaseTopic, answers: TopicAnswers): string[] {
  return TOPIC_FIELDS[topic].flatMap((f) => {
    const v = oneLine(answers[f.key] ?? '').slice(0, f.max)
    return v ? [`${f.label}: ${v}`] : []
  })
}

export const hasMessage = (topic: Handoff): topic is Exclude<Handoff, 'emergency'> => topic !== 'emergency'

/** What is ticked at first: the question and the booking, and the conversation unless the topic is medical. */
export const defaultParts = (topic: Handoff): HandoffParts => ({ question: true, booking: true, conversation: topic !== 'medical' })

const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim()

/** The message to send, at most `HANDOFF_MAX` characters (the topic's `details` come straight after the question); the oldest turns are dropped first when it is too long. Null for an emergency. */
export function buildHandoff(topic: Handoff, question: string, turns: readonly Turn[], booking: BookingFacts, parts: HandoffParts, details: readonly string[] = []): string | null {
  if (!hasMessage(topic)) return null
  const head = [`${TOPIC[topic]} (from the app concierge).`]
  if (parts.question) head.push(`Guest asked: ${oneLine(question).slice(0, QUESTION_MAX)}`)
  head.push(...details)
  if (parts.booking) head.push(`Booking: ${booking.guest}, sailing ${booking.sailing}, ${booking.party === 1 ? '1 guest' : `${booking.party} guests`}${booking.open === null ? '' : `, ${booking.open} checklist ${booking.open === 1 ? 'item' : 'items'} open`}.`)
  const base = head.join('\n')
  if (!parts.conversation) return base.slice(0, HANDOFF_MAX)
  const lines = turns.map((t) => `${t.role === 'user' ? 'Guest' : 'Concierge'}: ${oneLine(t.text)}`)
  let kept = lines.slice(-8)
  while (kept.length > 0 && `${base}\nConversation:\n${kept.join('\n')}`.length > HANDOFF_MAX) kept = kept.slice(1)
  return kept.length > 0 ? `${base}\nConversation:\n${kept.join('\n')}` : base.slice(0, HANDOFF_MAX)
}

/** The photo a guest may add to a case: a JPEG or PNG of at most 5 MB (the server checks the bytes again and removes the place, time and camera). */
export const PHOTO_MAX_BYTES = 5_000_000
export type PhotoProblem = 'empty' | 'size' | 'type'
export const photoProblem = (file: { type: string; size: number }): PhotoProblem | null =>
  file.size <= 0 ? 'empty' : file.size > PHOTO_MAX_BYTES ? 'size' : file.type !== 'image/jpeg' && file.type !== 'image/png' ? 'type' : null
