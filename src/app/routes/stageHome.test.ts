import { describe, expect, it } from 'vitest'
import { stageTiles, ABOARD_STAGES, REMEMBER_STAGES, TILE_STAGES, TRIP_STAGES } from './stageHome'

describe('stage Home', () => {
  it('gives six tiles, each with an address, at every rebuilt stage', () => {
    for (const s of TILE_STAGES) expect(stageTiles(s, { sailingId: 'x', draftId: 'd1' })).toHaveLength(6)
    expect(stageTiles('book', { sailingId: null, draftId: null }).every((x) => !x.to.includes(':'))).toBe(true)
  })
  it('gives six tiles at every other stage with its own Home', () => {
    for (const s of [...TRIP_STAGES, ...ABOARD_STAGES, ...REMEMBER_STAGES]) expect(stageTiles(s, { sailingId: 'x', draftId: null }), s).toHaveLength(6)
  })
})
