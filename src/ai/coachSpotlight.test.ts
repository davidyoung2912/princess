import { describe, expect, it } from 'vitest'
import { COACH_STEPS, COACH_SCREENS } from './stanleyMoments'
import { COACH_TARGETS, findCoachTarget, holeBox, notePlacement } from './coachSpotlight'

describe('coach spotlight', () => {
  it('has a target for every step of every tour', () => {
    for (const id of COACH_SCREENS) expect(COACH_TARGETS[id]).toHaveLength(COACH_STEPS[id])
  })
  it('grows the hole by the padding and keeps it on screen', () => {
    expect(holeBox({ top: 100, left: 20, width: 200, height: 50 }, 8, 400, 800)).toEqual({ top: 92, left: 12, width: 216, height: 66 })
    expect(holeBox({ top: 2, left: 2, width: 500, height: 50 }, 8, 400, 800)).toEqual({ top: 0, left: 0, width: 400, height: 60 })
  })
  it('puts the note where it does not cover the target', () => {
    const box = { top: 100, left: 0, width: 100, height: 100 }
    expect(notePlacement(box, 800, 200)).toBe('below')
    expect(notePlacement({ ...box, top: 600 }, 800, 200)).toBe('above')
    expect(notePlacement({ ...box, top: 100, height: 600 }, 800, 300)).toBe('bottom')
    expect(notePlacement(null, 800, 200)).toBe('bottom')
  })
  it('finds the first selector that matches, or nothing', () => {
    const root = { querySelector: (s: string) => (s === '.b' ? ({ parentElement: null } as unknown as HTMLElement) : null) } as unknown as ParentNode
    expect(findCoachTarget(root, { selectors: ['.a', '.b'] })).not.toBeNull()
    expect(findCoachTarget(root, { selectors: ['.a'] })).toBeNull()
    expect(findCoachTarget(root, undefined)).toBeNull()
  })
})
