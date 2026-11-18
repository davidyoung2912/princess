// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import { getHints } from '../settings/hints'
import { loadTourSeen, markTourStep, resetTour, skipTour } from '../settings/tour'
import { placeCard, sideOrder, spotlight } from './placement'
import { nextStep, TOUR_STEPS } from './steps'

const view = { width: 1000, height: 700 }
const card = { width: 300, height: 160 }

describe('tour card placement', () => {
  it('sits on the preferred side, lined up with the target and pointing at its middle', () => {
    const p = placeCard({ left: 20, top: 300, width: 200, height: 40 }, card, view, 'right')
    expect(p.side).toBe('right')
    expect(p.left).toBe(236)
    expect(p.arrow).toBeGreaterThan(0)
  })
  it('moves to the opposite side when the preferred one has no room', () => {
    expect(placeCard({ left: 400, top: 600, width: 100, height: 60 }, card, view, 'bottom').side).toBe('top')
  })
  it('stays on screen, and falls back to overlapping when the target fills the screen', () => {
    const p = placeCard({ left: 0, top: 0, width: 1000, height: 700 }, card, view, 'bottom')
    expect(p.side).toBe('over')
    expect(p.top + card.height).toBeLessThanOrEqual(view.height)
    const edge = placeCard({ left: 960, top: 100, width: 30, height: 30 }, card, view, 'bottom')
    expect(edge.left + card.width).toBeLessThanOrEqual(view.width)
  })
  it('tries the preferred side, its opposite, then the other two', () => {
    expect(sideOrder('left')).toEqual(['left', 'right', 'top', 'bottom'])
  })
  it('cuts the glass hole a little larger than the target, inside the screen', () => {
    expect(spotlight({ left: 2, top: 2, width: 50, height: 50 }, view, 6)).toEqual({ left: 0, top: 0, width: 58, height: 58 })
  })
})

describe('tour progress', () => {
  beforeEach(() => { localStorage.clear(); resetTour() })
  it('shows steps in order, passing over any whose target is not showing', () => {
    const all = () => true
    expect(nextStep([], all)?.id).toBe(TOUR_STEPS[0]!.id)
    expect(nextStep([TOUR_STEPS[0]!.id], (n) => n !== TOUR_STEPS[1]!.target)?.id).toBe(TOUR_STEPS[2]!.id)
    expect(nextStep(TOUR_STEPS.map((s) => s.id), all)).toBeNull()
  })
  it('remembers dismissed steps on the account, can skip the rest and can be reset', () => {
    markTourStep('date')
    expect(getHints().tour).toEqual(['date'])
    expect(localStorage.getItem('princess.tourSeen')).toBeNull()
    skipTour()
    expect(loadTourSeen()).toHaveLength(TOUR_STEPS.length)
    resetTour()
    expect(loadTourSeen()).toEqual([])
  })
  it('has a title and a text for every step', () => {
    for (const s of TOUR_STEPS) {
      expect(en[`tour.${s.id}.title` as keyof typeof en]).toBeTruthy()
      expect(en[`tour.${s.id}.body` as keyof typeof en]).toBeTruthy()
    }
  })
})
