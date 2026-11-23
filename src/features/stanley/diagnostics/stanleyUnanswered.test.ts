import { describe, expect, it } from 'vitest'
import { clearUnanswered, exportUnanswered, MAX_QUESTION_CHARS, MAX_UNANSWERED, parseUnanswered, readUnanswered, recordUnanswered, scrub, setUnansweredOn } from './stanleyUnanswered'

const fake = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) } } }

describe('unanswered questions (opt-in)', () => {
  it('keeps nothing until the guest turns it on', () => {
    const s = fake()
    recordUnanswered(s, 'where is the thing', 'miss')
    expect(readUnanswered(s)).toEqual([])
    setUnansweredOn(s, true)
    recordUnanswered(s, 'where is the thing', 'miss')
    expect(readUnanswered(s).map((q) => q.text)).toEqual(['where is the thing'])
  })
  it('turning it off forgets what was kept', () => {
    const s = fake()
    setUnansweredOn(s, true)
    recordUnanswered(s, 'a question', 'ambiguous')
    setUnansweredOn(s, false)
    expect(readUnanswered(s)).toEqual([])
    recordUnanswered(s, 'another', 'miss')
    expect(readUnanswered(s)).toEqual([])
  })
  it('blanks emails, links and numbers, and bounds the length', () => {
    expect(scrub('mail me at a.b@example.com about booking 4829173')).not.toMatch(/example|4829173/)
    expect(scrub('call +1 (555) 123-4567 or see https://x.example/y')).not.toMatch(/555|x\.example/)
    expect(scrub('deck 9 please')).toContain('deck 9')
    expect(scrub('x'.repeat(1000)).length).toBe(MAX_QUESTION_CHARS)
  })
  it('keeps nothing that scrubs to nothing, and a bounded list', () => {
    const s = fake()
    setUnansweredOn(s, true)
    recordUnanswered(s, '1234 5678', 'miss')
    expect(readUnanswered(s)).toEqual([])
    for (let i = 0; i < MAX_UNANSWERED + 10; i++) recordUnanswered(s, `question ${'a'.repeat(1 + (i % 5))}`, 'miss')
    expect(readUnanswered(s)).toHaveLength(MAX_UNANSWERED)
  })
  it('survives unreadable storage and a missing store', () => {
    const s = fake()
    s.setItem('princess:diagnostics:stanley:unanswered', '{nope')
    expect(readUnanswered(s)).toEqual([])
    expect(() => recordUnanswered(null, 'x y', 'miss')).not.toThrow()
    expect(() => clearUnanswered(null)).not.toThrow()
  })
  it('round-trips an export, and reads a plain list', () => {
    const list = [{ text: 'one', kind: 'miss' as const, at: '2026-11-17' }, { text: 'two', kind: 'ambiguous' as const, at: '2026-11-17' }]
    expect(parseUnanswered(exportUnanswered(list))).toEqual(list)
    expect(parseUnanswered('first\nsecond\n').map((q) => q.text)).toEqual(['first', 'second'])
    expect(parseUnanswered('["a b"]').map((q) => q.text)).toEqual(['a b'])
  })
})
