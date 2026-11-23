import { useSearchParams } from 'react-router'
import { reservationScope, type ReservationScope } from '../../features/explorer/domain/reservationsByDay'
import { useExplorerStage } from './useExplorerStage'

/** This day or Whole trip, kept in `?view=` so a link or a reload keeps it; before sailing the default is the whole trip. */
export function useReservationScope(): [ReservationScope, (next: ReservationScope) => void] {
  const [params, setParams] = useSearchParams()
  const { stage } = useExplorerStage()
  const scope = reservationScope(params.get('view'), stage)
  const set = (next: ReservationScope) => setParams((p) => { const q = new URLSearchParams(p); q.set('view', next); return q }, { replace: true })
  return [scope, set]
}
