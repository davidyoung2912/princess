import { describe, expect, it } from 'vitest'
import { EMPTY_MEMORY, loadMemory, memoryKeyFor, normalizeMemory, restOf, saveMemory } from './store'

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }

describe('memory store', () => {
  it('starts empty with drinks and anniversaries off, keeps people apart and survives corrupt storage', () => {
    const s = memory()
    expect(EMPTY_MEMORY.drinks).toBeNull()
    expect(EMPTY_MEMORY.anniversary).toBe(false)
    expect(saveMemory('a', normalizeMemory({ anniversary: true, journal: { 2: 'hi' } }), s)).toBe(true)
    expect(loadMemory('a', s).journal[2]).toBe('hi')
    expect(loadMemory('b', s)).toEqual(EMPTY_MEMORY)
    expect(memoryKeyFor('a')).not.toBe(memoryKeyFor('b'))
    expect(loadMemory('a', { getItem: () => '{nope' })).toEqual(EMPTY_MEMORY)
  })
  it('drops what is malformed', () => {
    const m = normalizeMemory({
      journal: { 0: 'x', 9: 'x', 3: '  ', 4: 'ok', z: 'x' },
      reflections: [{ id: 'a', topic: 'cabin', text: 'ok', shared: true }, { id: 'b', topic: 'zzz', text: 'x' }, { id: 'c', topic: 'port', text: ' ' }],
      contacts: [{ id: 'a', name: 'Sam', consent: true, reply: 'accepted' }, { id: 'b', name: 'No consent', consent: false }, { id: 'c', name: '', consent: true }],
      drinks: -4, budget: 'lots', fit: ['tenders', 'bogus'], use: { drinks: 99999 },
    })
    expect(Object.keys(m.journal)).toEqual(['4'])
    expect(m.reflections).toHaveLength(1)
    expect(m.contacts.map((c) => c.name)).toEqual(['Sam'])
    expect(m.drinks).toBeNull()
    expect(m.budget).toBeNull()
    expect(m.fit).toEqual(['tenders'])
    expect(m.use.drinks).toBe(999)
  })

  it('has one trip budget: the older copy kept under planning is taken when there is no other', () => {
    expect(normalizeMemory({ planning: { budget: 300000 } }).budget).toBe(300000)
    expect(normalizeMemory({ budget: 200000, planning: { budget: 300000 } }).budget).toBe(200000)
    expect(normalizeMemory({ planning: { budget: -5 } }).budget).toBeNull()
  })
})

describe('away-from-home checklist state (S3-11)', () => {
  it('keeps only known ticked ids and clean own items, at most ten', () => {
    const m = normalizeMemory({ away: ['pets', 'nope', 7], awayExtras: [{ id: 'a', text: '  Feed  fish ', done: true }, { id: 'b', text: '   ' }, { text: 'no id' }, ...Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, text: 'x' }))] })
    expect(m.away).toEqual(['pets'])
    expect(m.awayExtras[0]).toEqual({ id: 'a', text: 'Feed fish', done: true })
    expect(m.awayExtras).toHaveLength(10)
  })
})

describe('medical card state (S3-05)', () => {
  it('is kept clean and defaults to empty', () => {
    expect(normalizeMemory({}).medical.allergies).toEqual([])
    expect(normalizeMemory({ medical: { allergies: [' Nuts ', 5] } }).medical.allergies).toEqual(['Nuts'])
  })
  it('carries the plan polish in the synced memory document, so it follows the guest between devices (DL4)', () => {
    const polish = { rest: [{ day: 2, part: 'morning' as const }], notes: { t1: 'window table' }, colours: { a: 1 }, occasions: [{ id: 'o', label: 'Birthday', date: '2015-03-22', surprise: true }] }
    const doc = JSON.parse(JSON.stringify(restOf({ ...EMPTY_MEMORY, polish })))
    expect(normalizeMemory(doc).polish).toEqual(polish)
  })
})
