import { afterEach, describe, expect, it } from 'vitest'
import { applySailings, normalizeSailings } from './sailingsServed'
import { itinerary, PORTS, REFERENCE_SAILING, SAILINGS, shipHomeZone, shipZoneOnDate } from './sailings'

const NY = 'America/New_York'
const BZ = 'America/Belize'

const wire = () => ({
  version: 'abc',
  sailings: [
    { id: 'sun-2027-03-21', departure: '2027-03-21', holiday: false, reference: true },
    { id: 'sun-2027-04-11', departure: '2027-04-11', holiday: false, reference: false },
  ],
  ports: [
    { id: 'fll', name: 'Fort Lauderdale', zone: 'America/New_York', tender: false },
    { id: 'cozumel', name: 'Cozumel, Mexico', zone: 'America/Cancun', tender: false },
  ],
  itinerary: [
    { day: 1, port: 'fll', arrive: null, allAboard: null, depart: '15:00', shipZone: NY },
    { day: 2, port: 'sea', arrive: null, allAboard: null, depart: null, shipZone: NY },
    { day: 3, port: 'cozumel', arrive: '07:00', allAboard: '16:30', depart: '17:00', shipZone: NY },
    { day: 4, port: 'sea', arrive: null, allAboard: null, depart: null, shipZone: BZ },
    { day: 5, port: 'sea', arrive: null, allAboard: null, depart: null, shipZone: BZ },
    { day: 6, port: 'sea', arrive: null, allAboard: null, depart: null, shipZone: BZ },
    { day: 7, port: 'sea', arrive: null, allAboard: null, depart: null, shipZone: NY },
    { day: 8, port: 'fll', arrive: '06:00', allAboard: null, depart: null, shipZone: NY },
  ],
})

describe('normalizeSailings', () => {
  it('reads a good answer', () => {
    const s = normalizeSailings(wire())!
    expect(s.sailings.map((x) => x.id)).toEqual(['sun-2027-03-21', 'sun-2027-04-11'])
    expect(s.sailings[0].reference).toBe(true)
    expect(s.template[2]).toEqual({ day: 3, port: 'cozumel', arrive: '07:00', allAboard: '16:30', depart: '17:00', zone: NY })
  })

  it.each([
    ['not an object', () => 'x'],
    ['no reference sailing', () => { const w = wire(); w.sailings[0].reference = false; return w }],
    ['two reference sailings', () => { const w = wire(); w.sailings[1].reference = true; return w }],
    ['a duplicate id', () => { const w = wire(); w.sailings[1].id = w.sailings[0].id; return w }],
    ['a bad date', () => { const w = wire(); w.sailings[1].departure = '11/04/2027'; return w }],
    ['seven days', () => { const w = wire(); w.itinerary.pop(); return w }],
    ['days out of order', () => { const w = wire(); w.itinerary[1].day = 5; return w }],
    ['a bad time', () => { const w = wire(); w.itinerary[2].arrive = '7am'; return w }],
    ['a day at an unlisted port', () => { const w = wire(); w.itinerary[2].port = 'nassau'; return w }],
    ['a day with no ship zone', () => { const w = wire(); delete (w.itinerary[3] as { shipZone?: string }).shipZone; return w }],
  ])('rejects %s', (_n, make) => {
    expect(normalizeSailings(make())).toBeNull()
  })
})

describe('applySailings', () => {
  const saved = { sailings: SAILINGS.map((s) => ({ ...s })), ports: { ...PORTS } }
  afterEach(() => {
    const raw = wire()
    raw.sailings = saved.sailings.map((s) => ({ id: s.id, departure: s.departure, holiday: !!s.holiday, reference: !!s.reference }))
    raw.ports = Object.values(saved.ports)
    raw.itinerary = [
      { day: 1, port: 'fll', arrive: null, allAboard: null, depart: '15:00', shipZone: NY },
      { day: 2, port: 'sea', arrive: null, allAboard: null, depart: null, shipZone: NY },
      { day: 3, port: 'cozumel', arrive: '07:00', allAboard: '16:30', depart: '17:00', shipZone: NY },
      { day: 4, port: 'belize', arrive: '07:00', allAboard: '16:00', depart: '17:00', shipZone: BZ },
      { day: 5, port: 'roatan', arrive: '08:00', allAboard: '16:30', depart: '17:00', shipZone: BZ },
      { day: 6, port: 'sea', arrive: null, allAboard: null, depart: null, shipZone: BZ },
      { day: 7, port: 'sea', arrive: null, allAboard: null, depart: null, shipZone: NY },
      { day: 8, port: 'fll', arrive: '06:00', allAboard: null, depart: null, shipZone: NY },
    ]
    applySailings(normalizeSailings(raw)!)
  })

  it('swaps the sailings, ports and itinerary in place and keeps the reference object', () => {
    const before = SAILINGS
    const ref = REFERENCE_SAILING
    applySailings(normalizeSailings(wire())!)
    expect(SAILINGS).toBe(before)
    expect(SAILINGS.map((s) => s.id)).toEqual(['sun-2027-03-21', 'sun-2027-04-11'])
    expect(REFERENCE_SAILING).toBe(ref)
    expect(Object.keys(PORTS).sort()).toEqual(['cozumel', 'fll'])
    expect(itinerary(SAILINGS[1])[2]).toMatchObject({ day: 3, date: '2027-04-13', port: 'cozumel', allAboard: '16:30' })
    expect(shipHomeZone(SAILINGS[1])).toBe(NY)
    expect(shipZoneOnDate(SAILINGS[1], '2027-04-14')).toBe(BZ)
    expect(shipZoneOnDate(SAILINGS[1], '2027-04-17')).toBe(NY)
  })
})
