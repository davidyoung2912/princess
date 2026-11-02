import { describe, expect, it } from 'vitest'
import {
  bookWatch, DEFAULT_PREFS, gentleNotes, newWatch, normalizeWatches, optimiseWeek, simulatedOpening, simWeather, stopWatch, walkMinutes, watchState, weekProblems, type SimWeather, type Watch,
} from './autopilot'
import { applyChanges, type PlanEntry } from './planChange'
import { REFERENCE_SAILING } from './sailings'

const MIN = 60_000
const HOUR = 60 * MIN
const entry = (id: string, start: string, minutes: number, extra: Partial<PlanEntry> = {}): PlanEntry => ({ id, title: id, start, minutes, kind: 'event', outdoor: false, path: '/plan', ...extra })
const calm: SimWeather = { uv: 3, tempF: 72, rainFrom: null, rainTo: null, source: 'sim' }

describe('simulated sky', () => {
  it('is stable, labelled simulated, and sometimes rainy', () => {
    expect(simWeather('x', 3, 'cozumel')).toEqual(simWeather('x', 3, 'cozumel'))
    expect(simWeather('x', 3, 'cozumel').source).toBe('sim')
    const rainy = Array.from({ length: 40 }, (_, i) => simWeather('s', i, 'sea')).filter((w) => w.rainFrom !== null)
    expect(rainy.length).toBeGreaterThan(0)
    expect(rainy.length).toBeLessThan(40)
    expect(rainy.every((w) => w.rainTo !== null)).toBe(true)
  })
})

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

describe('week optimiser', () => {
  it('gives eight days with no crossing items at every pace', () => {
    for (const pace of ['relaxed', 'balanced', 'packed'] as const) {
      const w = optimiseWeek(REFERENCE_SAILING, { ...DEFAULT_PREFS, pace })
      expect(w.days).toHaveLength(8)
      expect(weekProblems(w), pace).toEqual([])
    }
  })

  it('packs more at a higher pace', () => {
    const count = (pace: 'relaxed' | 'balanced' | 'packed') => optimiseWeek(REFERENCE_SAILING, { ...DEFAULT_PREFS, pace }).days.flatMap((d) => d.items).filter((i) => i.kind === 'event').length
    expect(count('relaxed')).toBeLessThan(count('balanced'))
    expect(count('balanced')).toBeLessThanOrEqual(count('packed'))
  })

  it('keeps to the tour budget and adds up the cost', () => {
    const w = optimiseWeek(REFERENCE_SAILING, { ...DEFAULT_PREFS, maxTour: 10_000 })
    expect(w.days.every((d) => d.tourCost <= 10_000)).toBe(true)
    expect(w.totalTours).toBe(w.days.reduce((n, d) => n + d.tourCost, 0))
  })

  it('leaves out early starts when asked and names a rest day', () => {
    const w = optimiseWeek(REFERENCE_SAILING, { ...DEFAULT_PREFS, noEarly: true })
    expect(w.days.flatMap((d) => d.items).filter((i) => i.kind !== 'dinner').every((i) => i.start >= '09:00')).toBe(true)
    const none = optimiseWeek(REFERENCE_SAILING, { ...DEFAULT_PREFS, maxTour: 1 })
    expect(none.days.some((d) => d.restDay)).toBe(true)
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
  const opens = (w: Watch): number => simulatedOpening(w) ?? Number.NaN
  const withOpening = (extra: Partial<Watch> = {}): Watch => {
    for (let i = 0; i < 200; i++) { const w = watch(`w${i}`, extra); if (simulatedOpening(w) !== null) return w }
    throw new Error('no opening found')
  }

  it('opens at a stable time before the slot, and reports it only after that', () => {
    const w = withOpening()
    expect(opens(w)).toBe(simulatedOpening(w))
    expect(opens(w)).toBeLessThan(slotAt)
    expect(watchState(w, opens(w) - 1)).toBe('watching')
    expect(watchState(w, opens(w))).toBe('ready')
  })

  it('tells the guest when it opens above their cap instead of proposing it', () => {
    const w = withOpening({ priceCents: 9000 })
    expect(watchState(w, opens(w))).toBe('overCap')
    expect(bookWatch(w, opens(w))).toEqual({ ok: false })
  })

  it('expires near the slot, books only when ready, and releases a swapped slot in the same step', () => {
    const w = withOpening({ current: { title: 'Sabatini’s', slotAt: slotAt + HOUR } })
    expect(watchState(w, slotAt)).toBe('expired')
    expect(bookWatch(w, opens(w) - 1)).toEqual({ ok: false })
    const booked = bookWatch(w, opens(w))
    expect(booked.ok && booked.watch.stored).toBe('booked')
    expect(booked.ok && booked.release?.title).toBe('Sabatini’s')
    expect(watchState(booked.ok ? booked.watch : w, 0)).toBe('booked')
  })

  it('can be stopped, and stored watches are checked on load', () => {
    expect(watchState(stopWatch(watch('s')), NOW)).toBe('stopped')
    expect(normalizeWatches('x')).toEqual([])
    expect(normalizeWatches([{ id: 1 }, null, watch('ok')])).toHaveLength(1)
    expect(normalizeWatches([{ ...watch('ok'), stored: 'weird' }])[0].stored).toBe('active')
  })
})
