import type { PlanDay } from '../../domain/plan'
import { colourFor, TRAVELLER_COLOURS } from '../../domain/planPolish'
import { useMemory } from '../../hooks/useMemory'

/** The colour a traveller wears across the plan; the name is always printed next to it. */
export function useTravellerColours(days: readonly PlanDay[]): (id: string) => { name: string; hex: string } {
  const { state } = useMemory()
  const ids = [...new Set(days.flatMap((d) => d.entries.flatMap((e) => e.guests)))].sort()
  return (id) => TRAVELLER_COLOURS[colourFor(id, ids, state.polish.colours)]
}
