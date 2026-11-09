import { api } from '../../runtime'
import { useSharedMine } from '../../hooks/useSharedMine'
import { countdowns, nearestSpecialBy, type Countdown, type CountdownInput } from '../../domain/countdowns'

/** The countdowns for a trip, including the next assistance cut-off once the assistance view has loaded (MNG-15). Nothing is shown for it while that loads or if it fails. */
export function useCountdowns(trip: CountdownInput | null, now: number): Countdown[] {
  const assist = useSharedMine('plan.assistance', () => api.plan.assistance.get())
  if (!trip) return []
  const specialBy = assist.data ? nearestSpecialBy(assist.data.deadlines, assist.data.requests.map((r) => r.kind)) : null
  return countdowns(trip, now, { specialBy })
}
