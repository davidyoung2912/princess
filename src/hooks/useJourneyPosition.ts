import { useSyncExternalStore } from 'react'
import { getContext, subscribeContext } from '../account/context'
import { journeyPosition, type JourneyPosition } from '../domain/journeyPosition'
import { useDemo, useNow, useSailing } from './useDemo'

/** Where the guest is on their journey at the app's "now": the server's stage (their actions and the sailing's dates, the testing date included) with the day and clock worked out here. */
export function useJourneyPosition(): JourneyPosition {
  const context = useSyncExternalStore(subscribeContext, getContext, getContext)
  const sailing = useSailing()
  const now = useNow()
  const demo = useDemo()
  return journeyPosition({ hasBooking: !!context?.booking, server: context ? { stage: context.stage, reason: context.stageReason, focusSailingId: context.focusSailingId } : null, sailing, now, phoneZone: demo.phoneZone })
}
