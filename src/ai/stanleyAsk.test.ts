import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import { NO_FILTER } from '../domain/cabinScore'
import { STEPS } from '../domain/booking'
import { BOOKING_WHY_STEPS, CABIN_ASKS, START, advance, answeredCount, back, cabinFilterFrom } from './stanleyAsk'

describe('Stanley asks', () => {
  it('walks forward, finishes after the last question and goes back', () => {
    let s = START
    s = advance(s, 3); expect(s).toEqual({ index: 1, done: false })
    s = advance(s, 3); expect(s).toEqual({ index: 2, done: false })
    s = advance(s, 3); expect(s).toEqual({ index: 2, done: true })
    expect(back(s)).toEqual({ index: 2, done: false })
    expect(back({ index: 1, done: false })).toEqual({ index: 0, done: false })
    expect(back(START)).toEqual(START)
  })

  it('counts answered questions, an empty choice or empty list not counting', () => {
    const qs = [{ id: 'a' }, { id: 'b', multi: true }, { id: 'c' }]
    expect(answeredCount(qs, { a: 'x', b: [], c: '' })).toBe(1)
    expect(answeredCount(qs, { a: 'x', b: ['y'] })).toBe(2)
  })

  it('turns cabin answers into filters, defaulting to rooms that can be booked', () => {
    expect(cabinFilterFrom({})).toEqual(NO_FILTER)
    expect(cabinFilterFrom({ sleep: 'yes', sea: 'no', access: 'yes', view: 'yes', booked: 'no' })).toEqual({ quiet: true, calmSea: false, accessible: true, clearView: true, availableOnly: false })
  })

  it('has words for every cabin question and every booking step, in his voice', () => {
    for (const q of CABIN_ASKS) for (const k of [`stanley.ask.cabin.${q.id}`, `stanley.ask.cabin.${q.id}.why`]) expect(k in en, k).toBe(true)
    expect([...BOOKING_WHY_STEPS]).toEqual(STEPS.filter((x) => x !== 'pay'))
    for (const step of BOOKING_WHY_STEPS) {
      const text = (en as Record<string, string>)[`stanley.why.${step}`]
      expect(text, step).toBeTruthy()
      expect(text.length, step).toBeLessThanOrEqual(160)
      expect(text, step).not.toMatch(/!/)
    }
  })
})
