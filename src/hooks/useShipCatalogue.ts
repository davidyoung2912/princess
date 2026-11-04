import { useEffect } from 'react'
import { useSailing } from './useDemo'
import { useCatalogue } from './useCatalogue'
import { itinerary, type ItineraryDay } from '../domain/sailings'
import { cruiseOf, loadItinerary, shipOf, type CruiseSummary, type ShipSummary } from '../domain/shipCatalogue'

/** The ship the focused sailing runs on. Draws again when the catalogue arrives. */
export function useShip(): ShipSummary {
  const sailing = useSailing()
  useCatalogue()
  return shipOf(sailing.id)
}

/** The cruise of the focused sailing: its name, length, start port and intro. */
export function useCruise(): CruiseSummary {
  const sailing = useSailing()
  useCatalogue()
  return cruiseOf(sailing.id)
}

/** The days of the focused sailing (any length and route). Asks the server for them when they are not yet in use; the older route shows meanwhile. */
export function useItinerary(): ItineraryDay[] {
  const sailing = useSailing()
  useCatalogue()
  useEffect(() => { void loadItinerary(sailing.id) }, [sailing.id])
  return itinerary(sailing)
}
