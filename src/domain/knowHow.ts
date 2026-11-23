/**
 * Cruise know-how (screen S51): short, plain tips for the things first-time and returning guests ask that no other screen answers: what to wear, the ship's rules, how money works aboard,
 * the words crew use, what to do on a sea day, whether to buy a drink package, what travel insurance is for, and how a tender port works. Framework-free so it can be tested.
 * The text is in the locale file under `knowhow.<topic>.title`, `.tip.<n>` and `.link` (the label of the one related screen). Nothing here states a price or a cruise-line
 * policy as fact: tips say what is usual and send the guest to the document or screen that holds the real answer.
 */
import type { JourneyStage } from '../routes/hubs'

export interface KnowHowTopic {
  id: string
  /** The locale keys of the tips, in order (written out so the unused-key test can see each one is used). */
  tips: readonly string[]
  title: string
  text: string
  /** The related screen's path and the stages the topic matters most in (it is listed first then). */
  link: string
  stages: readonly JourneyStage[]
}

export const KNOW_HOW: readonly KnowHowTopic[] = [
  { id: 'dress', title: 'knowhow.dress.title', text: 'knowhow.dress.link', tips: ['knowhow.dress.tip.1', 'knowhow.dress.tip.2', 'knowhow.dress.tip.3', 'knowhow.dress.tip.4'], link: '/plan/ship-packing', stages: ['prebook', 'embark', 'sea'] },
  { id: 'rules', title: 'knowhow.rules.title', text: 'knowhow.rules.link', tips: ['knowhow.rules.tip.1', 'knowhow.rules.tip.2', 'knowhow.rules.tip.3', 'knowhow.rules.tip.4', 'knowhow.rules.tip.5'], link: '/me/help', stages: ['prebook', 'embark'] },
  { id: 'money', title: 'knowhow.money.title', text: 'knowhow.money.link', tips: ['knowhow.money.tip.1', 'knowhow.money.tip.2', 'knowhow.money.tip.3', 'knowhow.money.tip.4'], link: '/me/money', stages: ['prebook', 'embark', 'sea'] },
  { id: 'words', title: 'knowhow.words.title', text: 'knowhow.words.link', tips: ['knowhow.words.tip.1', 'knowhow.words.tip.2', 'knowhow.words.tip.3', 'knowhow.words.tip.4', 'knowhow.words.tip.5'], link: '/nautical/glossary', stages: ['dream', 'discover', 'prebook', 'embark'] },
  { id: 'seaday', title: 'knowhow.seaday.title', text: 'knowhow.seaday.link', tips: ['knowhow.seaday.tip.1', 'knowhow.seaday.tip.2', 'knowhow.seaday.tip.3', 'knowhow.seaday.tip.4'], link: '/activities-explorer', stages: ['prebook', 'sea'] },
  { id: 'drinks', title: 'knowhow.drinks.title', text: 'knowhow.drinks.link', tips: ['knowhow.drinks.tip.1', 'knowhow.drinks.tip.2', 'knowhow.drinks.tip.3', 'knowhow.drinks.tip.4'], link: '/plan/prepay', stages: ['manage', 'prebook', 'embark'] },
  { id: 'insurance', title: 'knowhow.insurance.title', text: 'knowhow.insurance.link', tips: ['knowhow.insurance.tip.1', 'knowhow.insurance.tip.2', 'knowhow.insurance.tip.3', 'knowhow.insurance.tip.4'], link: '/plan/what-if', stages: ['book', 'manage', 'prebook'] },
  { id: 'tender', title: 'knowhow.tender.title', text: 'knowhow.tender.link', tips: ['knowhow.tender.tip.1', 'knowhow.tender.tip.2', 'knowhow.tender.tip.3', 'knowhow.tender.tip.4'], link: '/ship/port/guide', stages: ['prebook', 'port'] },
]

/** The topics with the ones that matter most at this stage first; the others keep their order after them. */
export function topicsFor(stage: JourneyStage | null): KnowHowTopic[] {
  const first = KNOW_HOW.filter((t) => stage !== null && t.stages.includes(stage))
  return [...first, ...KNOW_HOW.filter((t) => !first.includes(t))]
}

