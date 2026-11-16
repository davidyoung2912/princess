import { describe, expect, it } from 'vitest'
import { asExplorerDay, asVenueDay } from './guards'
import { createHttpGroups } from './httpApi'
import type { Http } from './http'

const trips = { upcoming: [{ number: 'PC2', kind: 'current' }], past: [] }

function fake(responses: Record<string, unknown>) {
  const calls: { method: string; path: string; body?: unknown }[] = []
  const reply = (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body })
    return path in responses ? Promise.resolve(responses[path]) : Promise.reject(new Error(`unexpected ${method} ${path}`))
  }
  const http = {
    get: (p: string) => reply('GET', p), post: (p: string, b?: unknown) => reply('POST', p, b), put: (p: string, b?: unknown) => reply('PUT', p, b),
    patch: (p: string, b?: unknown) => reply('PATCH', p, b), delete: (p: string) => reply('DELETE', p),
  } as unknown as Http
  return { http, calls }
}

const venue = { id: 'crown', shipId: 'sun-princess', explorer: 'dining', kind: 'specialty', title: 'Crown Grill', short: 's', long: 'l', placeId: 'crown', deckLabel: 'Deck 7 aft', bookable: 'dining', order: 1, features: [], accessibility: [] }
const event = { id: 'e1', venueId: 'crown', day: 3, date: '2027-03-23', start: '19:00', minutes: 60, startAt: 1, endAt: 2, title: 'Tasting', detail: '', age: 'all', interest: 'learning', extra: 0, status: 'on' }
const venueDay = { venue, hours: { windows: [['17:30', '21:30']], staffed: [], closedBecause: null }, events: [event], menus: [] }
const explorerDay = { explorer: 'dining', shipId: 'sun-princess', day: 3, date: '2027-03-23', port: 'sea', shipZone: 'America/New_York', venues: [venueDay], mine: ['e1'] }

describe('Explorer client calls', () => {
  it('reads an Explorer day and a venue day with the day in the query', async () => {
    const { http, calls } = fake({ '/trips': trips, '/bookings/PC2/onboard/explorer/dining?day=3': explorerDay, '/bookings/PC2/onboard/explorer/dining/crown?day=3': venueDay })
    const g = createHttpGroups(http).groups
    expect(await g.onboard.explorerDay('dining', 3)).toEqual(explorerDay)
    expect(await g.onboard.explorerVenue('dining', 'crown', 3)).toEqual(venueDay)
    expect(calls.map((c) => c.path)).toContain('/bookings/PC2/onboard/explorer/dining/crown?day=3')
  })

  it('puts an event in or out of the plan of the day it names, not the day last read', async () => {
    const { http, calls } = fake({ '/trips': trips, '/bookings/PC2/onboard/plan/e1': ['e1'] })
    const g = createHttpGroups(http).groups
    await g.onboard.togglePlanOn('e1', 5, true)
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ on: true, day: 5 })
  })

  it('saves pins and puts them in order through the favourites routes', async () => {
    const { http, calls } = fake({ '/me/favourites/toggle': ['screen:S1'], '/me/favourites/order': ['screen:S2', 'screen:S1'] })
    const g = createHttpGroups(http).groups
    await g.favourites.toggleFavourite('screen:S1')
    await g.favourites.reorderFavourites(['screen:S2', 'screen:S1'])
    expect(calls.find((c) => c.path === '/me/favourites/order')).toMatchObject({ method: 'PUT', body: { keys: ['screen:S2', 'screen:S1'] } })
  })
})

describe('Explorer guards', () => {
  it('accepts what the server sends', () => {
    expect(asVenueDay(venueDay)).not.toBeNull()
    expect(asExplorerDay(explorerDay)).not.toBeNull()
  })

  it('refuses a venue day with no hours, a bad window or an event with no times', () => {
    expect(asVenueDay({ ...venueDay, hours: undefined })).toBeNull()
    expect(asVenueDay({ ...venueDay, hours: { windows: [['17:30']], staffed: [] } })).toBeNull()
    expect(asVenueDay({ ...venueDay, events: [{ id: 'x', venueId: 'crown', title: 't', status: 'on' }] })).toBeNull()
    expect(asVenueDay({ ...venueDay, menus: undefined })).toBeNull()
    expect(asVenueDay(null)).toBeNull()
  })

  it('refuses an Explorer day with a broken venue or no plan list', () => {
    expect(asExplorerDay({ ...explorerDay, venues: [{ venue: null }] })).toBeNull()
    expect(asExplorerDay({ ...explorerDay, mine: undefined })).toBeNull()
  })
})
