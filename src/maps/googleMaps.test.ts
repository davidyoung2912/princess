import { describe, expect, it } from 'vitest'
import { directionsToUrl, embedUrl, MAX_STOPS, placeUrl, walkingRouteUrl } from './googleMaps'

const a = { lat: 42.4247, lng: 18.7712 }
const b = { lat: 42.4207, lng: 18.7703 }
const c = { lat: 42.43, lng: 18.77 }
const KEY = 'AIzaSyA-0123456789abcdefghijklmnopqrs'

describe('google maps links', () => {
  it('builds keyless place and directions links', () => {
    expect(placeUrl(a)).toBe('https://www.google.com/maps/search/?api=1&query=42.424700%2C18.771200')
    expect(directionsToUrl(a)).toContain('destination=42.424700%2C18.771200&travelmode=walking')
  })
  it('refuses a bad coordinate', () => {
    expect(placeUrl({ lat: 100, lng: 0 })).toBeNull()
    expect(directionsToUrl({ lat: NaN, lng: 0 })).toBeNull()
  })
  it('builds a walking route with waypoints in order', () => {
    const u = walkingRouteUrl([a, b, c])!
    expect(u).toContain('origin=42.424700%2C18.771200')
    expect(u).toContain('destination=42.430000%2C18.770000')
    expect(u).toContain('waypoints=42.420700%2C18.770300')
    expect(u.endsWith('&travelmode=walking')).toBe(true)
    expect(walkingRouteUrl([a, b])).not.toContain('waypoints')
    expect(walkingRouteUrl([a])).toBeNull()
  })
  it('caps the number of stops and keeps the last as the destination', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ lat: 40 + i / 100, lng: 10 }))
    const u = walkingRouteUrl(many)!
    expect(decodeURIComponent(u.split('waypoints=')[1].split('&')[0]).split('|')).toHaveLength(MAX_STOPS - 2)
    expect(u).toContain('destination=40.140000')
  })
  it('embeds only with a plausible key and at least one place', () => {
    expect(embedUrl(undefined, [a])).toBeNull()
    expect(embedUrl('short', [a])).toBeNull()
    expect(embedUrl('bad key with spaces and punctuation!!', [a])).toBeNull()
    expect(embedUrl(KEY, [])).toBeNull()
    expect(embedUrl(KEY, [a])).toContain('/embed/v1/place?key=' + KEY)
    expect(embedUrl(KEY, [a, b])).toContain('/embed/v1/directions?key=' + KEY)
    expect(embedUrl(KEY, [a, b])).toContain('mode=walking')
  })
})

describe('content security policy for the embed', () => {
  it('allows Google map frames only when a key is set at build time', async () => {
    const { readFileSync } = await import('node:fs')
    const config = readFileSync('vite.config.ts', 'utf8')
    expect(config).toContain('frame-src https://www.google.com/maps/embed/')
    expect(config).toMatch(/return key \? " frame-src [^"]+" : ''/)
    expect(config).not.toMatch(/"frame-src/)
  })
})
