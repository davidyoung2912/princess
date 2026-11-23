import { describe, expect, it } from 'vitest'
import { dismissTipIn, EMPTY_HINTS, markTourIn, mergeHints, normalizeHints, resetTipsIn, resetTourIn } from './hintsState'

describe('hints kept on the account', () => {
  it('reads a served document defensively, and nothing readable is the empty object', () => {
    expect(normalizeHints(null)).toBe(EMPTY_HINTS)
    expect(normalizeHints({ tips: [], tour: 'x' })).toBe(EMPTY_HINTS)
    expect(normalizeHints({ tips: { H02: 2, 'bad id': 1, H03: 0, H04: 'x', H05: 1.9 }, tour: ['date', 5, 'bad id', 'date'] })).toEqual({ tips: { H02: 2, H05: 1 }, tour: ['date'], tourOn: true })
  })
  it('dismisses a page tip up to the number it has, and changes nothing at the end', () => {
    const one = dismissTipIn(EMPTY_HINTS, 'H02', 3)
    expect(one.tips).toEqual({ H02: 1 })
    const three = dismissTipIn(dismissTipIn(one, 'H02', 3), 'H02', 3)
    expect(three.tips.H02).toBe(3)
    expect(dismissTipIn(three, 'H02', 3)).toBe(three)
    expect(dismissTipIn(EMPTY_HINTS, 'H02', 0)).toBe(EMPTY_HINTS)
  })
  it('marks tour steps once, and the two resets are separate', () => {
    const h = markTourIn(dismissTipIn(EMPTY_HINTS, 'H02', 2), ['date', 'chat'])
    expect(markTourIn(h, ['date'])).toBe(h)
    expect(resetTipsIn(h)).toEqual({ tips: {}, tour: ['date', 'chat'], tourOn: true })
    expect(resetTourIn(h)).toEqual({ tips: { H02: 1 }, tour: [], tourOn: true })
    expect(resetTourIn(resetTourIn(h))).toEqual({ tips: { H02: 1 }, tour: [], tourOn: true })
  })
  it('keeps every dismissal from both devices when they clash', () => {
    const merged = mergeHints({ tips: { H02: 1, H03: 2 }, tour: ['date'] }, { tips: { H02: 3 }, tour: ['chat', 'date'] })
    expect(merged).toEqual({ tips: { H02: 3, H03: 2 }, tour: ['date', 'chat'], tourOn: true })
  })
})
