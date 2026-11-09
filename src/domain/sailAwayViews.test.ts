import { describe, expect, it } from 'vitest'
import { sailAwayViews } from './sailAwayViews'

describe('sail-away viewpoints (EMB-13)', () => {
  it('lists step-free spots first and keeps the step-up spot with its note', () => {
    const all = sailAwayViews({ stepFreeOnly: false })
    expect(all.length).toBeGreaterThan(2)
    expect(all.at(-1)).toMatchObject({ id: 'sun-bar', stepFree: false })
    expect(all.at(-1)?.note).toBeTruthy()
  })
  it('drops places with steps when asked', () => {
    const only = sailAwayViews({ stepFreeOnly: true })
    expect(only.every((p) => p.stepFree)).toBe(true)
    expect(only.some((p) => p.id === 'sun-bar')).toBe(false)
  })
})
