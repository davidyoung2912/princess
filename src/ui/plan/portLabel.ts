import { PORT_GUIDES } from '../../domain/ports'
import { portById } from '../../domain/sailings'

/** A port's short name: its guide's, else the catalogue's. */
export const portLabel = (id: string): string => PORT_GUIDES[id]?.short ?? portById(id)?.name ?? id
