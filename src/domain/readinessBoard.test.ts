import { describe, expect, it } from 'vitest'
import { nudgeText, readinessBoard } from './readinessBoard'

const r = (percent: number) => ({ percent, open: [] })

describe('readinessBoard', () => {
  it('puts the furthest behind first and marks those under the line', () => {
    const rows = readinessBoard([{ id: 'a', name: 'Ann', readiness: r(90) }, { id: 'b', name: 'Bo', readiness: r(40) }, { id: 'c', name: 'Cy', readiness: r(40) }])
    expect(rows.map((x) => x.id)).toEqual(['b', 'c', 'a'])
    expect(rows.map((x) => x.behind)).toEqual([true, true, false])
  })
})

describe('nudgeText', () => {
  it('lists at most three open items', () => {
    const t = nudgeText('Bo', [1, 2, 3, 4].map((n) => ({ label: `Item ${n}`, due: 'May 1' })))
    expect(t).toContain('Hi Bo')
    expect(t).toContain('- Item 3 (due May 1)')
    expect(t).not.toContain('Item 4')
  })
  it('says so when nothing is open', () => {
    expect(nudgeText('Ann', [])).toContain('all ready')
  })
})
