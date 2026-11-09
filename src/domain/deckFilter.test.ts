import { describe, expect, it } from 'vitest'
import { clampZoom, inCategories, momentumStep, pinchZoom, walkMinutes } from './deckFilter'

describe('deck filters', () => {
  it('shows everything when nothing is chosen', () => {
    expect(inCategories({ kind: 'dining' }, new Set())).toBe(true)
  })
  it('matches kinds in a chosen category only', () => {
    expect(inCategories({ kind: 'bar' }, new Set(['food']))).toBe(true)
    expect(inCategories({ kind: 'show' }, new Set(['food']))).toBe(false)
    expect(inCategories({ kind: 'pool' }, new Set(['food', 'wellness']))).toBe(true)
  })
  it('gives a walk time between two places and null for an unknown one', () => {
    expect(walkMinutes('eclipse', 'lido', false)).toBeGreaterThan(0)
    expect(walkMinutes('eclipse', 'nowhere', false)).toBeNull()
  })
  it('clamps and pinches the zoom', () => {
    expect(clampZoom(9)).toBe(3)
    expect(clampZoom(0.2)).toBe(1)
    expect(pinchZoom(1, 100, 200)).toBe(2)
    expect(pinchZoom(2, 100, 400)).toBe(3)
    expect(pinchZoom(2, 0, 400)).toBe(2)
  })
  it('slows momentum to a stop', () => {
    let v = 20
    let frames = 0
    while (v !== 0 && frames < 200) { v = momentumStep(v).velocity; frames++ }
    expect(v).toBe(0)
    expect(frames).toBeLessThan(200)
  })
})
