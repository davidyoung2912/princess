import { describe, expect, it } from 'vitest'
import { addNote, EMPTY_PARTY } from '../domain/party'
import { loadParty, partyKeyFor, saveParty } from './store'

const fake = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
}

describe('party storage', () => {
  it('keeps each booking apart and round-trips', () => {
    const s = fake()
    const state = addNote(EMPTY_PARTY, 'gerald', 'hi', 1, 'n').state
    expect(saveParty('gerald', state, s)).toBe(true)
    expect(loadParty('gerald', s)).toEqual(state)
    expect(loadParty('maria', s)).toEqual(EMPTY_PARTY)
    expect(partyKeyFor('gerald').startsWith('princess:')).toBe(true)
  })
  it('survives broken or missing storage', () => {
    expect(loadParty('g', { getItem: () => '{oops' })).toEqual(EMPTY_PARTY)
    expect(loadParty('g', null)).toEqual(EMPTY_PARTY)
    expect(saveParty('g', EMPTY_PARTY, { setItem: () => { throw new Error('full') } })).toBe(false)
  })
})
