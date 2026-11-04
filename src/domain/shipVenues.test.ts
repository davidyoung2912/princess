import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { activateVenues, activeVenueShip, clearVenues, keepVenues, loadShipVenues, normalizeShipVenues, setVenueLoader } from './shipVenues'
import { DIRECTORY } from './menus'
import { DELIVERY_ZONES, MENU } from './orders'
import { VENUES, venueById } from './dining'
import { applyContent } from './contentServed'
import { shipVenuesFileText, shipVenueBundles } from '../../scripts/ship-venue-data'

const raw = (shipId: string, over: Record<string, unknown> = {}) => ({
  version: `v-${shipId}`,
  shipId,
  venues: [{ id: `${shipId}-main`, name: 'Main', kind: 'main', deck: 'Deck 6 aft', cuisine: 'Dinner', cover: 0, dress: 'smart', walkIn: false, menu: 'A menu' }],
  directory: [{ id: `${shipId}-main`, name: 'Main', deck: 'Deck 6 aft', placeId: 'main', blurb: 'b', dress: 'smart', price: 'included', hours: { sea: [], port: [] }, dishes: [] }],
  menu: [{ id: `${shipId}-soup`, name: 'Soup', group: 'mains', cents: 500, alcohol: false, packaged: false, contains: [], on: ['room'], extras: [] }],
  deliveryZones: ['piazza'],
  ...over,
})

afterEach(() => { clearVenues(); setVenueLoader(null) })

describe('the dining of the other ships', () => {
  it('matches the file the server embeds (run npm run shipvenues:gen when this fails)', () => {
    expect(readFileSync(new URL('../../server/Princess.Api/Content/ship-venues.json', import.meta.url), 'utf8')).toBe(shipVenuesFileText())
  })

  it('gives each ship its own rooms, menu and zones under ids no other ship uses', () => {
    const all = shipVenueBundles()
    expect(all.map((b) => b.shipId)).toEqual(['sky-princess', 'sapphire-princess'])
    const ids = [...all.flatMap((b) => b.venues.map((v) => v.id)), ...VENUES.map((v) => v.id)]
    expect(new Set(ids).size).toBe(ids.length)
    const items = [...all.flatMap((b) => b.menu.map((m) => m.id)), ...MENU.map((m) => m.id)]
    expect(new Set(items).size).toBe(items.length)
    for (const b of all) {
      expect(b.venues.some((v) => v.kind === 'main')).toBe(true)
      expect(b.venues.every((v) => b.directory.some((d) => d.id === v.id))).toBe(true)
      expect(b.menu.every((m) => !m.substitute || b.menu.some((x) => x.id === m.substitute))).toBe(true)
      expect(b.deliveryZones).not.toContain('dome')
    }
  })
})

describe('a ship\'s dining in use', () => {
  it('reads the server\'s answer, all or nothing', () => {
    expect(normalizeShipVenues(raw('sky-princess'))?.venues).toHaveLength(1)
    expect(normalizeShipVenues(raw('sky-princess', { venues: [] }))).toBeNull()
    expect(normalizeShipVenues(raw('sky-princess', { venues: [{ id: 'x' }] }))).toBeNull()
    expect(normalizeShipVenues(raw('sky-princess', { menu: [{ name: 'no id' }] }))).toBeNull()
    expect(normalizeShipVenues(raw('sky-princess', { deliveryZones: [] }))).toBeNull()
    expect(normalizeShipVenues(null)).toBeNull()
  })

  it('puts the ship in use where the screens read it, and keeps it over the Sun lists that arrive later', () => {
    keepVenues(normalizeShipVenues(raw('sky-princess'))!)
    expect(activateVenues('sapphire-princess')).toBe(false)
    expect(activateVenues('sky-princess')).toBe(true)
    expect(activeVenueShip()).toBe('sky-princess')
    expect(venueById('sky-princess-main')?.name).toBe('Main')
    expect(MENU.map((m) => m.id)).toEqual(['sky-princess-soup'])
    expect([...DELIVERY_ZONES]).toEqual(['piazza'])
    expect(DIRECTORY[0].id).toBe('sky-princess-main')
    applyContent({ version: 'x', values: { 'orders.MENU': [{ id: 'cheeseburger' }] } })
    expect(MENU.map((m) => m.id)).toEqual(['sky-princess-soup'])
  })

  it('asks the loader once and keeps what it gets', async () => {
    let asked = 0
    setVenueLoader(async (id) => { asked++; return raw(id) })
    expect(await Promise.all([loadShipVenues('sky-princess'), loadShipVenues('sky-princess')])).toEqual([true, true])
    expect(await loadShipVenues('sky-princess')).toBe(true)
    expect(asked).toBe(1)
    setVenueLoader(async () => raw('other'))
    expect(await loadShipVenues('sapphire-princess')).toBe(false)
  })
})
