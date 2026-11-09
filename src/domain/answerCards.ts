/** Answer cards for the search screen: a few words that have a direct answer (wifi, dinner, late) get a card above the results. Pure, so it is unit tested without React. */
export interface AnswerFacts {
  /** Cheapest Wi-Fi plan per day, already formatted, or null if unknown. */
  wifiFrom: string | null
  /** Tonight's dinner time (HH:MM), or null when none is booked or it is not known. */
  dinnerTonight: string | null
}

export interface AnswerCard {
  id: 'wifi' | 'dinner' | 'late'
  /** Which fact wording to use; the screen turns this into a sentence. */
  to: string
  /** The value to put in the sentence, if any. */
  value: string | null
  /** Where the fact comes from: the ship's own information, or the guest's booking and plan. */
  source: 'ship' | 'trip'
  /** What it covers: the whole ship, or today. */
  scope: 'ship' | 'day'
}

const flat = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const TRIGGERS: { id: AnswerCard['id']; words: readonly string[]; to: string; source: AnswerCard['source']; scope: AnswerCard['scope'] }[] = [
  { id: 'wifi', words: ['wifi', 'wi-fi', 'internet', 'online'], to: '/ship/wifi', source: 'ship', scope: 'ship' },
  { id: 'dinner', words: ['dinner', 'reservation', 'table'], to: '/plan/reservations', source: 'trip', scope: 'day' },
  { id: 'late', words: ['late', 'delayed', 'delay', 'running behind'], to: '/home/delayed', source: 'ship', scope: 'day' },
]

/** The cards for a query: one for each topic any word of the query starts or matches. `allow` keeps only screens the guest may open at this stage. */
export function answerCards(query: string, facts: AnswerFacts, allow: (to: string) => boolean = () => true): AnswerCard[] {
  const q = flat(query).trim()
  if (q.length < 2) return []
  const words = q.split(/\s+/)
  return TRIGGERS
    .filter((tr) => allow(tr.to) && tr.words.some((w) => words.some((x) => x.length >= 2 && (w.startsWith(x) || x === w))))
    .map((tr) => ({ id: tr.id, to: tr.to, source: tr.source, scope: tr.scope, value: tr.id === 'wifi' ? facts.wifiFrom : tr.id === 'dinner' ? facts.dinnerTonight : null }))
}
