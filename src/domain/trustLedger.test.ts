import { describe, expect, it } from 'vitest'
import type { FolioLine } from './folio'
import { buildLedger, groupByDay, ledgerNet } from './trustLedger'

const f = (patch: Partial<FolioLine>): FolioLine => ({ id: 'l', day: 2, at: 1000, category: 'shops', description: 'Sunscreen', guest: 'g', cents: 1899, ...patch })

describe('trust ledger (XT-07)', () => {
  const payments = [{ id: 'p1', label: 'deposit', cents: 50_000, at: 100, method: 'Visa 4242' }, { id: 'p2', label: 'refund', cents: 2_000, at: 4000, method: 'Visa 4242' }]
  const lines = [f({ id: 'a', at: 1000 }), f({ id: 'b', at: 2000, category: 'credit', cents: -5000, description: 'Welcome gift' }), f({ id: 'c', at: 3000, cents: 0, value: 1400, coveredBy: 'package', category: 'drinks', description: 'Cocktail' })]

  it('merges payments and account lines, newest first, without losing any', () => {
    const e = buildLedger(payments, lines)
    expect(e).toHaveLength(5)
    expect(e.map((x) => x.at)).toEqual([4000, 3000, 2000, 1000, 100])
  })

  it('names the kind of each entry and signs refunds and credits as money back', () => {
    const e = Object.fromEntries(buildLedger(payments, lines).map((x) => [x.id, x]))
    expect(e['pay-p1']).toMatchObject({ kind: 'payment', cents: 50_000 })
    expect(e['pay-p2']).toMatchObject({ kind: 'refund', cents: -2000 })
    expect(e['acct-a'].kind).toBe('charge')
    expect(e['acct-b']).toMatchObject({ kind: 'credit', cents: -5000 })
    expect(e['acct-c']).toMatchObject({ kind: 'covered', value: 1400 })
  })

  it('totals the net amount, and handles nothing at all', () => {
    expect(ledgerNet(buildLedger(payments, lines))).toBe(50_000 - 2000 + 1899 - 5000)
    expect(buildLedger([], [])).toEqual([])
    expect(ledgerNet([])).toBe(0)
  })

  it('keeps a stable order for equal times', () => {
    const e = buildLedger([], [f({ id: 'b', at: 5 }), f({ id: 'a', at: 5 })])
    expect(e.map((x) => x.id)).toEqual(['acct-a', 'acct-b'])
  })

  it('groups by day, keeping order', () => {
    const g = groupByDay(buildLedger(payments, lines), (at) => (at >= 3000 ? 'late' : 'early'))
    expect(g.map((x) => [x.day, x.entries.length])).toEqual([['late', 2], ['early', 3]])
  })
})
