import { describe, expect, it } from 'vitest'
import { clamp, fitAll, fitAllScale, fitWidthScale, initial, maxScale, panBy, pinch, zoomAt } from './viewport'

const view = { width: 400, height: 600 }
const image = { width: 330, height: 2400 }

describe('deck plan viewport', () => {
  it('starts at full width, top of the plan', () => {
    const t = initial(view, image)
    expect(t.scale).toBeCloseTo(400 / 330)
    expect(t.y).toBe(0)
    expect(t.x).toBeCloseTo(0)
  })

  it('fits the whole strip and centres it', () => {
    const t = fitAll(view, image)
    expect(t.scale).toBeCloseTo(600 / 2400)
    expect(t.x).toBeCloseTo((400 - 330 * t.scale) / 2)
    expect(t.y).toBeCloseTo(0)
  })

  it('never pans past the edges of the plan', () => {
    const t = initial(view, image)
    expect(panBy(t, 50, 500, view, image)).toMatchObject({ y: 0 })
    const bottom = panBy(t, 0, -1e6, view, image)
    expect(bottom.y).toBeCloseTo(600 - 2400 * t.scale)
  })

  it('limits zoom between fit-all and six times fit-width', () => {
    const t = initial(view, image)
    expect(zoomAt(t, 100, 0, 0, view, image).scale).toBeCloseTo(maxScale(view, image))
    expect(zoomAt(t, 0.0001, 0, 0, view, image).scale).toBeCloseTo(fitAllScale(view, image))
    expect(maxScale(view, image)).toBeCloseTo(fitWidthScale(view, image) * 6)
  })

  it('keeps the point under the finger fixed while zooming', () => {
    const start = clamp({ scale: 1, x: -20, y: -300 }, view, image)
    const next = zoomAt(start, 2, 200, 300, view, image)
    const before = { x: (200 - start.x) / start.scale, y: (300 - start.y) / start.scale }
    const after = { x: (200 - next.x) / next.scale, y: (300 - next.y) / next.scale }
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('measures a pinch', () => {
    expect(pinch({ x: 0, y: 0 }, { x: 6, y: 8 })).toEqual({ distance: 10, x: 3, y: 4 })
  })
})
