import { describe, expect, it } from 'vitest'
import { EMPTY_MEMORY, loadMemory, memoryKeyFor, normalizeMemory, saveMemory } from './store'

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
})
