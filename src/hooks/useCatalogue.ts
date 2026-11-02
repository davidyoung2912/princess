import { useSyncExternalStore } from 'react'
import { catalogueVersion, subscribeCatalogue } from '../domain/catalogueServed'

/** Draws a screen again when the server's catalogue replaces the authored one. Returns a number that changes then. */
export const useCatalogue = (): number => useSyncExternalStore(subscribeCatalogue, catalogueVersion, catalogueVersion)
