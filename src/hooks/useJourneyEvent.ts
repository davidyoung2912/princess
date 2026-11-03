import { useEffect } from 'react'
import { recordJourney, type JourneyEventKind } from '../runtime'

/** Records that the guest looked at something that moves their stage, once when the screen shows for a sailing (nothing without one). */
export function useJourneyEvent(kind: JourneyEventKind, sailingId: string | null | undefined): void {
  useEffect(() => { void recordJourney(kind, sailingId) }, [kind, sailingId])
}
