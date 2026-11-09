// proves: SEA-05
import { describe, expect, it } from 'vitest'
import { DIRECTORY, openAt, venueState } from './menus'

const v = DIRECTORY.find((x) => x.id === 'sabatini')!

describe('venue state', () => {
  it('is open or closed by the hours', () => {
    expect(venueState(v, 'sea', '19:00')).toBe('open')
    expect(venueState(v, 'sea', '10:00')).toBe('closed')
  })
  it('is temporarily unavailable when the ship says so, even within hours', () => {
    const shut = { ...v, unavailableSince: '2026-11-08T17:00:00Z' }
    expect(venueState(shut, 'sea', '19:00')).toBe('unavailable')
    expect(openAt(shut, 'sea', '19:00')).toBe(false)
  })
})
