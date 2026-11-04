import { afterEach, describe, expect, it } from 'vitest'
import { clearRooms, loadSailingRooms, loadShipRooms, normalizeSailingRooms, normalizeShipRooms, sailingRooms, setRoomLoaders, shipRooms } from './shipRooms'

const sailing = () => [
  { id: 'sky-interior', name: 'Interior', suite: false, capacity: 4, sizeSqFt: 160, description: 'The best-value way to sail.', perNight: 20_500, fare: 205_000 },
  { id: 'sky-minisuite', name: 'Mini-Suite', suite: true, capacity: 4, sizeSqFt: 300, description: '', perNight: 50_000, fare: 500_000 },
]
const detail = () => ({ ship: { id: 'sky-princess' }, decks: [], venues: [], categories: sailing().map(({ perNight: _p, fare: _f, ...r }) => r) })

describe('stateroom types of a ship', () => {
  afterEach(() => { setRoomLoaders({ sailing: null, ship: null }); clearRooms() })

  it('reads a sailing’s rooms with their sample fares', () => {
    const rooms = normalizeSailingRooms(sailing())!
    expect(rooms.map((r) => r.id)).toEqual(['sky-interior', 'sky-minisuite'])
    expect(rooms[1]).toMatchObject({ suite: true, fare: 500_000, perNight: 50_000 })
  })
  it.each([
    ['not a list', () => ({})],
    ['no rooms', () => []],
    ['a repeated id', () => { const l = sailing(); l[1].id = l[0].id; return l }],
    ['a room with no fare', () => { const l = sailing() as Record<string, unknown>[]; delete l[0].fare; return l }],
    ['a bad capacity', () => { const l = sailing(); l[0].capacity = 0; return l }],
  ])('rejects %s', (_n, make) => { expect(normalizeSailingRooms(make())).toBeNull() })

  it('reads a ship’s rooms from its detail answer, with no fares', () => {
    const rooms = normalizeShipRooms(detail())!
    expect(rooms).toHaveLength(2)
    expect(rooms[0].fare).toBeUndefined()
    expect(normalizeShipRooms({ categories: [] })).toBeNull()
  })
  it('loads once, shares a second ask, and keeps nothing from a bad answer', async () => {
    let calls = 0
    setRoomLoaders({ sailing: async () => { calls++; return sailing() }, ship: async () => ({ nonsense: true }) })
    const [a, b] = await Promise.all([loadSailingRooms('s1'), loadSailingRooms('s1')])
    expect([a, b]).toEqual([true, true])
    expect(await loadSailingRooms('s1')).toBe(true)
    expect(calls).toBe(1)
    expect(sailingRooms('s1')).toHaveLength(2)
    expect(await loadShipRooms('sky-princess')).toBe(false)
    expect(shipRooms('sky-princess')).toBeUndefined()
  })
  it('gives false with no loader or when the loader fails', async () => {
    expect(await loadSailingRooms('s2')).toBe(false)
    setRoomLoaders({ sailing: async () => { throw new Error('offline') }, ship: null })
    expect(await loadSailingRooms('s2')).toBe(false)
  })
})
