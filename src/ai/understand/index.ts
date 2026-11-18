/** The understanding engine, joined to the app's words (docs/stanley-answers-plan.md). Everything else in this folder is pure and has no idea what a locale is. */
import { t, type StringKey } from '../../i18n'
import type { JourneyStage } from '../../routes/hubs'
import { compose, type Composed, type ReplyFacts, type Words } from './reply'
import type { EntityKind } from './entities'
import { understand, type Understood } from './understand'
import { directAnswer, type LiveShip } from './answers'
import { formatTime } from '../../domain/cruise'
import { formatMoney } from '../../domain/money'
import type { StanleyCard } from '../stanleyCard'

export type { Composed, ReplyFacts } from './reply'
export type { Understood, Pill, Outcome, Named } from './understand'

export interface Where { stage?: JourneyStage; hasBooking?: boolean; screenId?: string; portDays?: Readonly<Record<string, number>> }

/** The words on a pill. */
export const pillLabel = (destination: string): string => t(`understand.pill.${destination}` as StringKey)

/** The words on the pill for a named thing. */
export const entityLabel = (kind: EntityKind, name: string, variant: 'open' | 'tours'): string => t(`understand.entity.${variant === 'tours' ? 'tours' : kind}` as StringKey, { name })

/** Reads a question as this guest, right now. */
export const readQuestion = (text: string, where: Where): Understood => understand(text, where, pillLabel, entityLabel)

const words = (): Words => ({
  topic: (id) => t(`understand.topic.${id}` as StringKey),
  say: (act, topic) => t(`understand.say.${act}` as StringKey, { topic }),
  named: (name) => t('understand.named', { name }),
  ambiguous: t('understand.ambiguous'),
  miss: t('understand.miss'),
  fallback: ['search', 'help', 'contact'].map((id) => ({ id, label: pillLabel(id), path: ({ search: '/ship/search', help: '/me/help', contact: '/me/contact' } as const)[id as 'search'] })),
})

/** What to show for a reply once the question is understood: new words if it was no answer, and the pills. */
export const composeReply = (understood: Understood, facts: ReplyFacts): Composed => compose(understood, facts, words())

/** A card that answers the question from the app's own data, or null when the pills and the server should (see answers.ts). */
export const answerFromData = (text: string, understood: Understood, live: LiveShip | null): StanleyCard | null =>
  directAnswer(text, understood, { time: formatTime, money: formatMoney }, (k, p) => t(k as StringKey, p), live)

export { liveShip } from './liveShip'
