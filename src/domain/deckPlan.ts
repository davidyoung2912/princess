import { ELEVATORS, MUSTER_STATIONS, placesOnDeck, type ElevatorBank, type Place, type Section } from './deck'
import type { Waypoint } from './deckGraph'

/**
 * Where things are drawn on the graphic deck plan (N5.1). Pure geometry, no React: the plan is a schematic (forward at the left, port
 * above, starboard below), not a scale drawing, laid out from the same places, lift banks and muster stations the text lists use.
 */
export const PLAN_W = 640
export const PLAN_H = 200
const X: Record<Section, [number, number]> = { forward: [50, 230], midship: [230, 420], aft: [420, 600] }
const Y_PORT = 60
const Y_STAR = 140
export const Y_HALL = 100

/** Places treated as quiet spaces on the plan's quiet layer. Authored; the live feed (Ship Pulse) says how busy they are at the moment. */
export const QUIET_PLACE_IDS: readonly string[] = ['lotus', 'salon', 'promenade', 'intl-cafe', 'coffee-currents']

export interface Point { x: number; y: number }
export interface PlacedPlace { place: Place; at: Point; quiet: boolean; muster: string | null }  // letters of the muster stations here, such as "C" or "C/D"
export interface PlacedLift { bank: ElevatorBank['bank']; at: Point }

const mid = (s: Section): number => (X[s][0] + X[s][1]) / 2

/** Spreads a section's places along its length, alternating port and starboard rows. */
export function placePlaces(deck: number): PlacedPlace[] {
  const out: PlacedPlace[] = []
  for (const s of Object.keys(X) as Section[]) {
    const here = placesOnDeck(deck).filter((p) => p.section === s)
    const [x0, x1] = X[s]
    here.forEach((place, i) => {
      const per = Math.ceil(here.length / 2)
      const col = Math.floor(i / 2)
      const x = x0 + ((col + 1) * (x1 - x0)) / (per + 1)
      const letters = Object.values(MUSTER_STATIONS).filter((m) => m.placeId === place.id && m.deck === deck).map((m) => m.letter)
      const muster = letters.length > 0 ? letters.join('/') : null
      out.push({ place, at: { x, y: i % 2 === 0 ? Y_PORT : Y_STAR }, quiet: QUIET_PLACE_IDS.includes(place.id), muster })
    })
  }
  return out
}

/** Where a lift bank is drawn: in the hall at the middle of its section, on its side of the ship. */
export function placeLifts(): PlacedLift[] {
  return ELEVATORS.map((e) => ({ bank: e.bank, at: { x: mid(e.section) + (e.side === 'port' ? -22 : 22), y: Y_HALL } }))
}

/** The hall point of a section on the plan. */
export const hallPoint = (s: Section): Point => ({ x: mid(s), y: Y_HALL })

/** Where a place is drawn on its deck, or the hall point of its section when it is not listed (a cabin). */
export function pointOf(p: Place): Point {
  return placePlaces(p.deck).find((x) => x.place.id === p.id)?.at ?? hallPoint(p.section)
}

/** The points of a way that lie on one deck, in order, with the end places added: the line drawn on that deck's plan. Empty if the way never touches the deck. */
export function lineOnDeck(way: readonly Waypoint[], from: Place, to: Place, deck: number): Point[] {
  const pts: Point[] = []
  if (from.deck === deck) pts.push(pointOf(from))
  for (const w of way) {
    if (w.deck !== deck) continue
    pts.push(w.kind === 'hall' ? hallPoint(w.section) : placeLifts().find((l) => l.bank === w.bank)!.at)
  }
  if (to.deck === deck) pts.push(pointOf(to))
  return pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y)
}

/** The decks a way passes through, in order. */
export const decksOf = (way: readonly Waypoint[], from: Place, to: Place): number[] => [...new Set([from.deck, ...way.map((w) => w.deck), to.deck])]

/** The hull outline: a pointed bow at the left and a square stern at the right. */
export const HULL_PATH = `M ${X.forward[0] - 30} ${Y_HALL} Q ${X.forward[0]} 22 ${X.forward[0] + 60} 22 L ${X.aft[1] + 20} 22 L ${X.aft[1] + 20} 178 L ${X.forward[0] + 60} 178 Q ${X.forward[0]} 178 ${X.forward[0] - 30} ${Y_HALL} Z`

/** The dividing lines between forward, midship and aft. */
export const SECTION_DIVIDERS: readonly number[] = [X.midship[0], X.aft[0]]
export const SECTION_LABEL_X: Record<Section, number> = { forward: mid('forward'), midship: mid('midship'), aft: mid('aft') }
