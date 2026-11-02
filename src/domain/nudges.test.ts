import { describe, expect, it } from 'vitest'
import { DEFAULT_NUDGES, NUDGE_CHOICES, isNudgeBudget, rankNudges, takeNudge } from './nudges'

const n = (id: string, priority: number, critical = false) => ({ id, priority, critical })

describe('notification budget (XA-03)', () => {
  it('offers none among the choices, and starts at three', () => {
    expect(NUDGE_CHOICES).toContain(0)
    expect(DEFAULT_NUDGES).toBe(3)
    expect(isNudgeBudget(3)).toBe(true)
    expect(isNudgeBudget(2)).toBe(false)
  })

  it('keeps the highest-priority suggestions within the budget', () => {
    const items = [n('a', 1), n('b', 5), n('c', 3), n('d', 4)]
    expect(rankNudges(items, 1).map((i) => i.id)).toEqual(['b'])
    expect(rankNudges(items, 3).map((i) => i.id)).toEqual(['b', 'd', 'c'])
  })

  it('keeps the given order for equal priority', () => {
    expect(rankNudges([n('a', 1), n('b', 1), n('c', 1), n('d', 1)], 3).map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('drops every suggestion at zero but never a critical notice', () => {
    const items = [n('a', 9), n('safety', 0, true), n('b', 8)]
    expect(rankNudges(items, 0).map((i) => i.id)).toEqual(['safety'])
    expect(rankNudges(items, 1).map((i) => i.id)).toEqual(['safety', 'a'])
  })

  it('counts shown suggestions per day and starts again the next day', () => {
    let state = null as ReturnType<typeof takeNudge>['state'] | null
    const first = takeNudge(state, 1, '2027-03-21')
    expect(first.allowed).toBe(true)
    state = first.state
    expect(takeNudge(state, 1, '2027-03-21').allowed).toBe(false)
    expect(takeNudge(state, 1, '2027-03-22')).toMatchObject({ allowed: true, state: { day: '2027-03-22', count: 1 } })
    expect(takeNudge(null, 0, '2027-03-21').allowed).toBe(false)
  })
})
