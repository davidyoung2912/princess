import { servedAccess } from './accessReference'

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

/** How a ship's staterooms are laid out (as `CabinRules` on the server): decks per room class, the pool deck, the highest deck whose views lifeboats block. */
interface ShipCabins { decks: Record<string, readonly number[]>; poolDeck: number; lifeboatDeck: number }
export const SUN_SHIP = 'sun-princess'
export const SHIP_CABINS: Record<string, ShipCabins> = {
  [SUN_SHIP]: { decks: { interior: [8, 9, 10, 11, 12], oceanview: [8, 9, 10], balcony: [10, 11, 12, 14, 15], miniSuite: [14, 15, 16], sanctuaryMiniSuite: [16], signatureSuite: [16] }, poolDeck: 14, lifeboatDeck: 9 },
  'sky-princess': { decks: { interior: [9, 10, 11, 12, 14], oceanview: [9, 10, 11], balcony: [9, 10, 11, 12, 14], miniSuite: [12, 14] }, poolDeck: 15, lifeboatDeck: 10 },
  'sapphire-princess': { decks: { interior: [8, 9, 10, 11], oceanview: [8, 9, 10], balcony: [8, 9, 10, 11], miniSuite: [10, 11] }, poolDeck: 11, lifeboatDeck: 8 },
}

/** The room class of a category id: Sun's six keep theirs; a ship's own (`sky-balcony`, `sapphire-minisuite`) name the same classes. */
export const classOf = (category: string): string => {
  if (category in SHIP_CABINS[SUN_SHIP].decks) return category
  const tail = category.slice(category.lastIndexOf('-') + 1)
  return tail === 'minisuite' ? 'miniSuite' : tail
}

/** A ship's own category id for a room class, for example `sky-balcony`. */
export const ownCategoryId = (shipId: string, roomClass: string): string => `${shipId.replace('-princess', '')}-${roomClass.toLowerCase()}`

const POSITIONS: readonly Position[] = ['forward', 'midship', 'aft']
const PER_CATEGORY = 9

const hash = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * Room types with accessible staterooms (step-free entrance, wider door, roll-in shower; see `SHIP_ACCESSIBILITY`).
 * The two top suite types have none, so a guest who needs step-free access is told before choosing them.
 */
export const hasAccessibleCabins = (category: string): boolean => {
  const served = servedAccess()
  return served ? served.accessibleCategories.includes(category) : classOf(category) !== 'sanctuaryMiniSuite' && classOf(category) !== 'signatureSuite'
}

/** The sample staterooms for a room type, and which are free on a sailing. The same sailing and room type always give the same answer. */
export function cabinsFor(sailingId: string, category: string, shipId: string = SUN_SHIP): Cabin[] {
  const layout = SHIP_CABINS[shipId] ?? SHIP_CABINS[SUN_SHIP]
  const roomClass = classOf(category)
  const decks = layout.decks[roomClass]
  if (!decks) return []
  // Sapphire's oceanview and mini-suite share decks and a name length, so its mini-suite gets its own salt to keep every number unique (as the server).
  const salt = shipId !== SUN_SHIP && roomClass === 'miniSuite' ? 12 : roomClass.length
  const cabins = Array.from({ length: PER_CATEGORY }, (_, i): Cabin => {
    const deck = decks[i % decks.length]
    const position = POSITIONS[i % 3]
    const side: Side = i % 2 === 0 ? 'port' : 'starboard'
    const number = `${deck}${String(100 + ((i * 37 + salt * 11) % 400)).padStart(3, '0')}`
    const obstructed = (roomClass === 'oceanview' || roomClass === 'balcony') && deck <= layout.lifeboatDeck && position !== 'midship'
    const accessible = i === 1 && hasAccessibleCabins(category)
    const notes: string[] = []
    if (position === 'midship') notes.push('Near the elevators')
    else notes.push(position === 'forward' ? 'Toward the front of the ship' : 'Toward the back of the ship')
    if (deck >= layout.poolDeck) notes.push('Close to the pool decks, so some daytime noise')
    if (obstructed) notes.push('View partly blocked by lifeboats')
    if (accessible) notes.push('Step-free entrance with a roll-in shower')
    return { number, deck, position, side, notes, obstructed, accessible, available: true }
  })
  // About one in five is taken; the first two are always free so a choice always exists.
  return cabins.map((c, i) => ({ ...c, available: i < 2 || hash(`${sailingId}|${c.number}`) % 5 !== 0 }))
}

/** The free staterooms with a number, if the number is a real stateroom of that room type on that sailing. */
export const cabinAvailable = (sailingId: string, category: string, number: string, shipId?: string): boolean => cabinsFor(sailingId, category, shipId).some((c) => c.number === number && c.available)
