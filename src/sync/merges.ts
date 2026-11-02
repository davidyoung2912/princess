import { normalizeOfferState, type OfferState } from '../domain/offers'
import { normalizePartyState, type PartyState } from '../domain/party'

/** Both lists, this device's entries first, an entry on both counted once. */
const union = <T extends { id: string }>(mine: readonly T[], theirs: readonly T[]): T[] => {
  const seen = new Set(mine.map((x) => x.id))
  return [...mine, ...theirs.filter((x) => !seen.has(x.id))]
}

/**
 * Two adults changed the party at once: keep every invitation and note either of them added. (A removal made on one side comes back if the
 * other side did not know of it; that is the cost of keeping both people's additions.)
 */
export function mergeParty(remote: unknown, local: unknown): PartyState {
  const r = normalizePartyState(remote)
  const l = normalizePartyState(local)
  return normalizePartyState({
    invites: union(l.invites, r.invites).sort((a, b) => a.at - b.at),
    notes: union(l.notes, r.notes).sort((a, b) => a.at - b.at),
  })
}

/**
 * Two devices changed the offers at once: marketing messages sent on either count toward the one weekly cap, and a dismissal on either
 * stays dismissed (a guest who dismissed an offer on the phone should not see it again on the laptop).
 */
export function mergeOffers(remote: unknown, local: unknown): OfferState {
  const r = normalizeOfferState(remote)
  const l = normalizeOfferState(local)
  const dismissed: OfferState['dismissed'] = {}
  for (const trip of new Set([...Object.keys(r.dismissed), ...Object.keys(l.dismissed)])) dismissed[trip] = [...new Set([...(l.dismissed[trip] ?? []), ...(r.dismissed[trip] ?? [])])]
  return normalizeOfferState({ dismissed, sent: [...new Set([...l.sent, ...r.sent])] })
}
