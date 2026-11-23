import { describe, expect, it } from 'vitest'
import { readDraft, saveDraft } from './chatDrafts'

const memory = () => {
  const data = new Map<string, string>()
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) }
}

describe('chat drafts', () => {
  it('keeps a draft per person and conversation', () => {
    const s = memory()
    saveDraft(s, 'me', 'c1', 'half a thought')
    saveDraft(s, 'me', 'c2', 'another')
    saveDraft(s, 'you', 'c1', 'not mine')
    expect(readDraft(s, 'me', 'c1')).toBe('half a thought')
    expect(readDraft(s, 'me', 'c2')).toBe('another')
    expect(readDraft(s, 'you', 'c1')).toBe('not mine')
    expect(readDraft(s, 'me', 'c3')).toBe('')
  })

  it('leaves nothing behind once the box is empty or blank', () => {
    const s = memory()
    saveDraft(s, 'me', 'c1', 'text')
    saveDraft(s, 'me', 'c1', '   ')
    expect(s.data.size).toBe(0)
    expect(readDraft(s, 'me', 'c1')).toBe('')
  })

  it('works without storage and survives a storage that throws', () => {
    expect(readDraft(null, 'me', 'c1')).toBe('')
    expect(() => saveDraft(null, 'me', 'c1', 'x')).not.toThrow()
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') }, removeItem: () => { throw new Error('blocked') } }
    expect(readDraft(broken, 'me', 'c1')).toBe('')
    expect(() => saveDraft(broken, 'me', 'c1', 'x')).not.toThrow()
    expect(() => saveDraft(broken, 'me', 'c1', '')).not.toThrow()
  })
})
