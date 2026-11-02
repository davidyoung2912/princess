import { isPersonaId } from '../domain/personas'
import type { PersonaId } from '../domain/people'

/**
 * The twelve demo people have fixed public ids on the server (`Users.PublicId`, the SHA-1 of `princess-persona:user:<slug>`
 * formatted as a guid; see `scripts/persona-seed.ts`). The screens and the mock groups that move in Phases 14 to 18 still use
 * the slug as `PersonaId`, so the HTTP layer swaps one for the other at the boundary. Anyone else keeps the guid.
 */
export const PERSONA_GUIDS: Record<PersonaId, string> = {
  gerald: '5187a592-5266-c962-98d1-8192d3e378a5',
  maria: '5a9b37a4-ab9b-9320-fd68-79307665efe9',
  linda: 'a9dcc267-08e5-0985-8bbf-69ba1b9158c8',
  alexander: '45de51da-7fd9-ecea-a822-3b2820b8d587',
  daniel: '9d374c67-f90e-2e77-7865-47e67ef8b63f',
  priya: 'c3ea5d1e-3408-9949-ce07-f6005601194e',
  ethan: '8641fa30-959e-32cf-10c4-50282ba453b1',
  maya: '861f7d65-4de9-d347-0d19-05abaae31bd5',
  marcus: 'bdc6df45-6f49-3e96-9ea8-293fc28ce0a3',
  elena: 'c5882738-6860-96ca-3052-ae3e8b9f4e47',
  lucas: '5bfdd1d9-4ff6-7be2-d528-9d020a79534e',
  sofia: 'a97347e3-e039-1ec1-e08b-19c50751f6cb',
}

const SLUG_OF = new Map<string, PersonaId>((Object.entries(PERSONA_GUIDS) as [PersonaId, string][]).map(([slug, guid]) => [guid, slug]))

/** A person id for the server: the persona's guid, or the value unchanged. */
export const toWireId = (id: string): string => (isPersonaId(id) ? PERSONA_GUIDS[id] : id)

/** A person id from the server: the persona slug for the twelve, or the guid unchanged. */
export const fromWireId = (id: string): string => SLUG_OF.get(id.toLowerCase()) ?? id

/** Every string value and object key in a server response, with person guids swapped for slugs. */
export function fromWire<T>(value: unknown): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return fromWireId(v)
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [fromWireId(k), walk(x)]))
    return v
  }
  return walk(value) as T
}
