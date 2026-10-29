import type { PersonaId } from '../../domain/personas'
import { personaById } from '../../domain/personas'

export const firstName = (id: PersonaId): string => personaById(id)?.firstName ?? id
export const names = (ids: readonly PersonaId[]): string => ids.map(firstName).join(', ')
