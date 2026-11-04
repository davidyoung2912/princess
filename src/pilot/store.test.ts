import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS } from '../domain/autopilot'
import { EMPTY_PILOT, loadPilot, normalizeChanges, normalizePilot, normalizePrefs, pilotKeyFor, savePilot } from './store'

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }
const change = { id: 'c1', day: 2, source: 'assistant', cause: 'You asked', title: 'Move dinner', why: 'x', edits: [{ op: 'move', id: 'dinner', to: '20:00' }], status: 'accepted', proposedAt: 1, undoUntil: 9, decidedAt: 2 }

describe('pilot store', () => {
  it('starts empty, keeps people apart and survives corrupt storage', () => {
    const s = memory()
    expect(loadPilot('a', s)).toEqual(EMPTY_PILOT)
    expect(savePilot('a', normalizePilot({ gentle: true, changes: [change] }), s)).toBe(true)
    expect(loadPilot('a', s).gentle).toBe(true)
    expect(loadPilot('a', s).changes).toHaveLength(1)
    expect(loadPilot('b', s)).toEqual(EMPTY_PILOT)
    expect(pilotKeyFor('a')).not.toBe(pilotKeyFor('b'))
    expect(loadPilot('a', { getItem: () => '{nope' })).toEqual(EMPTY_PILOT)
  })

  it('drops changes that are malformed rather than trusting them', () => {
    expect(normalizeChanges('x')).toEqual([])
    expect(normalizeChanges([change, { ...change, status: 'weird' }, { ...change, source: 'someone' }, { ...change, day: 42 }, { ...change, edits: [{ op: 'move', id: 'a', to: '25:00' }] }, { ...change, edits: [{ op: 'nope' }] }, null])).toHaveLength(1)
    expect(normalizeChanges([{ ...change, edits: [{ op: 'add', entry: { id: 'x', title: 'X', start: '10:00', minutes: 30, kind: 'added', path: 'http://evil' } }] }])[0].edits[0]).toMatchObject({ op: 'add', entry: { path: '/plan', outdoor: false } })
  })

  it('reads week preferences with safe defaults', () => {
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS)
    expect(normalizePrefs({ pace: 'packed', mobility: 'wheelchair', tours: ['water', 'zzz'], maxTour: -5, noEarly: true })).toMatchObject({ pace: 'packed', mobility: 'wheelchair', tours: ['water'], maxTour: null, noEarly: true })
  })
})
