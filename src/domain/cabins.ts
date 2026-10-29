import type { CategoryId } from './ship'

/** Staterooms you can pick (BOK-03). The numbers, positions and notes are authored samples, not the real deck plan. */
export type Position = 'forward' | 'midship' | 'aft'
export type Side = 'port' | 'starboard'

export interface Cabin {
  number: string
  deck: number
  position: Position
  side: Side
  /** Plain-words notes about the location. */
  notes: string[]
  /** The view is partly blocked (for example by lifeboats). */
  obstructed: boolean
  accessible: boolean
  available: boolean
}

const DECKS: Record<CategoryId, readonly number[]> = {
  interior: [8, 9, 10, 11, 12],
  oceanview: [8, 9, 10],
  balcony: [10, 11, 12, 14, 15],
  miniSuite: [14, 15, 16],
  sanctuaryMiniSuite: [16],
  signatureSuite: [16],
}

const POSITIONS: readonly Position[] = ['forward', 'midship', 'aft']
const PER_CATEGORY = 9

const hash = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** The sample staterooms for a room type, and which are free on a sailing. The same sailing and room type always give the same answer. */
export function cabinsFor(sailingId: string, category: CategoryId): Cabin[] {
  const decks = DECKS[category]
  const cabins = Array.from({ length: PER_CATEGORY }, (_, i): Cabin => {
    const deck = decks[i % decks.length]
    const position = POSITIONS[i % 3]
    const side: Side = i % 2 === 0 ? 'port' : 'starboard'
    const number = `${deck}${String(100 + ((i * 37 + category.length * 11) % 400)).padStart(3, '0')}`
    const obstructed = (category === 'oceanview' || category === 'balcony') && deck <= 9 && position !== 'midship'
    const accessible = i === 1 && category !== 'sanctuaryMiniSuite' && category !== 'signatureSuite'
    const notes: string[] = []
    if (position === 'midship') notes.push('Near the elevators')
    else notes.push(position === 'forward' ? 'Toward the front of the ship' : 'Toward the back of the ship')
    if (deck >= 14) notes.push('Close to the pool decks, so some daytime noise')
    if (obstructed) notes.push('View partly blocked by lifeboats')
    if (accessible) notes.push('Step-free entrance with a roll-in shower')
    return { number, deck, position, side, notes, obstructed, accessible, available: true }
  })
  // About one in five is taken; the first two are always free so a choice always exists.
  return cabins.map((c, i) => ({ ...c, available: i < 2 || hash(`${sailingId}|${c.number}`) % 5 !== 0 }))
}

/** The free staterooms with a number, if the number is a real stateroom of that room type on that sailing. */
export const cabinAvailable = (sailingId: string, category: CategoryId, number: string): boolean => cabinsFor(sailingId, category).some((c) => c.number === number && c.available)
