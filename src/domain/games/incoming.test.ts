import { afterEach, describe, expect, it } from 'vitest'
import { clearIncoming, holdIncoming, INCOMING_LIFE_MS, peekIncoming } from './incoming'
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
