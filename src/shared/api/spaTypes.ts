import type { Cents } from '../../domain/money'
import type { PersonaId } from '../../domain/people'
import type { PartyMember } from './types'

// The wire shapes of the spa appointments (server/Princess.Api/Contracts/SpaContracts.cs). Instants are epoch ms, times are ship time "HH:MM".

/** Something a spa venue sells by appointment. `price` is per person. */
export interface SpaTreatment {
  id: string
  venueId: string
  title: string
  detail: string
  minutes: number
  price: Cents
  minAge?: number
  /** How many can be given at the same time. */
  rooms: number
}

/** What cancelling an appointment would cost right now. */
export interface SpaCancelTerms {
  free: boolean
  fee: Cents
  /** The last moment cancelling is free. */
  freeUntil: number
}

export interface SpaAppointment {
  id: string
  venueId: string
  treatmentId: string
  title: string
  day: number
  time: string
  minutes: number
  startAt: number
  guests: PersonaId[]
  note: string
  /** The total for everyone in it. */
  price: Cents
  /** False once it has started, or for a guest who may not change bookings. */
  canChange: boolean
  cancel: SpaCancelTerms
  at: number
}

export interface SpaView {
  treatments: SpaTreatment[]
  appointments: SpaAppointment[]
  party: PartyMember[]
  canBook: boolean
  cancelFreeHours: number
  lateFeePercent: number
  maxParty: number
}

/** A time a treatment can start and how many rooms are left then. */
export interface SpaSlot {
  time: string
  left: number
}
