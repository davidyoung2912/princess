import { describe, expect, it } from 'vitest'
import { addItem, addParty, EMPTY_SPLIT } from '../domain/ledgerSplit'
import { EMPTY_PORT_PARTY, setPresence } from '../domain/portParty'
import { EMPTY_PORT, loadPort, normalizePort, portKeyFor, savePort } from './store'

const fake = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
}

describe('port storage', () => {
  it('keeps each booking apart and round-trips', () => {
    const s = fake()
    let split = addParty(EMPTY_SPLIT, 'Harper', 4, 'h').state
    split = addParty(split, 'Brennan', 4, 'b').state
    split = addItem(split, { title: 'Taxi', kind: 'taxi', amount: '20', paidBy: 'h', among: ['h', 'b'], mode: 'equal', date: null }, 1, 'i').state
    const state = { party: setPresence(EMPTY_PORT_PARTY, '2027-03-23', 'daniel', 'back', 1), split }
    expect(savePort('daniel', state, s)).toBe(true)
    expect(loadPort('daniel', s)).toEqual(state)
    expect(loadPort('marcus', s)).toEqual(EMPTY_PORT)
    expect(portKeyFor('daniel').startsWith('princess:')).toBe(true)
  })

  it('survives broken or missing storage', () => {
    expect(loadPort('d', { getItem: () => '{oops' })).toEqual(EMPTY_PORT)
    expect(loadPort('d', null)).toEqual(EMPTY_PORT)
    expect(savePort('d', EMPTY_PORT, { setItem: () => { throw new Error('full') } })).toBe(false)
    expect(normalizePort(42)).toEqual(EMPTY_PORT)
  })
})
