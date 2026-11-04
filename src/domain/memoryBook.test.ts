import { describe, expect, it } from 'vitest'
import { contactProblem, memoryBook, nextTripText, reflectionProblem, sailAgainGroup, seedNextTrip, sharedReflections, type Contact, type Reflection } from './memoryBook'
import { buildRecap } from './recap'
import { REFERENCE_SAILING as S } from './sailings'
import type { TripEntry } from './tripDiary'
import { packageHindsight } from './wrapped'

const recap = buildRecap({ sailing: S, party: ['Ann'], tours: [], dinners: [], photos: 0 })
const r = (topic: Reflection['topic'], text: string, shared = false): Reflection => ({ id: text, topic, text, shared })
const contact = (name: string, reply: Contact['reply']): Contact => ({ id: name, name, note: '', consent: true, reply, at: 0 })

describe('memory book', () => {
  it('has a page for every day, even without a note, and leaves private reflections out unless asked', () => {
    const b = memoryBook(S, recap, { 2: 'Sea day, good book.' }, [r('cabin', 'Not forward')], false)
    expect(b.filter((s) => s.id.startsWith('day-'))).toHaveLength(8)
    expect(b.find((s) => s.id === 'day-2')!.lines).toContain('Sea day, good book.')
    expect(b.find((s) => s.id === 'day-3')!.lines).toContain('No note for this day.')
    expect(b.some((s) => s.id === 'change')).toBe(false)
    expect(memoryBook(S, recap, {}, [r('cabin', 'Not forward')], true).some((s) => s.id === 'change')).toBe(true)
  })
})

describe('memory book from the diary', () => {
  const e = (day: number, text: string, mood: TripEntry['mood'] = null): TripEntry => ({ id: text, sailingId: S.id, day, at: 0, kind: 'note', text, mood, auto: false, key: '' })
  it('puts the diary lines on their day, with the mood, and drops the empty-day note', () => {
    const b = memoryBook(S, recap, {}, [], false, [e(3, 'Best pastry ever', 'great'), e(3, 'Sunset on deck')])
    expect(b.find((s) => s.id === 'day-3')!.lines).toEqual([expect.any(String), 'Loved it: Best pastry ever', 'Sunset on deck'])
    expect(b.find((s) => s.id === 'day-4')!.lines).toContain('No note for this day.')
  })
  it('keeps the journal note first', () => {
    const b = memoryBook(S, recap, { 2: 'Quiet day.' }, [], false, [e(2, 'Read a book')])
    expect(b.find((s) => s.id === 'day-2')!.lines.slice(1)).toEqual(['Quiet day.', 'Read a book'])
  })
})

describe('what I would change', () => {
  it('checks topic, text and the limit', () => {
    expect(reflectionProblem('nope', 'x', [])).toBe('topic')
    expect(reflectionProblem('cabin', '  ', [])).toBe('text')
    expect(reflectionProblem('cabin', 'x'.repeat(301), [])).toBe('text')
    expect(reflectionProblem('cabin', 'ok', Array.from({ length: 12 }, (_, i) => r('port', String(i))))).toBe('tooMany')
    expect(reflectionProblem('cabin', 'ok', [])).toBeNull()
  })
  it('shares only what was marked shared, without a cabin number', () => {
    expect(sharedReflections([r('cabin', 'private')])).toBe('')
    const t = sharedReflections([r('cabin', 'Cabin 10123 was loud', true), r('port', 'hidden')])
    expect(t).toContain('my cabin was loud')
    expect(t).not.toMatch(/hidden|10123/)
  })
})

describe('seeded next trip', () => {
  const input = { sailing: S, category: 'balcony', fare: 'plus', guests: 2, tourNames: ['A', 'B', 'C'], favouriteMeal: 'Sabatini', hindsight: null, reflections: [r('cabin', 'Go midship')], lastDay: '2027-03-28' } as const
  it('is a draft, never booked, after the gap, carrying the lessons', () => {
    const n = seedNextTrip(input)!
    expect(n.status).toBe('draft')
    expect(n.departure >= '2027-04-11').toBe(true)
    expect(n.priceWatch).toBe(true)
    expect(n.repeat).toEqual(['Ashore again: A', 'Ashore again: B', 'Dinner at Sabatini'])
    expect(n.lessons).toContain('Cabin: Go midship')
    expect(nextTripText(n)).toMatch(/not booked/)
  })
  it('drops a package that did not pay for itself and keeps one that did', () => {
    const lost = packageHindsight({ paid: 100_000, drinks: 1, specialtyDinners: 0, wifiNights: 0, wifiNight: 2000, otherFarePaid: null })
    const won = packageHindsight({ paid: 100_000, drinks: 120, specialtyDinners: 0, wifiNights: 0, wifiNight: 2000, otherFarePaid: null })
    expect(seedNextTrip({ ...input, hindsight: lost })!.fare).toBe('standard')
    expect(seedNextTrip({ ...input, hindsight: won })!.fare).toBe('plus')
  })
  it('has nothing to offer when no later departure exists', () => {
    expect(seedNextTrip({ ...input, lastDay: '2031-01-01' })).toBeNull()
  })
})

describe('stay in touch', () => {
  it('needs a first name, consent, no contact details, and refuses a blocked or repeated person', () => {
    expect(contactProblem('', '', true, [], [])).toBe('name')
    expect(contactProblem('sam@x.com', '', true, [], [])).toBe('name')
    expect(contactProblem('Sam', 'call 5551234567', true, [], [])).toBe('note')
    expect(contactProblem('Sam', '', false, [], [])).toBe('consent')
    expect(contactProblem('sam', '', true, [], ['Sam'])).toBe('blocked')
    expect(contactProblem('Sam', '', true, [contact('sam', 'waiting')], [])).toBe('duplicate')
    expect(contactProblem('Sam', 'We met at trivia', true, [], [])).toBeNull()
  })
  it('makes a group only from accepted contacts with a drafted trip', () => {
    const next = seedNextTrip({ sailing: S, category: 'balcony', fare: 'plus', guests: 2, tourNames: [], favouriteMeal: null, hindsight: null, reflections: [], lastDay: '2027-03-28' })
    const list = [contact('A', 'accepted'), contact('B', 'waiting'), contact('C', 'declined')]
    expect(sailAgainGroup(list, next)).toEqual(['A'])
    expect(sailAgainGroup(list, null)).toEqual([])
  })
})
