import { describe, expect, it } from 'vitest'
import { POSES } from '../../../shared/art/manifest'
import { EXPLORER_KINDS } from '../domain/types'
import { EXPLORER_POSE, venuePose } from './venueArt'

describe('venue art', () => {
  it('gives every Explorer a pose that exists', () => {
    for (const k of EXPLORER_KINDS) expect(Object.keys(POSES)).toContain(EXPLORER_POSE[k])
  })
  it('picks the pose of the place, and falls back on the Explorer', () => {
    expect(venuePose('entertainment', 'casino')).toBe('casino')
    expect(venuePose('dining', 'bar')).toBe('bar')
    expect(venuePose('exercise', 'pool', 'Lap Pool')).toBe('poolside')
    expect(venuePose('entertainment', 'music', 'Crooners')).toBe('dancing')
    expect(venuePose('dining', 'main', 'Horizon Court')).toBe('dining')
    expect(venuePose('spa', 'spa')).toBe('spa')
  })
})
