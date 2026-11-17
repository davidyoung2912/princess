import { describe, expect, it } from 'vitest'
import { explorerStage, sailsInDays, type SailingWindow } from './stage'

const DAY = 86_400_000
const w: SailingWindow = { departureAt: 100 * DAY, endAt: 108 * DAY }

describe('explorerStage', () => {
  it('is ahead before departure, aboard until the end and after once it is over', () => {
    expect(explorerStage(w, 0)).toBe('ahead')
    expect(explorerStage(w, w.departureAt - 1)).toBe('ahead')
    expect(explorerStage(w, w.departureAt)).toBe('aboard')
    expect(explorerStage(w, w.endAt - 1)).toBe('aboard')
    expect(explorerStage(w, w.endAt)).toBe('after')
  })
})

describe('sailsInDays', () => {
  it('counts whole days and rounds up', () => {
    expect(sailsInDays(w, w.departureAt - 23 * DAY)).toBe(23)
    expect(sailsInDays(w, w.departureAt - 22.5 * DAY)).toBe(23)
    expect(sailsInDays(w, w.departureAt - 1)).toBe(1)
  })
  it('is 0 once the ship has sailed', () => {
    expect(sailsInDays(w, w.departureAt)).toBe(0)
    expect(sailsInDays(w, w.endAt)).toBe(0)
  })
})
