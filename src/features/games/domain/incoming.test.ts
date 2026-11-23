import { afterEach, describe, expect, it } from 'vitest'
import { beatOutcome, clearIncoming, holdIncoming, INCOMING_LIFE_MS, peekIncoming } from './incoming'
import type { SharedGame } from './share'

const shared = { game: 'binairo' } as unknown as SharedGame

describe('incoming puzzle', () => {
  afterEach(clearIncoming)
  it('is for one game, can be read twice, and expires', () => {
    holdIncoming('binairo', shared, 'start', 1000)
    expect(peekIncoming('sudoku', 1000)).toBeNull()
    expect(peekIncoming('binairo', 1500)?.mode).toBe('start')
    expect(peekIncoming('binairo', 1600)).not.toBeNull()
    expect(peekIncoming('binairo', 1000 + INCOMING_LIFE_MS + 1)).toBeNull()
  })
  it('is gone once cleared', () => {
    holdIncoming('binairo', shared, 'current', 5)
    clearIncoming()
    expect(peekIncoming('binairo', 6)).toBeNull()
  })
})

describe('beatOutcome', () => {
  it('says won, tied or missed with the gap', () => {
    expect(beatOutcome(500, 552)).toEqual({ result: 'won', gap: 52 })
    expect(beatOutcome(552, 552)).toEqual({ result: 'tied', gap: 0 })
    expect(beatOutcome(600, 552)).toEqual({ result: 'missed', gap: 48 })
  })
  it('says nothing without a time to beat or a clock that ran', () => {
    expect(beatOutcome(500, undefined)).toBeNull()
    expect(beatOutcome(0, 552)).toBeNull()
    expect(beatOutcome(Number.NaN, 552)).toBeNull()
  })
})
