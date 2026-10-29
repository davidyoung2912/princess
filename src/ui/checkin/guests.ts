import { useSearchParams } from 'react-router'
import type { CheckinGuestView, CheckinView } from '../../api/types'
import type { GuestStepId } from '../../domain/checkin'
import type { PersonaId } from '../../domain/personas'

/** The guest this step page is about: the one in the address, else the first who still has the step to do. */
export function useChosenGuest(view: CheckinView, step: GuestStepId): [CheckinGuestView, (id: PersonaId) => void] {
  const [params, setParams] = useSearchParams()
  const wanted = params.get('guest')
  const guest = view.guests.find((g) => g.id === wanted) ?? view.guests.find((g) => !g.progress.done.includes(step)) ?? view.guests[0]
  return [guest, (id) => setParams({ guest: id }, { replace: true })]
}

/** The people who still have a step to do (everyone, when all are done, so a correction is possible). */
export const pending = (view: CheckinView, step: GuestStepId): PersonaId[] => {
  const left = view.guests.filter((g) => !g.progress.done.includes(step)).map((g) => g.id)
  return left.length > 0 ? left : view.guests.map((g) => g.id)
}
