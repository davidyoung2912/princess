import { describe, expect, it } from 'vitest'
import { dndActive, dndChoices, dndRecheckIn } from './chatDnd'

describe('do not disturb', () => {
  it('is on only before its end, so it ends by itself', () => {
    expect(dndActive(2000, 1000)).toBe(true)
    expect(dndActive(1000, 1000)).toBe(false)
    expect(dndActive(0, 1000)).toBe(false)
  })
  it('says when to look again, and never for an ended or unset one', () => {
    expect(dndRecheckIn(5000, 1000)).toBe(4000)
    expect(dndRecheckIn(0, 1000)).toBeNull()
    expect(dndRecheckIn(900, 1000)).toBeNull()
  })
  it('offers off when on, and an hour or until morning when off', () => {
    expect(dndChoices(true)).toEqual(['off'])
    expect(dndChoices(false)).toEqual(['hour', 'morning'])
  })
})
