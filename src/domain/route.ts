import { PLACES, type Place, type Section } from './deck'
import { locate, SECTION_ORDER, wayBetween, type Waypoint } from './deckGraph'

/** Finding the way between two places on the ship (ACS-02, N5.2). The way comes from the deck graph (`deckGraph.ts`) and is put into words here; either end may be a cabin (`cabin:8123`). */
const ORDER = SECTION_ORDER

export type RouteStep =
  | { kind: 'walk'; toward: Section | 'near'; deck: number }
  | { kind: 'lift'; bank: string; from: number; to: number; section: Section }
  | { kind: 'arrive'; place: string; note?: string }

export type RouteResult =
  | { ok: true; steps: RouteStep[]; minutes: number; stepFree: boolean; way: Waypoint[] }
  | { ok: false; reason: 'unknown' | 'same' | 'notStepFree'; place?: Place; instead?: Place }

/** A step-free place of the same kind to suggest, nearest in deck first. */
export function stepFreeInstead(p: Place): Place | undefined {
  return PLACES.filter((x) => x.kind === p.kind && x.stepFree && x.id !== p.id).sort((a, b) => Math.abs(a.deck - p.deck) - Math.abs(b.deck - p.deck))[0]
}

/** Puts the halls and lifts of a way into steps: walk to the lift bank, ride, walk the rest. */
function stepsFor(way: Waypoint[], to: Place): RouteStep[] {
  const steps: RouteStep[] = []
  const toward = (x: Section, y: Section): Section | 'near' => (x === y ? 'near' : ORDER.indexOf(y) > ORDER.indexOf(x) ? 'aft' : 'forward')
  let i = 0
  let rode = false
  while (i < way.length) {
    const w = way[i]
    if (w.kind === 'hall') {
      let j = i
      while (j + 1 < way.length && way[j + 1].kind === 'hall') j++
      const last = way[j] as Extract<Waypoint, { kind: 'hall' }>
      if (j > i || !rode) steps.push({ kind: 'walk', toward: toward(w.section, last.section), deck: w.deck })
      i = j + 1
    } else {
      let j = i
      while (j + 1 < way.length && way[j + 1].kind === 'lift') j++
      const last = way[j] as Extract<Waypoint, { kind: 'lift' }>
      steps.push({ kind: 'lift', bank: w.bank, from: w.deck, to: last.deck, section: w.section })
      rode = true
      i = j + 1
    }
  }
  steps.push({ kind: 'arrive', place: to.id, note: to.note })
  return steps
}

export function routeBetween(fromId: string, toId: string, opts: { stepFree: boolean }): RouteResult {
  const a = locate(fromId)
  const b = locate(toId)
  if (!a || !b) return { ok: false, reason: 'unknown' }
  if (a.id === b.id) return { ok: false, reason: 'same', place: a }
  if (opts.stepFree) {
    const blocked = [a, b].find((p) => !p.stepFree)
    if (blocked) return { ok: false, reason: 'notStepFree', place: blocked, instead: stepFreeInstead(blocked) }
  }
  const way = wayBetween(a, b)
  if (!way) return { ok: false, reason: 'unknown' }
  const hop = Math.abs(ORDER.indexOf(a.section) - ORDER.indexOf(b.section))
  const minutes = a.deck === b.deck ? 2 + 3 * hop : 4 + Math.ceil(Math.abs(a.deck - b.deck) / 3) + 3 * hop
  return { ok: true, steps: stepsFor(way, b), minutes, stepFree: a.stepFree && b.stepFree, way }
}
