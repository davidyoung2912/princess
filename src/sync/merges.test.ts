import { describe, expect, it } from 'vitest'
import { mergeOffers, mergeParty, mergePort } from './merges'

describe('party merge', () => {
  it('keeps what both adults added, once, oldest first', () => {
    const remote = { invites: [{ id: 'a', email: 'a@x.com', at: 1 }], notes: [{ id: 'n1', by: 'daniel', text: 'Pack hats', at: 5 }] }
    const local = { invites: [{ id: 'b', email: 'b@x.com', at: 2 }, { id: 'a', email: 'a@x.com', at: 1 }], notes: [{ id: 'n2', by: 'priya', text: 'Sunscreen', at: 3 }] }
    const merged = mergeParty(remote, local)
    expect(merged.invites.map((i) => i.id)).toEqual(['a', 'b'])
    expect(merged.notes.map((n) => n.id)).toEqual(['n2', 'n1'])
  })
})

describe('port merge', () => {
  const day = (presence: Record<string, { status: string; at: number }>, plan: unknown = null) => ({ presence, plan, planB: null })
  it('takes the later presence for each person and keeps both sides\' meeting places and expenses', () => {
    const remote = {
      party: { days: { '2026-03-02': day({ daniel: { status: 'back', at: 20 }, priya: { status: 'ashore', at: 5 } }) }, alertBefore: 60, rendezvous: [{ id: 'r1', place: 'Pier', at: 1, by: 'daniel', members: {}, fallback: '', fallbackAfter: 15 }] },
      split: { parties: [{ id: 'p', name: 'Harpers', people: 4 }], items: [{ id: 'i1', title: 'Taxi', kind: 'taxi', cents: 2000, paidBy: 'p', among: ['p'], mode: 'equal', at: 1, date: null }], settledAt: null },
    }
    const local = {
      party: { days: { '2026-03-02': day({ daniel: { status: 'ashore', at: 10 }, priya: { status: 'back', at: 30 } }) }, alertBefore: 30, rendezvous: [] },
      split: { parties: [{ id: 'p', name: 'Harpers', people: 4 }], items: [{ id: 'i2', title: 'Lunch', kind: 'meal', cents: 3000, paidBy: 'p', among: ['p'], mode: 'equal', at: 2, date: null }], settledAt: null },
    }
    const m = mergePort(remote, local)
    const d = m.party.days['2026-03-02']
    expect(d.presence.daniel.status).toBe('back')
    expect(d.presence.priya.status).toBe('back')
    expect(m.party.alertBefore).toBe(30)
    expect(m.party.rendezvous.map((r) => r.id)).toEqual(['r1'])
    expect(m.split.items.map((i) => i.id).sort()).toEqual(['i1', 'i2'])
  })
})

describe('offers merge', () => {
  it('counts messages sent on either device toward one cap and keeps dismissals from both', () => {
    const remote = { dismissed: { B1: ['package'] }, sent: [100, 300] }
    const local = { dismissed: { B1: ['upgrade'] }, sent: [200, 300] }
    const merged = mergeOffers(remote, local)
    expect(merged.sent).toEqual([100, 200, 300])
    expect([...merged.dismissed.B1].sort()).toEqual(['package', 'upgrade'])
  })
})
