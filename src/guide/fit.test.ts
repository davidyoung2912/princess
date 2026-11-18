import { describe, expect, it } from 'vitest'
import { answerFit, EMPTY_FIT, fitAnswered, mergeFit, normalizeFit } from './fit'

describe('guide fit', () => {
  it('keeps only the three answers and the time', () => {
    expect(normalizeFit(null)).toBe(EMPTY_FIT)
    expect(normalizeFit({ firstCruise: true, solo: 'yes', access: true, at: 5 })).toEqual({ firstCruise: true, at: 5 })
  })

  it('is asked until answered once, and saying no still counts as answering', () => {
    expect(fitAnswered(EMPTY_FIT)).toBe(false)
    expect(fitAnswered(answerFit({ firstCruise: false, solo: false, quiet: false }, 9))).toBe(true)
  })

  it('keeps the more recent answer when two devices differ', () => {
    const old = { firstCruise: true, solo: false, quiet: false, at: 1 }
    const fresh = { firstCruise: false, solo: true, quiet: false, at: 2 }
    expect(mergeFit(old, fresh)).toEqual(fresh)
    expect(mergeFit(fresh, old)).toEqual(fresh)
    expect(mergeFit(fresh, null)).toEqual(fresh)
  })
})
