import { describe, expect, it } from 'vitest'
import * as guards from './guards'

const checks = Object.entries(guards).filter(([name, fn]) => name.startsWith('as') && typeof fn === 'function') as [string, (raw: unknown) => unknown][]

describe('response guards', () => {
  it('has a guard for each view the screens read', () => {
    expect(checks.length).toBeGreaterThanOrEqual(24)
  })
  for (const [name, guard] of checks) {
    it(`${name} gives null, not a crash, for something that is not a response`, () => {
      for (const bad of [null, undefined, 42, 'text', true]) expect(guard(bad), String(bad)).toBeNull()
    })
    it(`${name} never throws on arrays or empty objects`, () => {
      expect(() => guard([])).not.toThrow()
      expect(() => guard({})).not.toThrow()
      expect(() => guard({ days: 'x', items: 3, lines: {} })).not.toThrow()
    })
  }
})
