import { describe, expect, it } from 'vitest'
import { addDebrief, requestCallback } from '../domain/disruptionHub'
import { reportDelay, EMPTY_DELAY } from '../domain/delay'
import { addContact, EMPTY_HOME } from '../domain/homeLink'
import { EMPTY_HUB, hubKeyFor, loadHub, normalizeHub, saveHub } from './store'

const fake = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
}

describe('hub storage', () => {
  it('keeps each person apart and round-trips', () => {
    const s = fake()
    const state = {
      home: addContact(EMPTY_HOME, 'Ann', 'ann@example.com', 'c1').state,
      delay: reportDelay(EMPTY_DELAY, { reason: 'flight', lateMinutes: 60, note: '', tellParty: false }, 1, 'd'),
      callback: requestCallback(1, 'other', 1, 'cb'),
      debriefs: addDebrief([], 'illness', 'good', '', 1),
    }
    expect(saveHub('gerald', state, s)).toBe(true)
    expect(loadHub('gerald', s)).toEqual(state)
    expect(loadHub('maria', s)).toEqual(EMPTY_HUB)
    expect(hubKeyFor('gerald').startsWith('princess:')).toBe(true)
  })
  it('survives broken or missing storage', () => {
    expect(loadHub('g', { getItem: () => '{oops' })).toEqual(EMPTY_HUB)
    expect(loadHub('g', null)).toEqual(EMPTY_HUB)
    expect(saveHub('g', EMPTY_HUB, { setItem: () => { throw new Error('full') } })).toBe(false)
    expect(normalizeHub(42)).toEqual(EMPTY_HUB)
  })
})
