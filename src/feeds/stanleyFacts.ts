import { normalizeCard, type StanleyCard } from '../ai/stanleyCard'
import { createFeed, isRecord } from './feed'

/** Reads `GET /me/stanley/facts`: a list of cards, each in the agreed shape. A card that is not is dropped; a reply that is not a list is ignored. */
export function normalizeFacts(raw: unknown): StanleyCard[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.cards)) return null
  return raw.cards.flatMap((c) => { const card = normalizeCard(c); return card ? [card] : [] }).slice(0, 12)
}

/**
 * The guest's trip facts kept on this device (tours, dinners, packages, ports, countdown, stateroom, party), so Stanley can still show them with no signal. They are the server's own cards, and
 * the data time inside each is when the booking was read, so the guest sees how old they are. A copy is kept for a day and is forgotten at sign-out (the feed's rule).
 */
export const savedFacts = createFeed<[], StanleyCard[]>(() => 'trip', normalizeFacts, 'stanleyfacts')

/** A saved card as it is shown with no signal: labelled Cached, with the route to a person, and the data time left as the server gave it. */
export function asSaved(card: StanleyCard, note: string): StanleyCard {
  return {
    ...card,
    provenance: {
      ...card.provenance,
      chips: card.provenance.chips.includes('Cached') ? card.provenance.chips : [...card.provenance.chips, 'Cached'],
      freshness: 'cached',
      checkWithPerson: true,
      note,
    },
  }
}
