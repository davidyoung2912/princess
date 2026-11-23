import { describe, expect, it } from 'vitest'
import { clock12, normalizeBundle, normalizeDraft } from './stanleyBundle'

const step = (id: string, route = '/plan/dining', start = '18:30') => ({ id, start, minutes: 90, kind: 'dinner', title: id, status: 'suggested', why: 'w', route })
const bundle = (steps: unknown[]) => ({ hasPlan: true, scope: 'evening', pace: 'balanced', day: 2, port: 'sea', backBy: null, steps, clashes: ['x', 4], notChecked: ['n'] })

describe('normalizeBundle', () => {
  it('rejects a wrong shape or an unknown scope or pace', () => {
    expect(normalizeBundle(null)).toBeNull()
    expect(normalizeBundle({ ...bundle([]), scope: 'week' })).toBeNull()
    expect(normalizeBundle({ ...bundle([]), pace: 'frantic' })).toBeNull()
  })

  it('keeps the server order and drops a step that leaves the app or has no time', () => {
    const b = normalizeBundle(bundle([step('a'), step('b', 'https://evil.example/x'), step('c', '//evil.example'), step('d', '/plan', 'soon'), step('e', '/plan', '20:00')]))
    expect(b?.steps.map((s) => s.id)).toEqual(['a', 'e'])
    expect(b?.clashes).toEqual(['x'])
  })

  it('has no plan when no step survives', () => {
    expect(normalizeBundle(bundle([step('b', 'https://evil.example')]))?.hasPlan).toBe(false)
  })
})

describe('normalizeDraft', () => {
  it('needs a known kind and some text', () => {
    expect(normalizeDraft(null)).toBeNull()
    expect(normalizeDraft({ kind: 'send-now', text: 'hi', inputs: [] })).toBeNull()
    expect(normalizeDraft({ kind: 'late-note', text: '', inputs: [] })).toBeNull()
    expect(normalizeDraft({ kind: 'late-note', text: 'hi', inputs: ['all aboard time'] })?.inputs).toEqual(['all aboard time'])
  })
})

describe('clock12', () => {
  it('reads times plainly', () => {
    expect(clock12('00:05')).toBe('12:05 am')
    expect(clock12('12:00')).toBe('12:00 pm')
    expect(clock12('18:30')).toBe('6:30 pm')
  })
})
