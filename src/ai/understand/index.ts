/** The understanding engine, joined to the app's words (docs/stanley-answers-plan.md). Everything else in this folder is pure and has no idea what a locale is. */
import { hasText, t, type StringKey } from '../../i18n'
import { SCREEN_BY_ID } from '../../routes/screens'
import { DESTINATIONS } from './destinations'
import { SCREEN_SPECS } from './screenSpec'
import { STAGE_ACTION, type JourneyStage } from '../../routes/hubs'
import type { Pill } from './understand'
import { compose, type Composed, type ReplyFacts, type Words } from './reply'
import type { EntityKind } from './entities'
import { understand, type Previous, type Understood } from './understand'
import { directAnswer, type LiveShip } from './answers'
import { formatTime } from '../../domain/cruise'
import { formatMoney } from '../../domain/money'
import type { StanleyCard } from '../stanleyCard'

export type { Composed, ReplyFacts } from './reply'
export type { Understood, Pill, Outcome, Named, Previous } from './understand'
export { EMPTY_THREAD, choiceOf, previousOf, remember, type Choice, type Thread } from './thread'

export interface Where { stage?: JourneyStage; hasBooking?: boolean; screenId?: string; portDays?: Readonly<Record<string, number>>; previous?: Previous }

/** The words on a pill. */
const SCREEN_OF: ReadonlyMap<string, string> = new Map(SCREEN_SPECS.flatMap((x) => x.dests.split(' ').map((d) => d.split('=') as [string, string])))
const NAME_OF: ReadonlyMap<string, string> = new Map(SCREEN_SPECS.map((x) => [x.id, x.name]))
/** The words on a pill: its own, or for a long tail screen (`screenSpec.ts`) the screen's title. */
export const pillLabel = (destination: string): string => {
  const screen = SCREEN_OF.get(destination)
  return !hasText(`understand.pill.${destination}`) && screen && DESTINATIONS[destination] ? t(SCREEN_BY_ID.get(screen)!.titleKey) : t(`understand.pill.${destination}` as StringKey)
}
/** What a topic is called in a sentence. */
export const topicName = (id: string): string => (hasText(`understand.topic.${id}`) ? t(`understand.topic.${id}` as StringKey) : NAME_OF.get(id) ?? id)

/** The words on the pill for a named thing. */
export const entityLabel = (kind: EntityKind, name: string, variant: 'open' | 'tours'): string => t(`understand.entity.${variant === 'tours' ? 'tours' : kind}` as StringKey, { name })

/** Reads a question as this guest, right now. */
export const readQuestion = (text: string, where: Where): Understood => understand(text, where, pillLabel, entityLabel)

/** What the honest miss needs to know: the guest's words (for the search pill) and their stage (for its home screen). */
export interface Asked { text: string; stage?: JourneyStage }

const SEARCH_WORDS = 40

const words = (asked: Asked): Words => ({
  topic: topicName,
  say: (act, topic) => t(`understand.say.${act}` as StringKey, { topic }),
  named: (name) => t('understand.named', { name }),
  clarify: (topics) => t('understand.clarify', { options: topics.length === 2 ? t('understand.clarify.two', { a: topics[0]!, b: topics[1]! }) : t('understand.clarify.three', { a: topics[0]!, b: topics[1]!, c: topics[2] ?? '' }) }),
  ambiguous: t('understand.ambiguous'),
  miss: t('understand.miss'),
  fallback: missPills(asked),
})

/** The three ways on after a miss: search the app for the guest's own words, browse from where they are in the trip, or talk to a person. */
export function missPills(asked: Asked): Pill[] {
  const typed = asked.text.replace(/\s+/g, ' ').trim()
  const short = typed.length > SEARCH_WORDS ? `${typed.slice(0, SEARCH_WORDS - 1).trimEnd()}…` : typed
  const search: Pill = typed ? { id: 'search', label: t('understand.miss.search', { words: short }), path: `/ship/search?q=${encodeURIComponent(typed.slice(0, 80))}` } : { id: 'search', label: pillLabel('search'), path: '/ship/search' }
  return [search, { id: 'browse', label: t('understand.miss.browse'), path: asked.stage ? STAGE_ACTION[asked.stage] : '/' }, { id: 'contact', label: t('understand.miss.person'), path: '/me/contact' }]
}

/** What to show for a reply once the question is understood: new words if it was no answer, and the pills. */
export const composeReply = (understood: Understood, facts: ReplyFacts, asked: Asked = { text: '' }): Composed => compose(understood, facts, words(asked))

/** A card that answers the question from the app's own data, or null when the pills and the server should (see answers.ts). */
export const answerFromData = (text: string, understood: Understood, live: LiveShip | null): StanleyCard | null =>
  directAnswer(text, understood, { time: formatTime, money: formatMoney }, (k, p) => t(k as StringKey, p), live)

export { liveShip } from './liveShip'
