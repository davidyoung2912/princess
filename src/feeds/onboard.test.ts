import { afterEach, describe, expect, it, vi } from 'vitest'
import { loungerBoard, matchFound, type LoungerOther } from '../domain/aboardMore'
import { watchState, type Watch } from '../domain/autopilot'
import { envFor, goodTime, levelAt, lineReading, PULSE_VENUES, pulseAt, quietSpaces } from '../domain/pulse'
import { createFeed } from './feed'
import { foundFeed, loungerFeed, normalizeFound, normalizeLoungers, normalizeOpening, normalizeSightings, openingFeed, sightingsFeed } from './onboard'
import { dayLevel, minuteOf, normalizePulse, normalizePulseDay, pulseFeed, withServed } from './pulse'
import { normalizeSkyNight, skyNightFeed } from './skyNight'
import { normalizeStorm, stormFeed } from './storm'

const sailing = { id: 'x', departure: '2027-03-21' }

const storm = { source: 'sim', departure: '2027-09-12', returns: '2027-09-19', inSeason: true, percent: 15, band: 'higher', phase: 'near', lineMay: ['reroute', 'swap'], youCan: ['insurance', 'flights'], peak: true }
const night = { day: 3, port: 'cozumel', sunrise: '06:30', sunset: '18:40', sunsetAt: Date.parse('2027-03-23T23:40:00Z'), moon: { phase: 'full', name: 'Full moon', lit: 99 }, sunsetSide: 'port', sailAway: '17:00', sailAwayAtSunset: false, stars: ['Orion'], darkSky: false, source: 'sim' }
const others: LoungerOther[] = Array.from({ length: 8 }, (_, i) => (i % 3 === 0 ? { id: i + 1, state: 'free' as const, returnsIn: null } : i % 3 === 1 ? { id: i + 1, state: 'held' as const, returnsIn: 12 } : { id: i + 1, state: 'overdue' as const, returnsIn: null }))
const NOW = Date.parse('2027-03-23T15:20:00Z')

afterEach(() => { for (const f of [pulseFeed, stormFeed, skyNightFeed, loungerFeed, sightingsFeed, foundFeed, openingFeed]) { f.setFetcher(null); f.forget() } })

describe('createFeed', () => {
  it('knows nothing until the server answers, takes its answer once, and ignores failures and bad shapes', async () => {
    let calls = 0
    const feed = createFeed<[number], number>((n) => String(n), (raw) => (typeof raw === 'number' ? raw : null))
    expect(await feed.load(1)).toBe(false)
    expect(feed.now(1)).toBeNull()
    feed.setFetcher(async () => { calls++; return 9 })
    expect(await feed.load(1)).toBe(true)
    expect(await feed.load(1)).toBe(false)
    expect(calls).toBe(1)
    expect([feed.now(1), feed.now(2)]).toEqual([9, null])
    feed.setFetcher(async () => 'nope')
    expect(await feed.load(3)).toBe(false)
    feed.setFetcher(async () => { throw new Error('offline') })
    expect(await feed.load(4)).toBe(false)
    expect(feed.now(4)).toBeNull()
    feed.forget()
    expect(feed.now(1)).toBeNull()
  })
})

describe('a kept feed', () => {
  it('shows the last answer kept on the device before the server is asked, and forgets it on sign-out', async () => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      get length() { return data.size },
      key: (i: number) => [...data.keys()][i] ?? null,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, v) },
      removeItem: (k: string) => { data.delete(k) },
    })
    try {
      const feed = createFeed<[number], number>((n) => String(n), (raw) => (typeof raw === 'number' ? raw : null), 'test')
      feed.setFetcher(async () => 7)
      expect(await feed.load(1)).toBe(true)
      feed.forget()
      expect(feed.now(1)).toBeNull()
      feed.setFetcher(async () => 7)
      await feed.load(1)
      // A new session: the memory is gone but the kept copy answers at once.
      const again = createFeed<[number], number>((n) => String(n), (raw) => (typeof raw === 'number' ? raw : null), 'test')
      expect(again.now(1)).toBe(7)
      again.forget()
      expect(again.now(1)).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('ship pulse feed', () => {
  const body = (level: number) => ({
    now: NOW, observedAt: NOW, source: 'sim',
    venues: Object.fromEntries(PULSE_VENUES.map((v) => [v.id, { observed: level, ahead: Array.from({ length: 9 }, (_, i) => level + i) }])),
  })
  it('reads a full answer into levels for exact moments', () => {
    const served = normalizePulse(body(10))!
    expect(served.get(`lido|${NOW}`)).toBe(10)
    expect(served.get(`lido|${NOW + 30 * 60_000 * 3}`)).toBe(13)
  })
  it('refuses answers with a missing venue, a bad level or the wrong count', () => {
    expect(normalizePulse(null)).toBeNull()
    const missing = body(10)
    delete (missing.venues as Record<string, unknown>).lido
    expect(normalizePulse(missing)).toBeNull()
    expect(normalizePulse(body(101))).toBeNull()
    const short = body(10)
    short.venues.arena.ahead.pop()
    expect(normalizePulse(short)).toBeNull()
  })
  it('lays the live levels over the served day, and knows nothing where the server gave nothing', () => {
    const none = envFor(sailing, () => undefined)
    const served = normalizePulse(body(77))!
    const over = withServed(none, served)
    expect(levelAt('lido', NOW, over)).toBe(77)
    expect(pulseAt('lido', NOW, over).level).toBe(77)
    expect(levelAt('lido', NOW + 60_000, over)).toBe(0)
    expect(withServed(none, null).served('lido', NOW)).toBeUndefined()
    expect(goodTime('lido', NOW, over, 4).at).toBeGreaterThanOrEqual(NOW)
    expect(lineReading('show', NOW, over).waitMinutes).toBe(Math.round((77 / 100) * 25))
    expect(quietSpaces(NOW, over).length).toBeGreaterThan(0)
  })
  it('reads a served day at the nearest half hour', () => {
    const venues: Record<string, number[]> = {}
    for (const v of PULSE_VENUES) venues[v.id] = Array.from({ length: 48 }, (_, i) => i)
    const day = normalizePulseDay({ day: 3, startAt: NOW, venues })!
    expect(day.levels.get('lido')).toHaveLength(48)
    expect(dayLevel(day, 'lido', NOW)).toBe(0)
    expect(dayLevel(day, 'lido', NOW + 44 * 60_000)).toBe(1)
    expect(dayLevel(day, 'lido', NOW + 29 * 60_000)).toBe(1)
    expect(dayLevel(day, 'lido', NOW + 23.5 * 3_600_000)).toBe(47)
    expect(dayLevel(day, 'lido', NOW - 3_600_000)).toBeUndefined()
    expect(dayLevel(day, 'lido', NOW + 25 * 3_600_000)).toBeUndefined()
    expect(dayLevel(null, 'lido', NOW)).toBeUndefined()
    expect(withServed(envFor(sailing, () => undefined), null, day).served('lido', NOW + 30 * 60_000)).toBe(1)
    expect(normalizePulseDay({ day: 3, startAt: NOW, venues: { ...venues, lido: [1] } })).toBeNull()
    expect(normalizePulseDay({ day: 9, startAt: NOW, venues })).toBeNull()
    expect(normalizePulseDay(null)).toBeNull()
  })
  it('reads whole minutes so one answer covers the minute', async () => {
    expect(minuteOf(NOW + 42_000)).toBe(NOW)
    let calls = 0
    pulseFeed.setFetcher(async () => { calls++; return body(5) })
    expect(await pulseFeed.load('2027-03-21', NOW)).toBe(true)
    expect(await pulseFeed.load('2027-03-21', NOW)).toBe(false)
    expect(calls).toBe(1)
    expect(pulseFeed.now('2027-03-21', NOW)?.get(`arena|${NOW}`)).toBe(5)
    expect(pulseFeed.now('2027-03-21', NOW + 60_000)).toBeNull()
  })
})

describe('storm feed', () => {
  it('knows nothing at first and takes a good server reading', async () => {
    expect(stormFeed.now('2027-09-12', 3)).toBeNull()
    stormFeed.setFetcher(async () => storm)
    expect(await stormFeed.load('2027-09-12', 3)).toBe(true)
    expect(stormFeed.now('2027-09-12', 3)).toMatchObject({ percent: 15, band: 'higher' })
  })
  it('refuses unknown bands, phases, keys and dates', () => {
    expect(normalizeStorm(storm)).toEqual(storm)
    expect(normalizeStorm({ ...storm, band: 'apocalypse' })).toBeNull()
    expect(normalizeStorm({ ...storm, phase: 'now' })).toBeNull()
    expect(normalizeStorm({ ...storm, lineMay: ['evacuate'] })).toBeNull()
    expect(normalizeStorm({ ...storm, returns: 'tomorrow' })).toBeNull()
    expect(normalizeStorm({ ...storm, percent: 1.5 })).toBeNull()
  })
})

describe('sun, moon and stars feed', () => {
  it('reads a good server night', () => {
    expect(skyNightFeed.now('2027-03-21', 3)).toBeNull()
    expect(normalizeSkyNight(JSON.parse(JSON.stringify(night)))).toMatchObject({ day: 3, sunset: '18:40', moon: { phase: 'full', name: 'Full moon', lit: 99 } })
  })
  it('refuses bad times, sides, phases and star lists', () => {
    expect(normalizeSkyNight({ ...night, sunset: '7pm' })).toBeNull()
    expect(normalizeSkyNight({ ...night, sunsetSide: 'up' })).toBeNull()
    expect(normalizeSkyNight({ ...night, moon: { ...night.moon, phase: 'cheese' } })).toBeNull()
    expect(normalizeSkyNight({ ...night, stars: [] })).toBeNull()
    expect(normalizeSkyNight({ ...night, port: 'mars' })).toBeNull()
    expect(normalizeSkyNight({ ...night, sailAway: 5 })).toBeNull()
  })
})

describe('lounger feed', () => {
  const rows = others
  it('reads eight rows in order and refuses anything else', () => {
    expect(normalizeLoungers({ loungers: rows })).toEqual(rows)
    expect(normalizeLoungers({ loungers: rows.slice(1) })).toBeNull()
    expect(normalizeLoungers({ loungers: rows.map((r) => ({ ...r, id: 1 })) })).toBeNull()
    expect(normalizeLoungers({ loungers: rows.map((r) => ({ ...r, state: 'mine' })) })).toBeNull()
    expect(normalizeLoungers({ loungers: rows.map((r) => (r.state === 'held' ? { ...r, returnsIn: 0 } : r)) })).toBeNull()
  })
  it('keeps the guest’s own hold and reports on top of the served board', () => {
    const served = rows.map((r, i) => (i === 0 ? { id: 1, state: 'overdue' as const, returnsIn: null } : i === 1 ? { id: 2, state: 'free' as const, returnsIn: null } : r))
    const board = loungerBoard(NOW, { id: 2, start: NOW - 10 * 60_000 }, [1], served)
    expect(board[0]).toEqual({ id: 1, state: 'reported', returnsIn: null })
    expect(board[1]).toEqual({ id: 2, state: 'mine', returnsIn: 30 })
    expect(loungerBoard(NOW, null, [], rows)).toHaveLength(8)
  })
  it('asks per minute', async () => {
    const m = Math.floor(NOW / 60_000)
    loungerFeed.setFetcher(async () => ({ loungers: rows.map((r) => ({ ...r, state: 'free', returnsIn: null })) }))
    expect(await loungerFeed.load(m)).toBe(true)
    expect(loungerFeed.now(m)?.every((r) => r.state === 'free')).toBe(true)
    expect(loungerFeed.now(m + 1)).toBeNull()
  })
})

describe('lost property and sightings feeds', () => {
  it('matches words against the served list', async () => {
    expect(foundFeed.now()).toBeNull()
    const served = [{ id: 'z', what: 'Red umbrella', keywords: ['umbrella'], at: 'eatery' as const }]
    expect(normalizeFound({ items: served })).toEqual(served)
    foundFeed.setFetcher(async () => ({ items: served }))
    await foundFeed.load()
    expect(matchFound({ what: 'my umbrella' }, foundFeed.now() ?? []).map((f) => f.id)).toEqual(['z'])
    expect(matchFound({ what: 'my umbrella' }, [])).toEqual([])
    expect(normalizeFound({ items: [{ ...served[0], at: 'bridge' }] })).toBeNull()
    expect(normalizeFound({ items: [] })).toBeNull()
  })
  it('reads one or two known kinds', () => {
    expect(sightingsFeed.now(3)).toBeNull()
    expect(normalizeSightings({ species: ['whale', 'ray'] })).toEqual(['whale', 'ray'])
    expect(normalizeSightings({ species: ['kraken'] })).toBeNull()
    expect(normalizeSightings({ species: ['ray', 'ray'] })).toBeNull()
    expect(normalizeSightings({ species: [] })).toBeNull()
  })
})

describe('slot watch opening feed', () => {
  const w: Watch = { id: 'w-1', kind: 'dinner', title: 'Dinner', slotAt: NOW + 48 * 3_600_000, priceCents: 0, capCents: 5000, consent: true, createdAt: NOW, current: null, stored: 'active' }
  it('reads a time or none, and refuses anything else', () => {
    expect(normalizeOpening({ opensAt: null })).toEqual({ opensAt: null })
    expect(normalizeOpening({ opensAt: NOW })).toEqual({ opensAt: NOW })
    expect(normalizeOpening({ opensAt: 'soon' })).toBeNull()
    expect(normalizeOpening({ opensAt: -5 })).toBeNull()
    expect(normalizeOpening({})).toBeNull()
  })
  it('lets the server’s opening decide the watch state', async () => {
    expect(openingFeed.now(w.id, w.createdAt, w.slotAt)).toBeNull()
    expect(watchState(w, NOW + 1000, null)).toBe('watching')
    expect(watchState(w, NOW + 3_600_000, NOW + 1000)).toBe('ready')
    expect(watchState({ ...w, priceCents: 9000 }, NOW + 3_600_000, NOW + 1000)).toBe('overCap')
    expect(watchState(w, w.slotAt, NOW + 1000)).toBe('expired')
  })
})
