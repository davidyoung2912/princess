import { describe, expect, it } from 'vitest'
import { areaOf, createTracker, dayOf, routeKey } from './tracker'

describe('routeKey', () => {
  it('uses the first two segments and drops ids', () => {
    expect(routeKey('/me/trips/AB123456')).toBe('route.me.trips')
    expect(routeKey('/dining-today')).toBe('route.dining-today')
    expect(routeKey('/ship/dining/specialty')).toBe('route.ship.dining')
    expect(routeKey('/')).toBe('route.home')
    expect(routeKey('/me/stats?x=1#top')).toBe('route.me.stats')
  })
  it('stays within what the server accepts', () => {
    const key = routeKey('/a-very-long-first-segment-name/and-an-even-longer-second-segment')!
    expect(key.length).toBeLessThanOrEqual(40)
    expect(key).toMatch(/^route\.[a-z0-9.-]+$/)
    expect(key.endsWith('.')).toBe(false)
  })
  it('gives nothing for a path with no usable parts', () => {
    expect(routeKey('/123456')).toBeNull()
  })
})

describe('areaOf', () => {
  it('names the tab', () => {
    expect(areaOf('/')).toBe('home')
    expect(areaOf('/chat/room/1')).toBe('chat')
    expect(areaOf('/nautical')).toBe('other')
  })
})

describe('createTracker', () => {
  const at = (h: number) => () => new Date(2027, 2, 9, h, 30)

  it('counts opens, views, areas and time by hour of day', () => {
    const t = createTracker(at(21))
    t.opened()
    t.view('/me/stats')
    t.view('/me/stats')
    t.active(30)
    t.active(0.4)
    t.shared()
    expect(t.take()).toEqual({ day: '2027-03-09', counters: { opens: 1, views: 2, 'area.me': 2, 'route.me.stats': 2, seconds: 30, 'hour.21': 30, shares: 1 } })
  })
  it('counts every question asked of Stanley, which the server\'s rate-limit ledger cannot give', () => {
    const t = createTracker(at(9))
    t.asked()
    t.asked()
    expect(t.take()).toEqual({ day: '2027-03-09', counters: { asks: 2 } })
  })
  it('starts again from zero after a take, and reports nothing when nothing happened', () => {
    const t = createTracker(at(8))
    expect(t.take()).toBeNull()
    t.view('/plan')
    expect(t.take()).not.toBeNull()
    expect(t.take()).toBeNull()
  })
  it('puts a failed batch back to go with the next one', () => {
    const t = createTracker(at(8))
    t.view('/plan')
    const batch = t.take()!
    t.view('/plan')
    t.restore(batch)
    expect(t.take()?.counters.views).toBe(2)
  })
  it('formats the day on the device clock', () => {
    expect(dayOf(new Date(2027, 0, 5))).toBe('2027-01-05')
  })
})
