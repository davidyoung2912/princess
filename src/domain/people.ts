import type { TextSize } from '../design/textSize'

/** The types for people on a trip. A person is whoever the server describes (`GET /me/context`); nothing here is a list of people. */
export type Tier = 'none' | 'gold' | 'ruby' | 'platinum' | 'elite'
export type PackageId = 'none' | 'plus' | 'premier'
export type StateroomKind = 'interior' | 'oceanview' | 'balcony' | 'accessibleBalcony' | 'miniSuite' | 'familyBalcony' | 'connectingBalcony'
export type PersonaGroup = 'solo' | 'harper' | 'brennan'

/** A person's id: the server's guid (or, for the twelve demo accounts, a short name the client uses). Always a string. */
export type PersonaId = string

/** The signed-in person or someone on their trip, as screens see them. */
export interface Person {
  id: string
  name: string
  firstName: string
  age: number
  group: PersonaGroup
  /** What they are to the party. */
  role: string
  /** The booker who holds the account the stateroom is under (themselves when travelling alone). */
  booker: string
  tier: Tier
  package: PackageId
  stateroom: StateroomKind
  /** Sanctuary Collection suite guest. */
  sanctuary: boolean
  /** Supervised child account. */
  child: boolean
  defaultTextSize: TextSize
  summary: string
}
