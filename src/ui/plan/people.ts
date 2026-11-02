import type { PersonaId } from '../../domain/people'

import { personFirstName } from '../../account/context'

export const firstName = (id: PersonaId): string => (personFirstName(id) || id)
export const names = (ids: readonly PersonaId[]): string => ids.map(firstName).join(', ')
