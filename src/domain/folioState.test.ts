import { describe, expect, it } from 'vitest'
import { folioTotals, lineState, type FolioLine } from './folio'

const line = (patch: Partial<FolioLine>): FolioLine => ({ id: 'l', day: 2, at: 1, category: 'shops', description: 'Item', guest: 'g', cents: 1000, ...patch })

describe('folio line states (DEB-04)', () => {
  it('treats a line with no state as posted', () => {
    expect(lineState(line({}))).toBe('posted')
  })
  it('shows a posted line with an open query as disputed, and leaves other states alone', () => {
    const queried = new Set(['l'])
    expect(lineState(line({}), queried)).toBe('disputed')
    expect(lineState(line({ state: 'refunded' }), queried)).toBe('refunded')
  })
  it('totals pending charges apart without changing the balance', () => {
    const t = folioTotals([line({ id: 'a' }), line({ id: 'b', state: 'pending', cents: 500 })])
    expect(t.pending).toBe(500)
    expect(t.balance).toBe(1500)
  })
})
