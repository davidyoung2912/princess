import { useSyncExternalStore } from 'react'
import { getContext, subscribeContext } from '../account/context'
import { journeyPosition, type JourneyPosition } from '../domain/journeyPosition'
import { useDemo, useNow, useSailing } from './useDemo'

/** Where the guest is on their journey at the app's "now": the booking and the (testing) date together decide it. */
export function useJourneyPosition(): JourneyPosition {
  const context = useSyncExternalStore(subscribeContext, getContext, getContext)
  const sailing = useSailing()
  const now = useNow()
  const demo = useDemo()
  return journeyPosition({ hasBooking: !!context?.booking, sailing, now, phoneZone: demo.phoneZone })
}
