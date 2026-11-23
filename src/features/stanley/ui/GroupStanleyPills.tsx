import { useMemo, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router'
import { composeReply, readQuestion } from '../logic/understand'
import { portDays } from '../logic/understand/portDays'
import { getContext, subscribeContext } from '../../account/logic/context'
import { itinerary } from '../../../domain/sailings'
import { useJourneyPosition } from '../../../shared/hooks/useJourneyPosition'
import { useSailing } from '../../../shared/hooks/useDemo'
import { screenForPath } from '../../../app/routes/screens'
import { StanleyPills } from './StanleyReply'

/**
 * Suggested screens under Stanley's answer in a shared conversation. Everyone sees the same words; the screens are worked out here, from the question that was asked and this guest's own stage and booking,
 * so two people in one chat can see different, correct buttons. The answer itself is never replaced, and a question that is not understood adds nothing.
 */
export function GroupStanleyPills({ question }: { question: string }) {
  const { stage } = useJourneyPosition()
  const hasBooking = !!useSyncExternalStore(subscribeContext, getContext, getContext)?.booking
  const sailing = useSailing()
  const screenId = screenForPath(useLocation().pathname)?.id
  const ports = useMemo(() => portDays(itinerary(sailing)), [sailing])
  const actions = useMemo(() => composeReply(readQuestion(question, { stage, hasBooking, screenId, portDays: ports }), { kind: 'answer', source: 'library', existing: [] }).actions, [question, stage, hasBooking, screenId, ports])
  return <StanleyPills actions={actions} />
}
