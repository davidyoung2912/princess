import { describe, expect, it } from 'vitest'
import { SCREEN_BY_ID } from '../routes/screens'
import { SCREEN_ICONS } from './screenIcons'

describe('screen icons', () => {
  it('are only for screens in the registry', () => {
    expect(Object.keys(SCREEN_ICONS).filter((id) => !SCREEN_BY_ID.has(id))).toEqual([])
  })

  it('cover almost every screen; the rest fall back to their tab icon', () => {
    const without = [...SCREEN_BY_ID.keys()].filter((id) => !SCREEN_ICONS[id])
    expect(without.length).toBeLessThan(5)
  })
})
