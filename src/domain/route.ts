import { ELEVATORS, PLACES, placeById, type Place, type Section } from './deck'

/** Finding the way between two places on the ship (ACS-02). Directions are in words, with the step-free option, and use only what the deck plan knows. */
const ORDER: readonly Section[] = ['forward', 'midship', 'aft']

export type RouteStep =
  | { kind: 'walk'; toward: Section | 'near'; deck: number }
  | { kind: 'lift'; bank: string; from: number; to: number; section: Section }
  | { kind: 'arrive'; place: string; note?: string }

export type RouteResult =
  | { ok: true; steps: RouteStep[]; minutes: number; stepFree: boolean }
  | { ok: false; reason: 'unknown' | 'same' | 'notStepFree'; place?: Place; instead?: Place }

/** A step-free place of the same kind to suggest, nearest in deck first. */
export function stepFreeInstead(p: Place): Place | undefined {
  return PLACES.filter((x) => x.kind === p.kind && x.stepFree && x.id !== p.id).sort((a, b) => Math.abs(a.deck - p.deck) - Math.abs(b.deck - p.deck))[0]
}

const bankIn = (s: Section) => ELEVATORS.find((e) => e.section === s)!.bank

export function routeBetween(fromId: string, toId: string, opts: { stepFree: boolean }): RouteResult {
  const a = placeById(fromId)
  const b = placeById(toId)
  if (!a || !b) return { ok: false, reason: 'unknown' }
  if (a.id === b.id) return { ok: false, reason: 'same', place: a }
  if (opts.stepFree) {
    const blocked = [a, b].find((p) => !p.stepFree)
    if (blocked) return { ok: false, reason: 'notStepFree', place: blocked, instead: stepFreeInstead(blocked) }
  }
  const steps: RouteStep[] = []
  const hop = (x: Section, y: Section) => Math.abs(ORDER.indexOf(x) - ORDER.indexOf(y))
  const toward = (x: Section, y: Section): Section | 'near' => (x === y ? 'near' : ORDER.indexOf(y) > ORDER.indexOf(x) ? 'aft' : 'forward')
  let minutes: number
  if (a.deck === b.deck) {
    steps.push({ kind: 'walk', toward: toward(a.section, b.section), deck: a.deck })
    minutes = 2 + 3 * hop(a.section, b.section)
  } else {
    // Ride from the lift bank in the starting section; walk the rest of the way on the arrival deck.
    steps.push({ kind: 'walk', toward: 'near', deck: a.deck })
    steps.push({ kind: 'lift', bank: bankIn(a.section), from: a.deck, to: b.deck, section: a.section })
    if (a.section !== b.section) steps.push({ kind: 'walk', toward: toward(a.section, b.section), deck: b.deck })
    minutes = 4 + Math.ceil(Math.abs(a.deck - b.deck) / 3) + 3 * hop(a.section, b.section)
  }
  steps.push({ kind: 'arrive', place: b.id, note: b.note })
  return { ok: true, steps, minutes, stepFree: a.stepFree && b.stepFree }
}
