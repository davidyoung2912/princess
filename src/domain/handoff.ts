import type { Handoff } from '../ai/guard'

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

export const hasMessage = (topic: Handoff): topic is Exclude<Handoff, 'emergency'> => topic !== 'emergency'

/** What is ticked at first: the question and the booking, and the conversation unless the topic is medical. */
export const defaultParts = (topic: Handoff): HandoffParts => ({ question: true, booking: true, conversation: topic !== 'medical' })

const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim()

/** The message to send, at most `HANDOFF_MAX` characters; the oldest turns are dropped first when it is too long. Null for an emergency. */
export function buildHandoff(topic: Handoff, question: string, turns: readonly Turn[], booking: BookingFacts, parts: HandoffParts): string | null {
  if (!hasMessage(topic)) return null
  const head = [`${TOPIC[topic]} (from the app concierge).`]
  if (parts.question) head.push(`Guest asked: ${oneLine(question).slice(0, QUESTION_MAX)}`)
  if (parts.booking) head.push(`Booking: ${booking.guest}, sailing ${booking.sailing}, ${booking.party === 1 ? '1 guest' : `${booking.party} guests`}${booking.open === null ? '' : `, ${booking.open} checklist ${booking.open === 1 ? 'item' : 'items'} open`}.`)
  const base = head.join('\n')
  if (!parts.conversation) return base.slice(0, HANDOFF_MAX)
  const lines = turns.map((t) => `${t.role === 'user' ? 'Guest' : 'Concierge'}: ${oneLine(t.text)}`)
  let kept = lines.slice(-8)
  while (kept.length > 0 && `${base}\nConversation:\n${kept.join('\n')}`.length > HANDOFF_MAX) kept = kept.slice(1)
  return kept.length > 0 ? `${base}\nConversation:\n${kept.join('\n')}` : base.slice(0, HANDOFF_MAX)
}
