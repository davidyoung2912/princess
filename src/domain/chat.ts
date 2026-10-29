/** Guest Services chat (MSG-02, SUP-08): channel types, visible response times, ticket status, queue position and escalation to a phone call. Crew replies are simulated; times and wording are authored concept values. */
export type ChannelId = 'guestServices' | 'housekeeping' | 'dining' | 'medical' | 'excursions'

export interface ServiceChannel {
  id: ChannelId
  /** Typical minutes to a first reply when things are normal. */
  minutes: number
  /** The crew member shown on replies (fictional). */
  crew: string
  /** Chat is not for emergencies in this channel: say so first. */
  urgentNote: boolean
}

export const CHANNELS: readonly ServiceChannel[] = [
  { id: 'guestServices', minutes: 5, crew: 'Ines, Guest Services', urgentNote: false },
  { id: 'housekeeping', minutes: 10, crew: 'Marlon, Housekeeping', urgentNote: false },
  { id: 'dining', minutes: 8, crew: 'Paolo, Dining', urgentNote: false },
  { id: 'medical', minutes: 5, crew: 'Nurse Aiko, Medical Center', urgentNote: true },
  { id: 'excursions', minutes: 12, crew: 'Dev, Shore Excursions', urgentNote: false },
]

export const channelById = (id: unknown): ServiceChannel | undefined => CHANNELS.find((c) => c.id === id)

export const isChannelId = (id: unknown): id is ChannelId => !!channelById(id)

/** When chat runs slowly (the scenario) replies take this many times as long. */
export const SLOW_FACTOR = 5

/** After this many minutes without a reply, the screen offers a phone call instead. */
export const ESCALATE_AFTER_MINUTES = 15

export const MAX_MESSAGE = 1000

export type ChatStatus = 'waiting' | 'answered' | 'resolved' | 'escalated'

export interface ChatState {
  status: ChatStatus
  /** Minutes the guest has waited for a first reply, rounded down. */
  waitedMinutes: number
  /** Where the guest stands in the queue while waiting: 1 is next. Null once answered. */
  queue: number | null
  /** The expected wait, minutes, shown while waiting. */
  expectedMinutes: number
  /** Offer the phone call now. */
  canEscalate: boolean
}

/** Where a conversation stands: waiting for a first reply, answered, resolved after three times the first-reply time, or handed to a phone call. */
export function chatState(channel: ServiceChannel, sentAt: number, now: number, slow: boolean, escalatedAt: number | null): ChatState {
  const expected = channel.minutes * (slow ? SLOW_FACTOR : 1)
  const waited = Math.max(0, Math.floor((now - sentAt) / 60_000))
  const expectedMinutes = expected
  if (escalatedAt !== null) return { status: 'escalated', waitedMinutes: waited, queue: null, expectedMinutes, canEscalate: false }
  if (waited >= expected * 3) return { status: 'resolved', waitedMinutes: waited, queue: null, expectedMinutes, canEscalate: false }
  if (waited >= expected) return { status: 'answered', waitedMinutes: waited, queue: null, expectedMinutes, canEscalate: false }
  const remaining = expected - waited
  return { status: 'waiting', waitedMinutes: waited, queue: Math.max(1, Math.ceil((remaining / expected) * 4)), expectedMinutes, canEscalate: waited >= ESCALATE_AFTER_MINUTES || slow }
}

/** When the first reply arrives. */
export const replyAt = (channel: ServiceChannel, sentAt: number, slow: boolean): number => sentAt + channel.minutes * (slow ? SLOW_FACTOR : 1) * 60_000

const REPLIES: Record<ChannelId, string> = {
  guestServices: 'Thank you for getting in touch. I have your note and am looking into it now. I will update you here.',
  housekeeping: 'Thank you. Your steward has been told and will visit your stateroom soon. You can use Do Not Disturb to say when not to.',
  dining: 'Thank you. I have passed that to the maître d’ and noted any allergies on your reservation. Your table is held.',
  medical: 'Thank you. A nurse will phone your stateroom shortly. If this is an emergency, dial 911 now instead of waiting.',
  excursions: 'Thank you. The Shore Excursions desk on Deck 9 has your question and will reply here, or visit us any time.',
}

export const crewReply = (channel: ChannelId): string => REPLIES[channel]

export function cleanMessage(text: unknown): string {
  return typeof text === 'string' ? text.trim().slice(0, MAX_MESSAGE) : ''
}
