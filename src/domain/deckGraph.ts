import { DECKS, ELEVATORS, PLACES, placeById, type ElevatorBank, type Place, type Section } from './deck'

/**
 * A small graph of the ship built from the deck data (N5.2): a hall node for each section of each deck, a lift node for each bank on each deck,
 * and a shaft node joining the decks of one bank. Places hang off the hall of their deck and section. The shortest way is found with
 * Dijkstra, so a way to a cabin or across the ship comes from the same data as the deck plan and the line drawn on it.
 */
export const SECTION_ORDER: readonly Section[] = ['forward', 'midship', 'aft']

/** A cabin's place on the plan. The deck is the number without its last three digits ("8123" is deck 8, "12045" deck 12). */
export function cabinPlace(number: string): Place | null {
  if (!/^\d{4,5}$/.test(number)) return null
  const deck = Number(number.slice(0, -3))
  const room = Number(number.slice(-3))
  if (deck < 2 || deck > 20) return null
  // Authored: low numbers are forward and high numbers aft, as on most ships. Verify against the real deck plan before real use.
  const section: Section = room < 200 ? 'forward' : room < 350 ? 'midship' : 'aft'
  return { id: `cabin:${number}`, name: `Cabin ${number}`, deck, section, kind: 'service', stepFree: true }
}

/** Resolves a place id or a `cabin:NNNN` id. */
export function locate(id: string): Place | undefined {
  return id.startsWith('cabin:') ? cabinPlace(id.slice(6)) ?? undefined : placeById(id)
}

export type Waypoint =
  | { kind: 'hall'; deck: number; section: Section }
  | { kind: 'lift'; deck: number; section: Section; bank: ElevatorBank['bank'] }

interface Edge { to: string; cost: number }

const hallId = (deck: number, s: Section) => `hall:${deck}:${s}`
const liftId = (b: string, deck: number) => `lift:${b}:${deck}`

function allDecks(extra: readonly number[]): number[] {
  const set = new Set<number>([...DECKS, ...extra])
  const lo = Math.min(...set)
  const hi = Math.max(...set)
  // Lift banks serve every deck between the lowest and highest.
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}

/** The adjacency lists for the ship; `extra` adds decks that hold no listed place (cabin decks). */
export function buildGraph(extra: readonly number[] = []): Map<string, Edge[]> {
  const g = new Map<string, Edge[]>()
  const link = (a: string, b: string, cost: number) => {
    if (!g.has(a)) g.set(a, [])
    if (!g.has(b)) g.set(b, [])
    g.get(a)!.push({ to: b, cost })
    g.get(b)!.push({ to: a, cost })
  }
  for (const deck of allDecks(extra)) {
    // Walking along a deck costs a little less on the upper decks: ties go to riding first and walking where the destination is.
    const walk = 3 + 0.001 * (30 - deck)
    SECTION_ORDER.slice(1).forEach((s, i) => link(hallId(deck, SECTION_ORDER[i]), hallId(deck, s), walk))
    for (const e of ELEVATORS) {
      link(hallId(deck, e.section), liftId(e.bank, deck), 1)
      link(liftId(e.bank, deck), `shaft:${e.bank}`, 2 + deck / 3)
    }
  }
  return g
}

function dijkstra(g: Map<string, Edge[]>, from: string, to: string): string[] | null {
  const dist = new Map<string, number>([[from, 0]])
  const prev = new Map<string, string>()
  const open = new Set<string>([from])
  while (open.size > 0) {
    let cur = ''
    let best = Infinity
    for (const n of open) if ((dist.get(n) ?? Infinity) < best) { best = dist.get(n)!; cur = n }
    open.delete(cur)
    if (cur === to) break
    for (const e of g.get(cur) ?? []) {
      const d = best + e.cost
      if (d < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, d); prev.set(e.to, cur); open.add(e.to) }
    }
  }
  if (!dist.has(to)) return null
  const path = [to]
  while (path[0] !== from) path.unshift(prev.get(path[0])!)
  return path
}

/** The halls and lifts to pass through between two places, in order (the places themselves are the ends). Null if there is no way. */
export function wayBetween(a: Place, b: Place): Waypoint[] | null {
  const g = buildGraph([a.deck, b.deck])
  const path = dijkstra(g, hallId(a.deck, a.section), hallId(b.deck, b.section))
  if (!path) return null
  const out: Waypoint[] = []
  for (const n of path) {
    const [kind, x, y] = n.split(':')
    if (kind === 'hall') out.push({ kind: 'hall', deck: Number(x), section: y as Section })
    else if (kind === 'lift') {
      const bank = ELEVATORS.find((e) => e.bank === x)!
      out.push({ kind: 'lift', deck: Number(y), section: bank.section, bank: bank.bank })
    }
  }
  return out
}

/** Every listed place plus a cabin: a place's id is in the graph if it is listed. */
export const knownPlace = (id: string): boolean => PLACES.some((p) => p.id === id) || id.startsWith('cabin:') && cabinPlace(id.slice(6)) !== null
