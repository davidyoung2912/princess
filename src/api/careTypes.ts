import type { Budget } from '../domain/budget'
import type { Consents, ConsentId, AccessEntry } from '../domain/privacy'
import type { PersonaId } from '../domain/personas'
import type { QueueStage, WaitlistStage } from '../domain/queue'
import type { Severity } from '../domain/disruption'
import type { ScenarioId } from '../domain/scenarios'
import type { DiningView } from './types'

/** Shapes for the Phase 11 groups: budget, shows, waits, updates and privacy. */
export interface BudgetView {
  budget: Budget
  /** Children on the booking, who can be given a limit. */
  kids: { id: PersonaId; name: string; age: number }[]
  canEdit: boolean
}

export interface BudgetApi {
  get(): Promise<BudgetView>
  /** Saves the budget; rejects `invalid` for an amount out of range or a limit for someone who is not a child on the booking, `forbidden` for a supervised account. */
  save(budget: Budget): Promise<BudgetView>
}

export interface ShowSeats { eventId: string; left: number }

export interface TicketView {
  id: string
  eventId: string
  title: string
  day: number
  startAt: number
  placeId: string
  status: 'on' | 'moved' | 'cancelled'
  guests: { id: PersonaId; name: string }[]
  canReturn: boolean
}

export interface ShowsApi {
  /** Seats left for each ticketed event on a day (1 to 8). */
  day(day: number): Promise<ShowSeats[]>
  mine(): Promise<TicketView[]>
  /** Rejects `conflict` with `soldOut`, `started`, `cancelled`, `age`, `duplicate`, `party`, `closed` (not aboard) or `notTicketed`; `invalid` for an unknown event, day or guest. */
  reserve(eventId: string, day: number, guests: PersonaId[]): Promise<TicketView[]>
  /** Gives the seats back; rejects `conflict` (`started`) once the event has begun. */
  cancel(id: string): Promise<TicketView[]>
}

export interface QueueView {
  id: string
  venueId: string
  joinedAt: number
  stage: QueueStage
  position: number
  waitMinutes: number
  readyAt: number
  expiresAt: number
}

export interface WaitlistView {
  id: string
  venueId: string
  day: number
  time: string
  slotAt: number
  guests: { id: PersonaId; name: string }[]
  stage: WaitlistStage
  position: number
  offerAt: number
  expiresAt: number
}

export interface WaitsView {
  /** Walk-in places that are open now and can be queued for. */
  open: string[]
  queues: QueueView[]
  waitlist: WaitlistView[]
}

export interface WaitsApi {
  list(): Promise<WaitsView>
  /** Rejects `conflict` with `closed` (venue shut or not aboard) or `duplicate`; `invalid` for a venue that cannot be queued for. */
  joinQueue(venueId: string): Promise<WaitsView>
  leaveQueue(id: string): Promise<WaitsView>
  /** Rejects `conflict` with `notFull` (a table is free: book it), `tooLate`, `duplicate`, `closed`, `clash`; `invalid` for a bad venue, night, time or party. */
  joinWaitlist(input: { venueId: string; day: number; time: string; guests: PersonaId[] }): Promise<WaitsView>
  leaveWaitlist(id: string): Promise<WaitsView>
  /** Takes an offered table; rejects `conflict` (`notOffered`, `expired`) or the same codes as `plan.dining.reserve`. Returns the dining view with the new table. */
  acceptWaitlist(id: string): Promise<DiningView>
}

export interface UpdateView {
  id: ScenarioId
  severity: Severity
  /** Whether the change is still in force. A change that has ended stays in the record. */
  active: boolean
  ack: { option: string; at: number } | null
}

export interface UpdatesApi {
  list(): Promise<UpdateView[]>
  /** Records that the guest has seen a change and what they chose. Rejects `invalid` for an unknown change or option, `forbidden` for a supervised account. */
  acknowledge(id: ScenarioId, option: string): Promise<UpdateView[]>
}

export interface PrivacyPerson {
  id: PersonaId
  name: string
  age: number
  consents: Consents
  /** Whether the signed-in person may change this person's choices (a parent for a child; each adult for themselves). */
  canEdit: boolean
}

export interface PrivacyView {
  cruiseEnds: string
  /** The date each retention rule deletes its data, or null. */
  deleteOn: Record<string, string | null>
  /** Records deleted so far, by rule, with when. */
  deleted: { kinds: string[]; at: number }[]
  people: PrivacyPerson[]
  access: AccessEntry[]
}

export interface PrivacyApi {
  /** The privacy centre. Anything past its retention date is deleted first and noted. */
  view(): Promise<PrivacyView>
  /** Sets one choice for one person. Rejects `forbidden` where the signed-in person may not decide for them, `invalid` for a choice that does not apply to their age. */
  setConsent(person: PersonaId, consent: ConsentId, on: boolean): Promise<PrivacyView>
}
