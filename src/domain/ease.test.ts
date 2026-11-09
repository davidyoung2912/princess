import { describe, expect, it } from 'vitest'
import { ignoreKey, movePin, nextChord, searchChips } from './ease'

describe('movePin', () => {
  it('moves earlier and later', () => {
    expect(movePin(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(movePin(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b'])
  })
  it('leaves the list alone at the ends or for an unknown id', () => {
    expect(movePin(['a', 'b'], 'a', -1)).toEqual(['a', 'b'])
    expect(movePin(['a', 'b'], 'b', 1)).toEqual(['a', 'b'])
    expect(movePin(['a', 'b'], 'z', 1)).toEqual(['a', 'b'])
  })
})

describe('nextChord', () => {
  it('handles single keys', () => {
    expect(nextChord(false, '/').shortcut?.action).toBe('search')
    expect(nextChord(false, '?').shortcut?.action).toBe('help')
    expect(nextChord(false, 'x')).toEqual({ pending: false, shortcut: null })
  })
  it('waits after g and finishes the pair', () => {
    expect(nextChord(false, 'g')).toEqual({ pending: true, shortcut: null })
    expect(nextChord(true, 'h').shortcut?.to).toBe('/')
    expect(nextChord(true, 'P').shortcut?.to).toBe('/plan')
    expect(nextChord(true, 'q')).toEqual({ pending: false, shortcut: null })
  })
})

describe('ignoreKey', () => {
  const base = { key: 'g', ctrlKey: false, metaKey: false, altKey: false }
  it('ignores typing in fields and modifier keys', () => {
    expect(ignoreKey({ ...base, target: { tagName: 'INPUT' } })).toBe(true)
    expect(ignoreKey({ ...base, ctrlKey: true, target: { tagName: 'BODY' } })).toBe(true)
    expect(ignoreKey({ ...base, target: { tagName: 'BODY' } })).toBe(false)
  })
})

describe('searchChips', () => {
  it('differs aboard and ashore', () => {
    expect(searchChips(true)).toContain('muster')
    expect(searchChips(false)).toContain('check-in')
  })
})
