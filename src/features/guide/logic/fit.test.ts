import { describe, expect, it } from 'vitest'
import { answerFit, answerOne, ASK_AT, EMPTY_FIT, fitAnswered, mergeFit, nextQuestion, normalizeFit } from './fit'

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

  it('asks one question at its own stage, never up front, and only until it is answered', () => {
    expect(nextQuestion(EMPTY_FIT, 'dream')).toBeNull()
    expect(nextQuestion(EMPTY_FIT, 'discover')).toBeNull()
    expect(nextQuestion(EMPTY_FIT, ASK_AT.firstCruise)).toBe('firstCruise')
    expect(nextQuestion(EMPTY_FIT, ASK_AT.solo)).toBe('solo')
    expect(nextQuestion(EMPTY_FIT, ASK_AT.quiet)).toBe('quiet')
    expect(nextQuestion({ firstCruise: false }, ASK_AT.firstCruise)).toBeNull()
  })

  it('keeps the other answers when one is given', () => {
    const one = answerOne({ solo: true, at: 1 }, 'firstCruise', false, 7)
    expect(one).toEqual({ solo: true, firstCruise: false, at: 7 })
  })
})
