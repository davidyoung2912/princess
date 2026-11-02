import { describe, expect, it } from 'vitest'
import {
  bookWatch, gentleNotes, newWatch, normalizeWatches, stopWatch, walkMinutes, watchState, type SimWeather, type Watch,
} from './autopilot'
import { applyChanges, type PlanEntry } from './planChange'

const MIN = 60_000
const HOUR = 60 * MIN
const entry = (id: string, start: string, minutes: number, extra: Partial<PlanEntry> = {}): PlanEntry => ({ id, title: id, start, minutes, kind: 'event', outdoor: false, path: '/plan', ...extra })
const calm: SimWeather = { uv: 3, tempF: 72, rainFrom: null, rainTo: null, source: 'sim' }

describe('gentle mode', () => {
  const rows = (list: PlanEntry[]) => applyChanges(list, [])
  it('reminds about water and sun before a hot, bright outdoor item', () => {
    const notes = gentleNotes(rows([entry('pool', '13:00', 60, { outdoor: true })]), { ...calm, tempF: 90, uv: 10 })
    expect(notes.map((n) => n.kind).sort()).toEqual(['sun', 'water'])
    expect(gentleNotes(rows([entry('pool', '13:00', 60, { outdoor: true })]), calm)).toEqual([])
  })

  it('adds a rest after three items close together, but not around dinner', () => {
    const three = [entry('a', '10:00', 45), entry('b', '11:00', 45), entry('c', '12:00', 45)]
    expect(gentleNotes(rows(three), calm).filter((n) => n.kind === 'rest')).toEqual([{ kind: 'rest', at: '11:45', about: 'c' }])
    const withDinner = [entry('a', '17:00', 45), entry('d', '18:00', 90, { kind: 'dinner' }), entry('c', '19:45', 45)]
    expect(gentleNotes(rows(withDinner), calm).filter((n) => n.kind === 'rest')).toEqual([])
  })

  it('warns about a long walk with little time, and walks are zero in one place', () => {
    expect(walkMinutes('lido-pool', 'lido-pool')).toBe(0)
    expect(walkMinutes('lido-pool', 'soleil')).toBeGreaterThanOrEqual(8)
    const tight = [entry('a', '10:00', 60, { placeId: 'lido-pool' }), entry('b', '11:05', 30, { placeId: 'soleil' })]
    expect(gentleNotes(rows(tight), calm).some((n) => n.kind === 'walk')).toBe(true)
  })
})

describe('slot watch', () => {
  const NOW = 10 * HOUR
  const slotAt = NOW + 48 * HOUR
  const base = { id: 'w1', kind: 'dinner' as const, title: 'Crown Grill', slotAt, priceCents: 5500, capCents: 6000, consent: true, createdAt: NOW, current: null }

  it('needs consent, a cap, a title and a slot still ahead', () => {
    expect(newWatch({ ...base, consent: false }, NOW)).toEqual({ ok: false, problem: 'consent' })
    expect(newWatch({ ...base, capCents: 0 }, NOW)).toEqual({ ok: false, problem: 'cap' })
    expect(newWatch({ ...base, title: '  ' }, NOW)).toEqual({ ok: false, problem: 'title' })
    expect(newWatch({ ...base, slotAt: NOW + 10 * MIN }, NOW)).toEqual({ ok: false, problem: 'time' })
    expect(newWatch(base, NOW).ok).toBe(true)
  })

  const watch = (id: string, extra: Partial<Watch> = {}): Watch => {
    const w = newWatch({ ...base, id, ...extra }, NOW)
    if (!w.ok) throw new Error('bad')
    return w.watch
  }
  /** The moment the server says the place opens: the tests hand it in, as the screen does from the feed. */
  const OPENS = slotAt - 6 * HOUR
  const withOpening = (extra: Partial<Watch> = {}): Watch => watch('w1', extra)

  it('reports an opening only after the server says it has happened', () => {
    const w = withOpening()
    expect(OPENS).toBeLessThan(slotAt)
    expect(watchState(w, OPENS - 1, null)).toBe('watching')
    expect(watchState(w, OPENS + 1, null)).toBe('watching')
    expect(watchState(w, OPENS - 1, OPENS)).toBe('watching')
    expect(watchState(w, OPENS, OPENS)).toBe('ready')
  })

  it('tells the guest when it opens above their cap instead of proposing it', () => {
    const w = withOpening({ priceCents: 9000 })
    expect(watchState(w, OPENS, OPENS)).toBe('overCap')
    expect(bookWatch(w, OPENS, OPENS)).toEqual({ ok: false })
  })

  it('expires near the slot, books only when ready, and releases a swapped slot in the same step', () => {
    const w = withOpening({ current: { title: 'Sabatini’s', slotAt: slotAt + HOUR } })
    expect(watchState(w, slotAt, OPENS)).toBe('expired')
    expect(bookWatch(w, OPENS - 1, OPENS)).toEqual({ ok: false })
    const booked = bookWatch(w, OPENS, OPENS)
    expect(booked.ok && booked.watch.stored).toBe('booked')
    expect(booked.ok && booked.release?.title).toBe('Sabatini’s')
    expect(watchState(booked.ok ? booked.watch : w, 0, OPENS)).toBe('booked')
  })

  it('can be stopped, and stored watches are checked on load', () => {
    expect(watchState(stopWatch(watch('s')), NOW, null)).toBe('stopped')
    expect(normalizeWatches('x')).toEqual([])
    expect(normalizeWatches([{ id: 1 }, null, watch('ok')])).toHaveLength(1)
    expect(normalizeWatches([{ ...watch('ok'), stored: 'weird' }])[0].stored).toBe('active')
  })
})
