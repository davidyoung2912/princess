import { describe, expect, it } from 'vitest'
import { canSwitch, countRows, normalizeConsent, normalizePermissions, rowsOf } from './stanleyPermissions'

const level = (id: number, over: Record<string, unknown> = {}) => ({ id, name: `L${id}`, line: 'Line', available: id < 3, ...over })
const row = (id: string, state: string, over: Record<string, unknown> = {}) => ({ id, group: 'watching', wording: 'W', example: 'E', never: 'N', needsLevel: 2, state, ...over })
const raw = (over: Record<string, unknown> = {}) => ({ level: 2, effectiveLevel: 2, voiceLimited: false, childLimited: false, paused: false, pausedUntil: null, levels: [level(1), level(2), level(3), level(4)], rows: [row('CL-01', 'soon'), row('CL-02', 'on'), row('CL-03', 'off')], ...over })

describe('normalizePermissions', () => {
  it('reads a well-formed reply', () => {
    const p = normalizePermissions(raw())
    expect(p?.levels.map((l) => l.available)).toEqual([true, true, false, false])
    expect(p?.rows).toHaveLength(3)
  })
  it('drops rows and levels that are not in the agreed shape', () => {
    const p = normalizePermissions(raw({ rows: [row('CL-02', 'on'), row('', 'on'), row('CL-03', 'maybe'), 'x'], levels: [level(1), level(9), level(2, { name: '' })] }))
    expect(p?.rows.map((r) => r.id)).toEqual(['CL-02'])
    expect(p?.levels.map((l) => l.id)).toEqual([1])
  })
  it('ignores a reply that is not the permissions', () => {
    expect(normalizePermissions(null)).toBeNull()
    expect(normalizePermissions(raw({ levels: [] }))).toBeNull()
    expect(normalizePermissions({ level: 'x' })).toBeNull()
  })
})

describe('helpers', () => {
  const p = normalizePermissions(raw({ rows: [row('CL-01', 'soon'), row('CL-02', 'on'), row('CL-03', 'off'), row('CL-05', 'needsLevel', { group: 'preparing', needsLevel: 3 })] }))!
  it('groups rows in the server order', () => expect(rowsOf(p, 'watching').map((r) => r.id)).toEqual(['CL-01', 'CL-02', 'CL-03']))
  it('lets only an existing, reachable row be switched', () => expect(p.rows.map(canSwitch)).toEqual([false, true, true, false]))
  it('counts what is on and off and leaves coming rows out of both', () => expect(countRows(p)).toEqual({ on: 1, off: 2, soon: 1 }))
})

describe('normalizeConsent', () => {
  it('keeps well-formed lines only', () => {
    expect(normalizeConsent([{ ability: 'level', state: '1', source: 'welcome', at: 5 }, { ability: 'x' }, 3])).toEqual([{ ability: 'level', state: '1', source: 'welcome', at: 5 }])
    expect(normalizeConsent('no')).toEqual([])
  })
})
