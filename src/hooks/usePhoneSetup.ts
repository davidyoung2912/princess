import { useCallback, useSyncExternalStore } from 'react'
import { toggleStep, type PhoneStepId } from '../domain/phoneSetup'
import { getPhone, subscribePhone, updatePhone } from '../phone/store'
import { useOwnerId } from './useDemo'

/** The steps the signed-in person has ticked on the phone-setup list, and a function to tick or untick one. */
export function usePhoneSetup(): { done: PhoneStepId[]; toggle: (id: PhoneStepId) => void } {
  const me = useOwnerId()
  const done = useSyncExternalStore(subscribePhone, () => getPhone(me), () => getPhone(me))
  const toggle = useCallback((id: PhoneStepId) => updatePhone(me, (s) => toggleStep(s, id)), [me])
  return { done, toggle }
}
