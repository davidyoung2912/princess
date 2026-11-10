import { describe, expect, it } from 'vitest'
import { normalizePoll, normalizePolls, pollResultText, splitChoices, takesAnswers } from './stanleyPolls'

const status = { state: 'open', answered: 1, silent: 1, tally: [{ id: 'o1', label: 'Beach', yes: 1, maybe: 0, no: 0 }], suggestion: { kind: 'lead', optionIds: ['o1'], text: 'Beach leads.' }, reminderDue: false, reminderText: null, remains: [], controls: ['close'], note: 'n' }
const raw = { id: 'p1', question: 'Where?', options: [{ id: 'o1', label: 'Beach' }, { id: 'o2', label: 'Snorkel' }], createdAt: 1, closesAt: 5000, closed: false, mine: true, owner: 'Ann', myAnswers: { o1: 'yes', o9: 'yes', o2: 'wow' }, status }

describe('server polls', () => {
  it('reads a poll and keeps only answers to real choices', () => {
    const p = normalizePoll(raw)!
    expect(p.myAnswers).toEqual({ o1: 'yes' })
    expect(p.mine).toBe(true)
  })
  it('drops what is not a poll', () => {
    expect(normalizePoll({ id: 'x' })).toBeNull()
    expect(normalizePolls('nope')).toEqual([])
    expect(normalizePolls([raw, { bad: 1 }])).toHaveLength(1)
  })
  it('splits choices on commas and bars', () => {
    expect(splitChoices('Beach, Snorkel | Pool,, ')).toEqual(['Beach', 'Snorkel', 'Pool'])
  })
  it('takes answers only while open and before it closes', () => {
    const p = normalizePoll(raw)!
    expect(takesAnswers(p, 100)).toBe(true)
    expect(takesAnswers(p, 6000)).toBe(false)
    expect(takesAnswers({ ...p, closed: true }, 100)).toBe(false)
  })
  it('writes the result as plain text with totals only', () => {
    const text = pollResultText(normalizePoll(raw)!, (l, y, m, n) => `${l}: ${y}/${m}/${n}`)
    expect(text).toBe('Where?\n- Beach: 1/0/0\n- Snorkel: 0/0/0\nBeach leads.')
  })
})
