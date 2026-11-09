import { describe, expect, it } from 'vitest'
import { accessRows, activeCount } from './access'
import { EMPTY_HOME } from './homeLink'
import { EMPTY_PARTY } from './party'
import { NOTHING_SHARED } from './partyShare'

const base = { helper: null, home: EMPTY_HOME, party: EMPTY_PARTY, sharing: NOTHING_SHARED, now: 1000 }

describe('accessRows', () => {
  it('always lists the party, with nothing shared by default', () => {
    const rows = accessRows(base)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'party', status: 'ended', items: [] })
    expect(activeCount(rows)).toBe(0)
  })

  it('shows an active helper with only the permissions given, and a requested one with none', () => {
    const helper = { name: 'Sam', relationship: 'Son', permissions: ['view', 'documents'] as const, status: 'active' as const, at: 1, linked: false, inviteCode: null }
    expect(accessRows({ ...base, helper: { ...helper, permissions: [...helper.permissions] } })[0]).toMatchObject({ kind: 'helper', status: 'active', items: ['view', 'documents'] })
    expect(accessRows({ ...base, helper: { ...helper, permissions: [...helper.permissions], status: 'requested' } }).find((r) => r.kind === 'helper')).toMatchObject({ status: 'waiting', items: [] })
    expect(accessRows({ ...base, helper: { ...helper, permissions: [...helper.permissions], status: 'revoked' } }).find((r) => r.kind === 'helper')).toMatchObject({ status: 'ended', items: [] })
  })

  it('lists Payments now that a helper can pay (BM8)', () => {
    const helper = { name: 'Sam', relationship: 'Son', permissions: ['view' as const, 'payments' as const, 'documents' as const, 'folio' as const], status: 'active' as const, at: 1, linked: false, inviteCode: null }
    expect(accessRows({ ...base, helper })[0].items).toEqual(['view', 'payments', 'documents', 'folio'])
  })

  it('treats a family contact as active only while a link is live, and reports when it ends', () => {
    const home = {
      ...EMPTY_HOME,
      contacts: [{ id: 'c1', name: 'Mum', email: 'm@x.org' }, { id: 'c2', name: 'Dad', email: 'd@x.org' }, { id: 'c3', name: 'Gran', email: 'g@x.org' }],
      links: [
        { id: 'l1', contactId: 'c1', issuedAt: 0, expiresAt: 5000, revoked: false },
        { id: 'l2', contactId: 'c2', issuedAt: 0, expiresAt: 5000, revoked: true },
        { id: 'l3', contactId: 'c3', issuedAt: 0, expiresAt: 500, revoked: false },
      ],
    }
    const rows = accessRows({ ...base, home })
    const by = (who: string) => rows.find((r) => r.who === who)!
    expect(by('Mum')).toMatchObject({ status: 'active', items: ['shipFacts'], until: 5000 })
    expect(by('Dad')).toMatchObject({ status: 'ended', items: [], until: null })
    expect(by('Gran')).toMatchObject({ status: 'ended' })
  })

  it('lists invites as waiting and the shared facets in order, with active rows first', () => {
    const party = { invites: [{ id: 'i1', email: 'a@b.co', at: 1 }], notes: [] }
    const rows = accessRows({ ...base, party, sharing: { plans: true, status: false, spending: true, photos: false } })
    expect(rows.map((r) => r.kind)).toEqual(['party', 'invite'])
    expect(rows[0].items).toEqual(['share.plans', 'share.spending'])
    expect(rows[1]).toMatchObject({ status: 'waiting', who: 'a@b.co' })
    expect(activeCount(rows)).toBe(1)
  })
})
