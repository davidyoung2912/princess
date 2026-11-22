import { describe, expect, it } from 'vitest'
import { STANLEY_JOKES } from '../data/stanleyJokes'
import { clearJokeDismissal, dismissJoke, jokeDismissed, pickJoke, todayLocal } from './jokeOfTheDay'

const memory = (): Storage => {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 }
}

describe('joke of the day', () => {
  it('has 150 distinct jokes', () => {
    expect(STANLEY_JOKES).toHaveLength(150)
    expect(new Set(STANLEY_JOKES).size).toBe(150)
  })
  it('picks from the list by the random number, and never past the end', () => {
    expect(pickJoke(['a', 'b', 'c'], () => 0)).toBe('a')
    expect(pickJoke(['a', 'b', 'c'], () => 0.5)).toBe('b')
    expect(pickJoke(['a', 'b', 'c'], () => 0.999999)).toBe('c')
    expect(pickJoke(['a', 'b', 'c'], () => 1)).toBe('c')
    expect(pickJoke([])).toBe('')
  })
  it('stays dismissed for the day, returns the next day, and returns at sign-out', () => {
    const s = memory()
    expect(jokeDismissed('2026-11-22', s)).toBe(false)
    dismissJoke('2026-11-22', s)
    expect(jokeDismissed('2026-11-22', s)).toBe(true)
    expect(jokeDismissed('2026-11-23', s)).toBe(false)
    clearJokeDismissal(s)
    expect(jokeDismissed('2026-11-22', s)).toBe(false)
  })
  it('works with no storage at all', () => {
    expect(jokeDismissed('2026-11-22', null)).toBe(false)
    expect(() => { dismissJoke('2026-11-22', null); clearJokeDismissal(null) }).not.toThrow()
    expect(todayLocal(new Date(2026, 10, 22, 12))).toBe('2026-11-22')
  })
})
