import { describe, expect, it } from 'vitest'
import { normalizeBudget, reportBudget, spentBy, statusOf } from './budget'
import type { FolioLine } from './folio'

const line = (guest: string, cents: number, extra: Partial<FolioLine> = {}): FolioLine => ({ id: `${guest}${cents}`, day: 2, at: 0, category: 'drinks', description: 'x', guest, cents, ...extra })

describe('budget', () => {
  it('counts only charges, not credits or what a package paid', () => {
    const lines = [line('a', 1000), line('a', -500, { category: 'credit' }), line('a', 0, { value: 900, coveredBy: 'package' }), line('b', 700)]
    expect(spentBy(lines)).toBe(1700)
    expect(spentBy(lines, 'b')).toBe(700)
  })

  it('moves from ok to near to over as spending grows, at the chosen alert level', () => {
    expect(statusOf(7900, 10000, 80).state).toBe('ok')
    expect(statusOf(8000, 10000, 80).state).toBe('near')
    expect(statusOf(10000, 10000, 80).state).toBe('near')
    expect(statusOf(10001, 10000, 80).state).toBe('over')
    expect(statusOf(5000, 10000, 50).state).toBe('near')
    expect(statusOf(9999, 10000, 100).state).toBe('ok')
    expect(statusOf(10000, 10000, 100).state).toBe('near')
    expect(statusOf(5000, null, 80)).toMatchObject({ state: 'none', percent: 0 })
    expect(statusOf(2500, 10000, 80).left).toBe(7500)
  })

  it('reports the worst state across the booking and each child', () => {
    const b = normalizeBudget({ total: 100000, alertAt: 80, kids: { kid: 2000 } })
    const r = reportBudget(b, [line('a', 5000), line('kid', 2500)])
    expect(r.total.state).toBe('ok')
    expect(r.kids[0]).toMatchObject({ id: 'kid', state: 'over' })
    expect(r.worst).toBe('over')
  })

  it('ignores bad stored values', () => {
    expect(normalizeBudget(null)).toEqual({ total: null, alertAt: 80, kids: {} })
    expect(normalizeBudget({ total: -5, alertAt: 77, kids: { x: 'y', z: 1.5, ok: 300 } })).toEqual({ total: null, alertAt: 80, kids: { ok: 300 } })
    expect(normalizeBudget({ total: 99_999_999 }).total).toBeNull()
  })
})
