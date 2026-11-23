import { describe, expect, it } from 'vitest'
import { readFlag, readInt, readText, sameParams, withParams } from './urlState'

describe('url state', () => {
  it('sets, removes and keeps other keys', () => {
    const next = withParams(new URLSearchParams('type=Vegan&q=old'), { q: 'sushi', easy: true, type: null, family: false, age: 7 })
    expect(next.toString()).toBe('q=sushi&easy=1&age=7')
  })
  it('drops empty text', () => { expect(withParams(new URLSearchParams('q=x'), { q: '' }).toString()).toBe('') })
  it('compares queries without regard to order', () => {
    expect(sameParams(new URLSearchParams('a=1&b=2'), new URLSearchParams('b=2&a=1'))).toBe(true)
    expect(sameParams(new URLSearchParams('a=1'), new URLSearchParams('a=1&b=2'))).toBe(false)
  })
  it('reads flags, integers and text defensively', () => {
    const p = new URLSearchParams('on=1&day=4&bad=-3&huge=99999&q=' + 'x'.repeat(200))
    expect(readFlag(p, 'on')).toBe(true)
    expect(readFlag(p, 'off')).toBe(false)
    expect(readInt(p, 'day', 1, 1, 7)).toBe(4)
    expect(readInt(p, 'bad', 2, 1, 7)).toBe(2)
    expect(readInt(p, 'huge', 2, 1, 7)).toBe(2)
    expect(readInt(p, 'none', 3, 1, 7)).toBe(3)
    expect(readText(p, 'q')).toHaveLength(80)
  })
})
