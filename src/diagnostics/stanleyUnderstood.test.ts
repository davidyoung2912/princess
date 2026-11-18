import { describe, expect, it } from 'vitest'
import { MAX_UNDERSTOOD, readUnderstood, recordUnderstood, UNDERSTOOD_KEY } from './stanleyUnderstood'

const fake = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) } } }

describe('understanding counts', () => {
  it('counts outcomes, topics and pills, and nothing else', () => {
    const s = fake()
    recordUnderstood(s, ['outcome:confident', 'topic:spa', 'pill:spa.book'])
    recordUnderstood(s, ['outcome:confident', 'where is my wallet 1234', 'topic:<script>'])
    expect(readUnderstood(s)).toEqual({ 'outcome:confident': 2, 'topic:spa': 1, 'pill:spa.book': 1 })
  })
  it('survives unreadable storage and a missing store', () => {
    const s = fake()
    s.setItem(UNDERSTOOD_KEY, '{nope')
    expect(readUnderstood(s)).toEqual({})
    expect(() => recordUnderstood(null, ['outcome:miss'])).not.toThrow()
  })
  it('keeps a bounded number of keys', () => {
    const s = fake()
    for (let i = 0; i < MAX_UNDERSTOOD + 20; i++) recordUnderstood(s, [`topic:t${i}`])
    expect(Object.keys(readUnderstood(s)).length).toBeLessThanOrEqual(MAX_UNDERSTOOD)
  })
})
