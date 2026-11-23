import { describe, expect, it } from 'vitest'
import { mergeOffers, mergeParty } from './merges'

describe('party merge', () => {
  it('keeps what both adults added, once, oldest first', () => {
    const remote = { invites: [{ id: 'a', email: 'a@x.com', at: 1 }], notes: [{ id: 'n1', by: 'daniel', text: 'Pack hats', at: 5 }] }
    const local = { invites: [{ id: 'b', email: 'b@x.com', at: 2 }, { id: 'a', email: 'a@x.com', at: 1 }], notes: [{ id: 'n2', by: 'priya', text: 'Sunscreen', at: 3 }] }
    const merged = mergeParty(remote, local)
    expect(merged.invites.map((i) => i.id)).toEqual(['a', 'b'])
    expect(merged.notes.map((n) => n.id)).toEqual(['n2', 'n1'])
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
