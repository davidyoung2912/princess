import type { OnboardToday } from '../api/types'
import { asOnboardToday } from '../api/guards'
import { api } from '../runtime'
import { usePersona } from './useDemo'
import { useSavedCopy } from './useSavedCopy'
import { sharedCall } from './useSharedMine'

/** What a disabled call answers with: nothing. `SavedCopy.data` already allows null, so callers handle it. */
const NONE = null as unknown as OnboardToday

/**
 * Today's state on board (where the ship is, the all-aboard card), kept on the phone so it still shows with no signal. The call is shared with other screens asking at the
 * same time. While `enabled` is false nothing is called and there is no data (a screen that only sometimes needs it must still call the hook).
 */
export function useOnboardToday(enabled = true) {
  const me = usePersona()
  const id = me?.id ?? 'none'
  return useSavedCopy('today', id, () => (enabled ? sharedCall(id, 'onboard.today', () => api.onboard.today()) : Promise.resolve(NONE)), asOnboardToday, [me?.id, enabled])
}
