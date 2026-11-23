import { describe, expect, it } from 'vitest'
import { boundsOf, distanceKm, isLatLng, legsKm, nearestOrder, project, scaleBar, walkMinutes, walkingDistanceLabel } from './geo'

const kotor = { lat: 42.4247, lng: 18.7712 }
const old = { lat: 42.4251, lng: 18.7712 }
const fort = { lat: 42.4207, lng: 18.7703 }

describe('geo', () => {
  it('accepts only real coordinates', () => {
    expect(isLatLng(kotor)).toBe(true)
    for (const bad of [null, undefined, 5, {}, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: NaN, lng: 0 }, { lat: '1', lng: 2 }]) expect(isLatLng(bad)).toBe(false)
  })
  it('measures a known distance (one degree of latitude is about 111 km)', () => {
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.2, 0)
    expect(distanceKm(kotor, kotor)).toBe(0)
  })
  it('turns distance into walking minutes with the street factor and a minimum of one', () => {
    expect(walkMinutes(0)).toBe(0)
    expect(walkMinutes(0.01)).toBe(1)
    expect(walkMinutes(1)).toBe(17)
    expect(walkMinutes(1, 'easy')).toBeGreaterThan(walkMinutes(1, 'steady'))
  })
  it('labels short walks in metres and long ones in kilometres', () => {
    expect(walkingDistanceLabel(0.2)).toBe('250 m')
    expect(walkingDistanceLabel(2)).toBe('2.5 km')
  })
  it('orders stops by nearest next stop from a start', () => {
    const far = { lat: 42.5, lng: 18.9 }
    expect(nearestOrder([far, fort, old], kotor)).toEqual([2, 1, 0])
    expect(nearestOrder([fort, far, old])).toEqual([0, 2, 1])
    expect(nearestOrder([])).toEqual([])
  })
  it('lists leg distances', () => {
    expect(legsKm([kotor])).toEqual([])
    expect(legsKm([kotor, old, fort])).toHaveLength(2)
  })
  it('finds bounds, and none for no points', () => {
    expect(boundsOf([])).toBeNull()
    expect(boundsOf([kotor, fort])).toEqual({ minLat: fort.lat, maxLat: kotor.lat, minLng: 18.7703, maxLng: 18.7712 })
  })
  it('projects inside the box with north up and equal scale', () => {
    const p = project([kotor, fort, { lat: 42.4207, lng: 18.7803 }], 400, 300)
    for (const q of p.points) { expect(q.x).toBeGreaterThanOrEqual(0); expect(q.x).toBeLessThanOrEqual(400); expect(q.y).toBeGreaterThanOrEqual(0); expect(q.y).toBeLessThanOrEqual(300) }
    expect(p.points[0].y).toBeLessThan(p.points[1].y)
    expect(p.points[2].x).toBeGreaterThan(p.points[1].x)
  })
  it('draws one place, or places on top of each other, in the middle with a usable scale', () => {
    const p = project([kotor, kotor], 400, 300)
    expect(p.points[0]).toEqual({ x: 200, y: 150 })
    expect(p.kmPerUnit).toBeGreaterThan(0)
    expect(project([], 400, 300).points).toEqual([])
  })
  it('picks a round scale bar that fits', () => {
    const bar = scaleBar(project([kotor, fort], 400, 300))
    expect(bar).not.toBeNull()
    expect(bar!.units).toBeLessThanOrEqual(400 * 0.25 + 0.001)
    expect(bar!.label).toMatch(/^\d+(\.\d+)? (m|km)$/)
    expect(scaleBar(project([], 400, 300))).toBeNull()
  })
})
