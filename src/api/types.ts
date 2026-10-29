import type { Entitlements, Balance, BalanceKey } from '../domain/entitlements'
import type { PackageId, PersonaId, StateroomKind, Tier } from '../domain/personas'
import type { PortId } from '../domain/sailings'

/**
 * The contract between screens and "the server". Screens only ever use this interface; the mock below implements it with
 * async answers, seeded delay and failure, and an offline switch, so a real service could replace it without touching them.
 * Each group starts with the calls the first screens need and grows as phases add features.
 */
export interface Identity {
  personaId: PersonaId
  name: string
  tier: Tier
}

export interface Booking {
  personaId: PersonaId
  bookerId: PersonaId
  sailingId: string
  party: PersonaId[]
  stateroom: StateroomKind
  tier: Tier
  package: PackageId
}

export interface Sailing {
  id: string
  departure: string
}

export interface CheckinStatus {
  state: 'notOpen' | 'open' | 'done'
  /** When online check-in opens (three days before departure). */
  opensAt: number
}

export interface Item {
  id: string
  at: number
  data: unknown
}

export interface Message {
  id: string
  from: PersonaId
  text: string
  at: number
}

export interface PortToday {
  port: PortId
  day: number | null
}

export interface Api {
  auth: { me(): Promise<Identity> }
  bookings: { get(): Promise<Booking>; sailings(): Promise<Sailing[]> }
  checkin: { status(): Promise<CheckinStatus>; submit(): Promise<CheckinStatus> }
  dining: { list(): Promise<Item[]>; reschedule(id: string, to: string): Promise<Item> }
  queues: { list(): Promise<Item[]> }
  orders: { list(): Promise<Item[]>; place(items: string[]): Promise<Item> }
  messages: { list(): Promise<Message[]>; send(text: string): Promise<Message> }
  photos: { list(): Promise<Item[]>; download(id: string): Promise<Item> }
  folio: { entitlements(): Promise<{ entitlements: Entitlements; balances: Record<BalanceKey, Balance> }> }
  requests: { list(): Promise<Item[]>; create(kind: string, note: string): Promise<Item> }
  ports: { today(): Promise<PortToday> }
  help: { contacts(): Promise<{ guestServices: string; emergency: string }> }
}
