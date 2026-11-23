import { describe, expect, it } from 'vitest'
import { HOME_ART, homeArt, tabArt } from './pageArt'

describe('homeArt', () => {
  it('draws from the six cheerful pictures', () => {
    expect(HOME_ART).toHaveLength(6)
    for (const r of [0, 0.2, 0.5, 0.99]) expect(HOME_ART).toContainEqual(homeArt(undefined, r))
  })
  it('never repeats the pose the first card already shows', () => {
    for (let i = 0; i < 20; i++) expect(homeArt('wave', i / 20).pose).not.toBe('wave')
    expect(homeArt('cheer', 0.999)).toEqual({ head: 'sunglasses' })
  })
  it('reaches every picture across the range', () => {
    expect(new Set([0, 0.17, 0.34, 0.5, 0.67, 0.84].map((r) => JSON.stringify(homeArt(undefined, r)))).size).toBe(6)
  })
})

describe('tabArt', () => {
  it('has a picture for a tab and none for an unknown one', () => {
    expect(tabArt('plan')).toEqual({ head: 'planning' })
    expect(tabArt('nothing')).toBeUndefined()
  })
})

describe('pageArt', () => {
  it('gives a detail page the picture of its list page', async () => {
    const { pageArt } = await import('./pageArt')
    expect(pageArt('/shopping-today')).toEqual({ pose: 'shopping' })
    expect(pageArt('/shopping-today/:venueId')).toEqual({ pose: 'shopping' })
    expect(pageArt('/games-explorer/sudoku')).toEqual({ head: 'gaming' })
    expect(pageArt('/nautical/glossary')).toEqual({ head: 'captain' })
  })
})
