import { describe, expect, it } from 'vitest'
import { canReach, MAX_REMEMBERED, recallScroll, rememberScroll, scrollTarget, SCROLL_KEY } from './scrollMemory'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), raw: m }
}

describe('scroll memory', () => {
  it('remembers a position per history entry', () => {
    const s = memory()
    rememberScroll(s, 'a', 420)
    rememberScroll(s, 'b', 10)
    expect(recallScroll(s, 'a')).toBe(420)
    expect(recallScroll(s, 'b')).toBe(10)
    expect(recallScroll(s, 'c')).toBeNull()
  })
  it('restores on Back and starts at the top for a new visit', () => {
    const s = memory()
    rememberScroll(s, 'list', 900)
    expect(scrollTarget(s, 'list', 'POP')).toBe(900)
    expect(scrollTarget(s, 'list', 'PUSH')).toBe(0)
    expect(scrollTarget(s, 'list', 'REPLACE')).toBe(0)
    expect(scrollTarget(s, 'never', 'POP')).toBe(0)
  })
  it('keeps the newest entries when over the cap', () => {
    const s = memory()
    for (let i = 0; i < MAX_REMEMBERED + 5; i++) rememberScroll(s, `k${i}`, i)
    expect(recallScroll(s, 'k0')).toBeNull()
    expect(recallScroll(s, `k${MAX_REMEMBERED + 4}`)).toBe(MAX_REMEMBERED + 4)
  })
  it('ignores bad input and damaged storage', () => {
    const s = memory()
    rememberScroll(s, '', 5)
    rememberScroll(s, 'x', -1)
    rememberScroll(s, 'x', Number.NaN)
    expect(recallScroll(s, 'x')).toBeNull()
    s.raw.set(SCROLL_KEY, '{"a":"high","b":7}')
    expect(recallScroll(s, 'a')).toBeNull()
    expect(recallScroll(s, 'b')).toBe(7)
    s.raw.set(SCROLL_KEY, 'not json')
    expect(recallScroll(s, 'b')).toBeNull()
    expect(recallScroll(null, 'b')).toBeNull()
  })
  it('knows when a page is tall enough yet', () => {
    expect(canReach(500, 2000, 800)).toBe(true)
    expect(canReach(1500, 2000, 800)).toBe(false)
    expect(canReach(0, 100, 800)).toBe(true)
  })
})
