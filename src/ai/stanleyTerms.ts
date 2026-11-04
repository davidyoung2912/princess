import { t, type StringKey } from '../i18n'

/** The hard words Stanley explains with a "?" (docs/experience-extension-ideas.md 13.2, component 6). The words are in the locale files; showing one costs nothing. */
export const TERMS = [
  'fare', 'taxes', 'gratuities', 'deposit', 'finalPayment', 'guarantee', 'cabinCategory', 'obstructedView', 'tender', 'allAboard',
  'shoreExcursion', 'muster', 'medallion', 'onboardCredit', 'specialty', 'anytimeDining', 'embarkation', 'checkInWindow', 'seaDay', 'disembarkation',
] as const
export type TermId = (typeof TERMS)[number]

export const termOf = (id: TermId): string => t(`stanley.term.${id}` as StringKey)
export const explanationOf = (id: TermId): string => t(`stanley.explain.${id}` as StringKey)
