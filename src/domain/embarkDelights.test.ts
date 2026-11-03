import { describe, expect, it } from 'vitest'
import {
  addStub, bagWindow, cabinRoute, driveMinutesLeft, driveProgress, driverCard, EMPTY_EMBARK, hasStub, landmarksToMuster, lightFor, normalizeEmbark, removeStub, sailAwaySpot,
  shipLengthFeet, shipLengthsIn, STUBS_MAX, wifiQrText, WIFI_NETWORK, type Stub,
} from './embarkDelights'
import { SAILINGS } from './sailings'

describe('lightFor', () => {
  it('maps the three states', () => {
    expect(lightFor('onTrack')).toBe('green')
    expect(lightFor('tight')).toBe('amber')
    expect(lightFor('atRisk')).toBe('red')
  })
})

describe('driverCard', () => {
  it('is in the language asked for and always names the terminal and address', () => {
    const en = driverCard('en', { terminal: 'Terminal 2', address: '1850 Eller Drive' })
    const es = driverCard('es', { terminal: 'Terminal 2', address: '1850 Eller Drive' })
    expect(en.lines[0]).toMatch(/Please take me/)
    expect(es.lines[0]).toMatch(/Por favor/)
    for (const c of [en, es]) {
      expect(c.lines.join('\n')).toContain('Terminal 2')
      expect(c.lines.join('\n')).toContain('1850 Eller Drive')
    }
  })
})

describe('ship-lengths', () => {
  it('reads the ship length and counts lengths in a mile', () => {
    expect(shipLengthFeet('1,133 ft')).toBe(1133)
    expect(shipLengthFeet('unknown')).toBe(1133)
    expect(shipLengthsIn(1, 1000)).toBe(5)
    expect(shipLengthsIn(-3)).toBe(0)
  })
  it('counts the drive down from the whole drive to nothing', () => {
    expect(driveMinutesLeft(90, 1000, 500)).toBe(90)
    expect(driveMinutesLeft(90, null, 5_000_000)).toBe(90)
    expect(driveMinutesLeft(90, 0, 30 * 60_000)).toBe(60)
    expect(driveMinutesLeft(90, 0, 999 * 60_000)).toBe(0)
    const start = driveProgress(90, 0, 0)
    const half = driveProgress(90, 0, 45 * 60_000)
    expect(half.lengths).toBeLessThan(start.lengths)
    expect(start.lengths).toBe(start.totalLengths)
    expect(driveProgress(0, 0, 0).lengths).toBe(0)
  })
})

describe('cabinRoute', () => {
  it('gives deck, lift bank and side from the number', () => {
    const r = cabinRoute('9124')!
    expect(r.deck).toBe(9)
    expect(r.section).toBe('forward')
    expect(r.side).toBe('starboard')
    expect(cabinRoute('9125')!.side).toBe('port')
    expect(cabinRoute('12045')!.deck).toBe(12)
    expect(r.bank).toMatch(/^[A-F]$/)
  })
  it('refuses what is not a cabin', () => {
    expect(cabinRoute('abc')).toBeNull()
    expect(cabinRoute('12')).toBeNull()
  })
})

describe('landmarksToMuster', () => {
  it('gives up to three named places, ending with the station', () => {
    const l = landmarksToMuster('9124', 'Station C')
    expect(l.length).toBeGreaterThanOrEqual(2)
    expect(l.length).toBeLessThanOrEqual(3)
    expect(l.at(-1)!.name).toMatch(/Piazza/)
    expect(new Set(l.map((x) => x.id)).size).toBe(l.length)
  })
  it('gives nothing when the cabin or the station is not known', () => {
    expect(landmarksToMuster('x', 'Station C')).toEqual([])
    expect(landmarksToMuster('9124', 'Nowhere')).toEqual([])
  })
})

describe('bag window, sail-away and Wi-Fi', () => {
  it('words the usual bag window', () => {
    const w = bagWindow()
    expect(w.from).toBe('1:00 pm')
    expect(w.to).toBe('5:00 pm')
  })
  it('puts the sail-away spot twenty minutes before departure', () => {
    const s = sailAwaySpot(SAILINGS[0])!
    expect(s.deck).toBeGreaterThan(0)
    const [dh, dm] = s.departs.split(':').map(Number)
    const [bh, bm] = s.beThere.split(':').map(Number)
    expect(dh * 60 + dm - (bh * 60 + bm)).toBe(20)
  })
  it('builds a join-network QR text with no password and escapes odd characters', () => {
    expect(wifiQrText()).toBe(`WIFI:T:nopass;S:${WIFI_NETWORK};;`)
    expect(wifiQrText('a;b:c')).toBe('WIFI:T:nopass;S:a\\;b\\:c;;')
  })
})

describe('ticket stubs', () => {
  const stub = (n: string, date: string): Stub => ({ id: `id${n}`, number: n, date, terminal: 'Terminal 2', guests: 2, savedAt: 1 })
  it('keeps one stub per booking and the newest sailings first', () => {
    let l: Stub[] = []
    l = addStub(l, stub('A1', '2027-03-20'))
    l = addStub(l, stub('B2', '2027-05-01'))
    l = addStub(l, { ...stub('A1', '2027-03-20'), guests: 3 })
    expect(l.map((x) => x.number)).toEqual(['B2', 'A1'])
    expect(l.find((x) => x.number === 'A1')!.guests).toBe(3)
    expect(hasStub(l, 'A1')).toBe(true)
    expect(removeStub(l, 'idB2')).toHaveLength(1)
  })
  it('refuses a bad date and caps the list', () => {
    expect(addStub([], stub('A1', 'soon'))).toEqual([])
    let l: Stub[] = []
    for (let i = 0; i < STUBS_MAX + 5; i++) l = addStub(l, stub(`N${i}`, `2027-01-${String((i % 28) + 1).padStart(2, '0')}`))
    expect(l).toHaveLength(STUBS_MAX)
  })
  it('normalises from untrusted data', () => {
    expect(normalizeEmbark(null)).toEqual(EMPTY_EMBARK)
    expect(normalizeEmbark({ stubs: [{ id: 'a', number: 'A1', date: '2027-03-20', terminal: 'T2', guests: 2, savedAt: 5 }, { id: 5 }, 'x'] }).stubs).toHaveLength(1)
  })
})

describe('stubs in the memory document', () => {
  it('survive a save and load', async () => {
    const { normalizeMemory, EMPTY_MEMORY, restOf } = await import('../memory/store')
    const m = { ...EMPTY_MEMORY, embark: { stubs: addStub([], { id: 'a', number: 'N1', date: '2027-03-20', terminal: 'Terminal 2', guests: 2, savedAt: 9 }) } }
    expect(normalizeMemory(JSON.parse(JSON.stringify(restOf(m)))).embark.stubs).toHaveLength(1)
  })
})
