import type { GuideView } from '../api/guideTypes'
import { primaryOf, urgentTask } from '../guide/view'

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
 * One answer from the guest's guide and the hour, so it can never differ from what Home lists: an urgent reason first (payment, check-in, documents, muster, bags),
 * then on board in the evening a look at tomorrow, then the guide's first task, and "up to date" when nothing is open to do.
 */
export function stanleyNext(view: GuideView, hour: number): NextAnswer {
  const urgent = urgentTask(view)
  if (urgent?.urgencyReason) return { key: URGENT_KEYS[urgent.urgencyReason], to: urgent.to }
  const first = primaryOf(view)
  if (!first) return { key: 'stanley.next.allDone', to: null }
  if (hour >= EVENING_HOUR && (view.stage === 'sea' || view.stage === 'port')) return { key: 'stanley.next.evening', to: '/plan/day' }
  return { key: 'stanley.next.step', stepKey: `guide.${first.id}.title`, to: first.to }
}
