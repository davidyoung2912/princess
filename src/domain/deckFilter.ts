import type { Place, PlaceKind } from './deck'
import { routeBetween } from './route'

/** The category filters on the deck plan (Q6): each is a group of place kinds. Quiet spaces and step-free have their own toggles beside these. */
export const DECK_CATEGORIES = ['food', 'shows', 'family', 'wellness', 'services', 'restrooms', 'lifts'] as const
export type DeckCategory = (typeof DECK_CATEGORIES)[number]

const KINDS: Record<DeckCategory, readonly PlaceKind[]> = {
  food: ['dining', 'bar'],
  shows: ['show'],
  family: ['family'],
  wellness: ['wellness', 'pool'],
  services: ['service', 'medical', 'shop'],
  restrooms: ['restroom'],
  lifts: [], // chosen alone, the plan dims every place so the lift banks stand out
}

/** True when nothing is chosen (show everything) or the place is in one of the chosen categories. */
export const inCategories = (p: Pick<Place, 'kind'>, chosen: ReadonlySet<DeckCategory>): boolean =>
  chosen.size === 0 || [...chosen].some((c) => KINDS[c].includes(p.kind))

/** Minutes to walk between two places, or null when there is no way (or a place is unknown). */
export function walkMinutes(fromId: string, toId: string, stepFree: boolean): number | null {
  const r = routeBetween(fromId, toId, { stepFree })
  return r.ok ? r.minutes : null
}

const MIN_ZOOM = 1
const MAX_ZOOM = 3

/** Clamps a zoom factor to the range the plan supports. */
export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

/** The zoom after a pinch: the old zoom scaled by how much the two fingers moved apart. */
export const pinchZoom = (zoom: number, startDistance: number, distance: number): number =>
  startDistance <= 0 ? zoom : clampZoom(zoom * (distance / startDistance))

/** One step of momentum: the distance to scroll this frame and the velocity left (px per frame). Stops below half a pixel. */
export function momentumStep(velocity: number): { move: number; velocity: number } {
  const next = velocity * 0.92
  return { move: velocity, velocity: Math.abs(next) < 0.5 ? 0 : next }
}
