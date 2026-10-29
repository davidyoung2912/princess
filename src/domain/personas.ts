import type { TextSize } from '../design/textSize'

export type Tier = 'none' | 'gold' | 'ruby' | 'platinum' | 'elite'
export type PackageId = 'none' | 'plus' | 'premier'
export type StateroomKind = 'interior' | 'oceanview' | 'balcony' | 'accessibleBalcony' | 'miniSuite' | 'familyBalcony' | 'connectingBalcony'
export type PersonaGroup = 'solo' | 'harper' | 'brennan'
export type PersonaId =
  | 'gerald' | 'maria' | 'linda' | 'alexander'
  | 'daniel' | 'priya' | 'ethan' | 'maya'
  | 'marcus' | 'elena' | 'lucas' | 'sofia'

export interface Persona {
  id: PersonaId
  name: string
  firstName: string
  age: number
  group: PersonaGroup
  /** What they are to the party: shown in the switcher. */
  role: string
  /** The booker who holds the account the stateroom is under (themselves for solo personas). */
  booker: PersonaId
  tier: Tier
  package: PackageId
  stateroom: StateroomKind
  /** Sanctuary Collection suite guest (§22). */
  sanctuary: boolean
  /** Supervised child account. */
  child: boolean
  defaultTextSize: TextSize
  /** One line on what the persona exercises. */
  summary: string
}

const p = (x: Omit<Persona, 'firstName' | 'child' | 'sanctuary' | 'defaultTextSize'> & Partial<Pick<Persona, 'sanctuary' | 'defaultTextSize'>>): Persona => ({
  sanctuary: false,
  defaultTextSize: 'standard',
  ...x,
  firstName: x.name.split(' ')[0],
  child: x.age < 18,
})

/** The twelve fictional demo people (requirements §4.1). Everyone is on the single supported cruise. */
export const PERSONAS: readonly Persona[] = [
  p({ id: 'gerald', name: 'Gerald Whitfield', age: 71, group: 'solo', role: 'Platinum repeat guest', booker: 'gerald', tier: 'platinum', package: 'none', stateroom: 'balcony', defaultTextSize: 'large', summary: 'Large text, traditional dining, phone fallback, a family helper' }),
  p({ id: 'maria', name: 'Maria Delgado', age: 38, group: 'solo', role: 'First-time cruiser', booker: 'maria', tier: 'none', package: 'none', stateroom: 'oceanview', summary: 'Reassurance, price breakdowns, what happens on embarkation day' }),
  p({ id: 'linda', name: 'Linda Okafor', age: 66, group: 'solo', role: 'Accessibility guest', booker: 'linda', tier: 'ruby', package: 'none', stateroom: 'accessibleBalcony', summary: 'Accessible routes, tender assistance, assistance requests' }),
  p({ id: 'alexander', name: 'Alexander Reyes', age: 54, group: 'solo', role: 'Sanctuary suite guest', booker: 'alexander', tier: 'elite', package: 'premier', stateroom: 'miniSuite', sanctuary: true, summary: 'Premium entitlements and priority access' }),
  p({ id: 'daniel', name: 'Daniel Harper', age: 41, group: 'harper', role: 'Father, booker', booker: 'daniel', tier: 'ruby', package: 'plus', stateroom: 'connectingBalcony', summary: 'Organiser of the shared trip, controls the children’s accounts' }),
  p({ id: 'priya', name: 'Priya Harper', age: 39, group: 'harper', role: 'Mother', booker: 'daniel', tier: 'ruby', package: 'plus', stateroom: 'connectingBalcony', summary: 'Vegetarian, wants spa time' }),
  p({ id: 'ethan', name: 'Ethan Harper', age: 14, group: 'harper', role: 'Son, teen', booker: 'daniel', tier: 'ruby', package: 'none', stateroom: 'connectingBalcony', summary: 'The Underground; supervised account' }),
  p({ id: 'maya', name: 'Maya Harper', age: 8, group: 'harper', role: 'Daughter, 8', booker: 'daniel', tier: 'ruby', package: 'none', stateroom: 'connectingBalcony', summary: 'Neon Grove; nut allergy' }),
  p({ id: 'marcus', name: 'Marcus Brennan', age: 43, group: 'brennan', role: 'Father, booker', booker: 'marcus', tier: 'gold', package: 'none', stateroom: 'familyBalcony', summary: 'Enthusiastic about excursions' }),
  p({ id: 'elena', name: 'Elena Brennan', age: 40, group: 'brennan', role: 'Mother', booker: 'marcus', tier: 'gold', package: 'none', stateroom: 'familyBalcony', summary: 'Wants quiet time, wine and spa' }),
  p({ id: 'lucas', name: 'Lucas Brennan', age: 6, group: 'brennan', role: 'Son, 6', booker: 'marcus', tier: 'gold', package: 'none', stateroom: 'familyBalcony', summary: 'Firefly Park' }),
  p({ id: 'sofia', name: 'Sofia Brennan', age: 11, group: 'brennan', role: 'Daughter, 11', booker: 'marcus', tier: 'gold', package: 'none', stateroom: 'familyBalcony', summary: 'Neon Grove' }),
]

export const DEFAULT_PERSONA: PersonaId = 'gerald'

export const personaById = (id: unknown): Persona | undefined => PERSONAS.find((x) => x.id === id)

export const isPersonaId = (id: unknown): id is PersonaId => !!personaById(id)

/** Everyone on the same booking (the booker's party), including the booker. */
export const partyOf = (id: PersonaId): Persona[] => {
  const booker = personaById(id)!.booker
  return PERSONAS.filter((x) => x.booker === booker)
}

/** People the persona can see and message: their own group only. Solo personas see no one (requirements §4.1 rule 3). */
export const visibleTo = (id: PersonaId): Persona[] => {
  const me = personaById(id)!
  return me.group === 'solo' ? [] : PERSONAS.filter((x) => x.group !== 'solo' && x.id !== id)
}
