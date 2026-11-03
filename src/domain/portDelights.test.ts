import { describe, expect, it } from 'vitest'
import { SAILINGS } from './sailings'
import {
  addPin, allowanceLeft, creditLeft, dayCardText, EMPTY_PORTS, finalDayStrip, normalizePorts, PINS_MAX, pinsAt, portStamps, removePin, stopwatch, sunPrompts, TAKE_ME_BACK, tripNumbers, tripNumbersText,
} from './portDelights'

const MIN = 60_000
const sailing = SAILINGS[0]

describe('stopwatch', () => {
  it('shows hours and minutes in the clock the deadline is in', () => {
    expect(stopwatch(1_000_000 + 65 * MIN, 1_000_000).text).toBe('1:05')
    expect(stopwatch(1_000_000 + 5 * MIN, 1_000_000).text).toBe('0:05')
  })
  it('stays at zero once it is time', () => {
    expect(stopwatch(1_000_000, 1_000_000 + 10 * MIN).text).toBe('0:00')
  })
})

describe('take me back', () => {
  it('has words for every port in the local language', () => {
    expect(TAKE_ME_BACK.cozumel.lang).toBe('es')
    expect(TAKE_ME_BACK.belize.lang).toBe('en')
    expect(TAKE_ME_BACK.roatan.say).toContain('Sun Princess')
  })
})

describe('sunPrompts', () => {
  it('says nothing on a mild day', () => expect(sunPrompts({ uv: 2, tempF: 78 })).toEqual([]))
  it('suggests sunscreen at a moderate UV', () => expect(sunPrompts({ uv: 5, tempF: 82 })).toEqual(['sunscreen']))
  it('adds shade and water in strong sun and heat', () => expect(sunPrompts({ uv: 10, tempF: 93 })).toEqual(['sunscreen', 'shade', 'water']))
})

describe('portStamps', () => {
  it('collects a stamp for each port reached so far', () => {
    const all = portStamps(sailing, '2999-01-01')
    expect(all.map((s) => s.port).length).toBeGreaterThan(0)
    expect(portStamps(sailing, '1999-01-01')).toEqual([])
    const first = all[0]
    expect(portStamps(sailing, first.date)).toEqual([first])
  })
})

describe('pins', () => {
  it('adds, lists by port and removes', () => {
    const a = addPin([], { id: 'a', port: 'cozumel', note: '  Best coffee ', at: 1 })
    expect(a[0].note).toBe('Best coffee')
    expect(pinsAt(a, 'belize')).toEqual([])
    expect(removePin(a, 'a')).toEqual([])
  })
  it('refuses an empty note, a duplicate and a full list', () => {
    expect(addPin([], { id: 'a', port: 'cozumel', note: ' ', at: 1 })).toEqual([])
    const a = addPin([], { id: 'a', port: 'cozumel', note: 'x', at: 1 })
    expect(addPin(a, { id: 'a', port: 'cozumel', note: 'y', at: 2 })).toHaveLength(1)
    const full = Array.from({ length: PINS_MAX }, (_, i) => ({ id: `p${i}`, port: 'roatan' as const, note: 'n', at: i }))
    expect(addPin(full, { id: 'z', port: 'roatan', note: 'n', at: 1 })).toHaveLength(PINS_MAX)
  })
})

describe('dayCardText', () => {
  it('has the leave-by time, the phone, the words and own pins', () => {
    const pins = addPin([], { id: 'a', port: 'roatan', note: 'Best coffee', at: 1 })
    const text = dayCardText({ port: 'roatan', portName: 'Roatán', allAboardShip: '3:30 pm', allAboardLocal: '2:30 pm', phone: '555-0100', pins })
    expect(text).toContain('all aboard 3:30 pm ship time (2:30 pm here)')
    expect(text).toContain('555-0100')
    expect(text).toContain('Best coffee')
    expect(text).toContain(TAKE_ME_BACK.roatan.say)
  })
})

describe('finalDayStrip', () => {
  it('is in time order and puts the walk-off between breakfast and cabin-empty', () => {
    const s = finalDayStrip({ arrivalAt: 1000 * MIN, vacateAt: 1150 * MIN }, 1100 * MIN)
    expect(s.map((i) => i.id)).toEqual(['arrive', 'breakfast', 'group', 'vacate'])
  })
})

describe('credit and allowance', () => {
  it('shows credit only when the account is in credit', () => {
    expect(creditLeft({ charges: 3000, credits: 5000 })).toBe(2000)
    expect(creditLeft({ charges: 9000, credits: 5000 })).toBe(0)
  })
  it('works out the allowance left for the party', () => {
    expect(allowanceLeft(2, 500)).toEqual({ left: 1100, over: 0 })
    expect(allowanceLeft(1, 1000)).toEqual({ left: 0, over: 200 })
  })
})

describe('trip numbers', () => {
  it('counts nights, ports and sea days from the route', () => {
    const n = tripNumbers(sailing)
    expect(n.nights).toBe(7)
    expect(n.ports + n.seaDays).toBeGreaterThan(0)
    expect(tripNumbersText(n)).toContain('7 nights')
  })
})

describe('normalizePorts', () => {
  it('survives anything', () => {
    expect(normalizePorts(null)).toEqual(EMPTY_PORTS)
    expect(normalizePorts({ pins: 'x', card: 5, lastLook: 7 })).toEqual(EMPTY_PORTS)
  })
  it('keeps good values and drops bad ones', () => {
    const s = normalizePorts({ pins: [{ id: 'a', port: 'belize', note: 'Pier', at: 2 }, { id: 'b', port: 'mars', note: 'x', at: 1 }], card: { port: 'belize', text: 'hi', at: 3 }, lastLook: { done: true, note: 'Pink sky' } })
    expect(s.pins).toHaveLength(1)
    expect(s.card?.text).toBe('hi')
    expect(s.lastLook).toEqual({ done: true, note: 'Pink sky' })
  })
})

describe('ports in the memory document', () => {
  it('survives a save and load, and is part of what syncs', async () => {
    const { normalizeMemory, EMPTY_MEMORY, restOf } = await import('../memory/store')
    const m = { ...EMPTY_MEMORY, ports: normalizePorts({ pins: [{ id: 'a', port: 'cozumel', note: 'Best coffee', at: 1 }], lastLook: { done: true, note: 'Pink sky' } }) }
    const back = normalizeMemory(JSON.parse(JSON.stringify(restOf(m))))
    expect(back.ports.pins[0].note).toBe('Best coffee')
    expect(back.ports.lastLook.done).toBe(true)
  })
})
