import { normalizePartyState, type PartyState } from '../domain/party'
import { normalizePort, type PortState } from '../port/store'

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
 * Two adults changed the port-day record at once: for each person the later "where I am" wins, plans and settings stay as this device has
 * them (or the other's if this one has none), and meeting places, split families and expenses from both are kept.
 */
export function mergePort(remote: unknown, local: unknown): PortState {
  const r = normalizePort(remote)
  const l = normalizePort(local)
  const days: PortState['party']['days'] = { ...r.party.days }
  for (const [date, mine] of Object.entries(l.party.days)) {
    const theirs = days[date]
    if (!theirs) { days[date] = mine; continue }
    const presence = { ...theirs.presence }
    for (const [who, entry] of Object.entries(mine.presence)) if (!presence[who] || presence[who].at <= entry.at) presence[who] = entry
    days[date] = { presence, plan: mine.plan ?? theirs.plan, planB: mine.planB ?? theirs.planB }
  }
  return normalizePort({
    party: { days, alertBefore: l.party.alertBefore, rendezvous: union(l.party.rendezvous, r.party.rendezvous) },
    split: { parties: union(l.split.parties, r.split.parties), items: union(l.split.items, r.split.items), settledAt: l.split.settledAt ?? r.split.settledAt },
  })
}
