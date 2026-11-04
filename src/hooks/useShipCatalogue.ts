import { useEffect } from 'react'
import { useSailing } from './useDemo'
import { useCatalogue } from './useCatalogue'
import { itinerary, type ItineraryDay } from '../domain/sailings'
import { loadSailingRooms, loadShipRooms, sailingRooms, shipRooms, type Room } from '../domain/shipRooms'
import { cruiseOf, loadItinerary, pricedSailings, sailingFor, shipOf, type CruiseSummary, type SailingEntry, type ShipSummary } from '../domain/shipCatalogue'
import { CATEGORIES } from '../domain/ship'
import { activateDeck, loadAboardPlan } from '../domain/aboardPlans'
import { activateVenues, loadShipVenues } from '../domain/shipVenues'
import { activateProgram, loadShipProgram } from '../domain/programServed'

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

/** A sailing's room types with sample fares, or null while they load (or when the server has none). Asks the server when they are not yet in use. */
export function useSailingRooms(sailingId: string | undefined): readonly Room[] | null {
  useCatalogue()
  useEffect(() => { if (sailingId) void loadSailingRooms(sailingId) }, [sailingId])
  return (sailingId && sailingRooms(sailingId)) || null
}

/** A ship's room types (no fares), or null while they load. */
export function useShipRooms(shipId: string | undefined): readonly Room[] | null {
  useCatalogue()
  useEffect(() => { if (shipId) void loadShipRooms(shipId) }, [shipId])
  return (shipId && shipRooms(shipId)) || null
}

/** The sailings with fares, of any ship, soonest first (`aboardOnly` keeps those on a ship that has the deck plan). Draws again when the catalogue arrives. */
export function usePricedSailings(aboardOnly = false): readonly SailingEntry[] {
  useCatalogue()
  const all = pricedSailings()
  return aboardOnly ? all.filter((e) => shipOf(e.id).depth === 'aboard') : all
}

/** One room type to choose from. */
export interface RoomChoice { id: string; name: string; summary: string }

/** The room types to choose from for a sailing: the ship's own as the server serves them, or Sun Princess's six while a Sun sailing's answer is on its way. Empty while another ship's load. */
export function useRoomChoices(sailingId: string): RoomChoice[] {
  const rooms = useSailingRooms(sailingId || undefined)
  if (rooms) return rooms.map((r) => ({ id: r.id, name: r.name, summary: r.description || CATEGORIES.find((c) => c.id === r.id)?.summary || '' }))
  return shipOf(sailingId).depth === 'browse' ? [] : CATEGORIES.map((c) => ({ id: c.id, name: c.name, summary: c.summary }))
}

/** The days of any one sailing (not only the focused one), asked of the server when they are not yet in use. */
export function useDaysOf(sailingId: string): ItineraryDay[] {
  useCatalogue()
  useEffect(() => { if (sailingId) void loadItinerary(sailingId) }, [sailingId])
  const s = sailingFor(sailingId)
  return s ? itinerary(s) : []
}

/** Keeps the deck plan the screens read (places, elevators, muster stations) the dining (rooms, menus, delivery zones) and the programme on those of the focused sailing's ship, asking the server for it when it is not yet kept. */
export function useActiveDeck(): void {
  const sailing = useSailing()
  useCatalogue()
  const shipId = shipOf(sailing.id).id
  useEffect(() => {
    if (!shipId) return
    if (activateDeck(shipId)) return
    void loadAboardPlan(shipId).then((ok) => { if (ok) activateDeck(shipId) })
  }, [shipId])
  useEffect(() => {
    if (!shipId) return
    if (activateVenues(shipId)) return
    void loadShipVenues(shipId).then((ok) => { if (ok) activateVenues(shipId) })
  }, [shipId])
  useEffect(() => {
    if (!shipId) return
    if (activateProgram(shipId)) return
    void loadShipProgram(shipId).then((ok) => { if (ok) activateProgram(shipId) })
  }, [shipId])
}
