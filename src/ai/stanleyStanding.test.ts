import { describe, expect, it } from 'vitest'
import { normalizeControlResult, normalizeProposal, normalizeStanding, ruleBody, ruleReady } from './stanleyStanding'

const base = { enabled: true, hasTrip: true }

describe('normalizeStanding', () => {
  it('rejects anything that is not the agreed shape', () => {
    expect(normalizeStanding(null)).toBeNull()
    expect(normalizeStanding({ enabled: true })).toBeNull()
  })
  it('drops items with an unknown kind and strips routes that leave the app', () => {
    const r = normalizeStanding({ ...base, items: [
      { id: 'a', title: 'T', kind: 'prepared', route: '/plan/dining' },
      { id: 'b', title: 'T', kind: 'booked', route: '/x' },
      { id: 'c', title: 'T', kind: 'notice', route: 'https://evil.example' },
      { id: 'd', title: 'T', kind: 'notice', route: '//evil.example' },
    ] })!
    expect(r.items.map((x) => [x.id, x.route])).toEqual([['a', '/plan/dining'], ['c', ''], ['d', '']])
  })
  it('keeps only rules with a known state and templates with a known parameter', () => {
    const r = normalizeStanding({ ...base, rules: [{ id: 'a', template: 'RUL-03', state: 'on' }, { id: 'b', template: 'RUL-03', state: 'booked' }], templates: [{ id: 'RUL-03', wording: 'W', param: 'none' }, { id: 'X', wording: 'W', param: 'sql' }] })!
    expect(r.rules.map((x) => x.id)).toEqual(['a'])
    expect(r.templates.map((x) => x.id)).toEqual(['RUL-03'])
  })
  it('keeps counts as safe whole numbers and the dinner times as clock times', () => {
    const r = normalizeStanding({ ...base, rolled: -2, nights: 7.9, times: ['19:00', 'late'] })!
    expect([r.rolled, r.nights, r.times]).toEqual([0, 7, ['19:00']])
  })
})

describe('plain-words control', () => {
  it('reads a proposal and a result', () => {
    expect(normalizeProposal({ understood: 'yes' })).toBeNull()
    const p = normalizeProposal({ understood: true, id: 'pause-today', label: 'L', detail: 'D', needsConfirm: true, route: '/me/stanley-can', examples: ['a', 3] })!
    expect([p.needsConfirm, p.route, p.examples]).toEqual([true, '/me/stanley-can', ['a']])
    expect(normalizeControlResult({ applied: true, message: 'Done', route: 'http://x' })!.route).toBeNull()
  })
})

describe('the rule form', () => {
  const f = { target: 'crown', day: '3', time: '', practice: true }
  it('sends only what the template takes', () => {
    expect(ruleBody('none', 'RUL-03', f)).toEqual({ template: 'RUL-03', practice: true })
    expect(ruleBody('table', 'RUL-05', f)).toEqual({ template: 'RUL-05', practice: true, target: 'crown', day: 3 })
    expect(ruleBody('tour', 'VAL-03', f)).toEqual({ template: 'VAL-03', practice: true, target: 'crown' })
  })
  it('is ready only when its fields are filled', () => {
    expect(ruleReady('table', { target: '', day: '3', time: '' })).toBe(false)
    expect(ruleReady('day', { target: '', day: '0', time: '' })).toBe(false)
    expect(ruleReady('time', { target: '', day: '', time: '20:00' })).toBe(true)
    expect(ruleReady('none', { target: '', day: '', time: '' })).toBe(true)
  })
})
