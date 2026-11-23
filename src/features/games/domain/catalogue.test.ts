import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../../app/routes/routes'
import { GAMES, gamesOf } from './catalogue'

describe('games catalogue', () => {
  it('gives every game its own route under the Games Explorer, with no repeats', () => {
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(GAMES.length)
    for (const g of GAMES) {
      expect(g.path.startsWith('/games-explorer/')).toBe(true)
      expect(ROUTES.some((r) => r.path === g.path), g.path).toBe(true)
    }
  })
  it('splits by mode', () => {
    expect(gamesOf('single').map((g) => g.id)).toContain('cruise-wordle')
    expect(gamesOf('multi')).toEqual([])
  })
})
