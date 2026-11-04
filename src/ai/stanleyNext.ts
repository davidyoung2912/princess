import type { JourneyStage } from '../routes/hubs'
import { nextSteps, urgentStep, type HomeFacts } from '../routes/stageHome'

/** What Stanley says Home should do next: one line, a button, no model call (docs/experience-extension-ideas.md 13.2, component 7). */
export interface NextAnswer {
  /** The locale key of the sentence. */
  key: string
  /** The locale key of the step named in the sentence, for the plain case. */
  stepKey?: string
  /** Where the button goes, or null when nothing needs doing. */
  to: string | null
}

const URGENT_KEYS = {
  payment: 'stanley.next.payment',
  checkin: 'stanley.next.checkin',
  documents: 'stanley.next.documents',
  muster: 'stanley.next.muster',
  bags: 'stanley.next.bags',
} as const

/** From 18:00 on board, the evening nudge looks ahead to tomorrow instead of repeating the day's list. */
export const EVENING_HOUR = 18

/**
 * One answer from the stage, the facts Home already has and the hour: an urgent reason first (payment, check-in, documents, muster, bags),
 * then on board in the evening a look at tomorrow, then the first step not yet done, and "up to date" when every step is done.
 */
export function stanleyNext(stage: JourneyStage, facts: HomeFacts, hour: number): NextAnswer {
  const steps = nextSteps(stage, facts)
  const first = steps.find((s) => !s.done)
  const urgent = urgentStep(stage, facts)
  if (urgent && first) return { key: URGENT_KEYS[urgent], to: first.to }
  if (!first) return { key: 'stanley.next.allDone', to: null }
  if (hour >= EVENING_HOUR && (stage === 'sea' || stage === 'port')) return { key: 'stanley.next.evening', to: '/plan/day' }
  return { key: 'stanley.next.step', stepKey: first.key, to: first.to }
}
