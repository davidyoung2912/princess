import { regionById, shipById } from '../../domain/shipCatalogue'

/** The ship's name for a ship id (the id itself while the catalogue has not arrived). */
export const shipName = (id: string): string => shipById(id)?.name ?? id

/** The region's name for a region id; empty when there is none. */
export const regionName = (id: string | undefined): string => (id ? regionById(id)?.name ?? id : '')
