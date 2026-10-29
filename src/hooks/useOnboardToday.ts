import { asOnboardToday } from '../api/guards'
import { api } from '../runtime'
import { usePersona } from './useDemo'
import { useSavedCopy } from './useSavedCopy'

/** Today's state on board (where the ship is, the all-aboard card), kept on the phone so it still shows with no signal. */
export function useOnboardToday() {
  const me = usePersona()
  return useSavedCopy('today', me?.id ?? 'none', () => api.onboard.today(), asOnboardToday, [me?.id])
}
