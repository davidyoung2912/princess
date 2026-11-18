/** The understanding engine, joined to the app's words (docs/stanley-answers-plan.md). Everything else in this folder is pure and has no idea what a locale is. */
import { t, type StringKey } from '../../i18n'
import type { JourneyStage } from '../../routes/hubs'
import { compose, type Composed, type ReplyFacts, type Words } from './reply'
import { understand, type Understood } from './understand'

export type { Composed, ReplyFacts } from './reply'
export type { Understood, Pill, Outcome } from './understand'

export interface Where { stage?: JourneyStage; hasBooking?: boolean; screenId?: string }

/** The words on a pill. */
export const pillLabel = (destination: string): string => t(`understand.pill.${destination}` as StringKey)

/** Reads a question as this guest, right now. */
export const readQuestion = (text: string, where: Where): Understood => understand(text, where, pillLabel)

const words = (): Words => ({
  topic: (id) => t(`understand.topic.${id}` as StringKey),
  say: (act, topic) => t(`understand.say.${act}` as StringKey, { topic }),
  ambiguous: t('understand.ambiguous'),
  miss: t('understand.miss'),
  fallback: ['search', 'help', 'contact'].map((id) => ({ id, label: pillLabel(id), path: ({ search: '/ship/search', help: '/me/help', contact: '/me/contact' } as const)[id as 'search'] })),
})

/** What to show for a reply once the question is understood: new words if it was no answer, and the pills. */
export const composeReply = (understood: Understood, facts: ReplyFacts): Composed => compose(understood, facts, words())
