import { describe, expect, it } from 'vitest'
import { FEEDBACK_KEY, MAX_FEEDBACK, readFeedback, recordFeedback } from './stanleyFeedback'

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } } }

describe('stanley feedback', () => {
  it('records and reads answers', () => {
    const s = mem()
    recordFeedback(s, 'a', true)
    recordFeedback(s, 'b', false)
    expect(readFeedback(s).map((f) => [f.id, f.helpful])).toEqual([['a', true], ['b', false]])
  })
  it('keeps the newest 100 and survives junk or no store', () => {
    const s = mem()
    for (let i = 0; i < MAX_FEEDBACK + 5; i++) recordFeedback(s, `q${i}`, true)
    expect(readFeedback(s)).toHaveLength(MAX_FEEDBACK)
    s.setItem(FEEDBACK_KEY, '{nope')
    expect(readFeedback(s)).toEqual([])
    expect(() => recordFeedback(null, 'x', true)).not.toThrow()
  })
})
