import { describe, expect, it } from 'vitest'
import { ROUTES } from './routes/routes'
import { SCREENS } from './screens'

describe('screens', () => {
  it('has a screen for every route, so the app needs no stand-in page', () => {
    expect(ROUTES.filter((r) => !SCREENS[r.path]).map((r) => r.path)).toEqual([])
  })
})
