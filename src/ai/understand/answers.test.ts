import { describe, expect, it } from 'vitest'
import { DIRECTORY } from '../../domain/menus'
import { EXCURSIONS } from '../../domain/excursions'
import { EVENTS } from '../../domain/program'
import { ITEMS } from '../../domain/catalogue'
import { answerFromData } from './index'
import { readQuestion } from './index'
import { attributeOf } from './answers'
import { conceptsOf } from './understand'

const ask = (q: string, live: Parameters<typeof answerFromData>[2] = null) => answerFromData(q, readQuestion(q, { stage: 'sea', hasBooking: true }), live)
const text = (q: string, live: Parameters<typeof answerFromData>[2] = null) => ask(q, live)?.lines.join(' ') ?? null
const venue = DIRECTORY.find((v) => v.price === 'specialty') ?? DIRECTORY[0]!

describe('direct answers', () => {
  it('answers hours, where and price for a venue from the directory', () => {
    expect(text(`what time does ${venue.name} open`)).toMatch(/open|all day/)
    expect(text(`where is ${venue.name}`)).toMatch(/Deck/)
    expect(text(`how much is ${venue.name}`)).toMatch(/cover charge|included|specialty/)
  })
  it('says the source and never names a model', () => {
    const c = ask(`where is ${venue.name}`)!
    expect(c.provenance.owner).toBe('Ship guide')
    expect(JSON.stringify(c)).not.toMatch(/\bAI\b/)
  })
  it('answers a tour attribute from the excursion record, when there are tours', () => {
    const x = EXCURSIONS[0]
    if (!x) return
    expect(text(`how long is ${x.name}`)).toMatch(/hours/)
    expect(text(`how much is ${x.name}`)).toMatch(/\$/)
  })
  it('answers a show and a service', () => {
    const e = EVENTS.find((x) => x.detail)!
    expect(text(`what is ${e.title}`)).toBe(e.detail)
    const i = ITEMS.find((x) => x.price !== null && x.price > 0)
    if (i) expect(text(`how much is ${i.title}`)).toMatch(/\$/)
  })
  it('gives null, so the server or the pills answer, for a missing attribute, a bare name and a personal question', () => {
    expect(text(venue.name)).toBeNull()
    expect(text(`how much is my bill at ${venue.name}`)).toBeNull()
    expect(text('how much is the weather')).toBeNull()
  })
  it('never answers a live or availability question from static data', () => {
    expect(text(`is ${venue.name} available tonight`)).toBeNull()
    expect(text(`is there a table free at ${venue.name}`)).toBeNull()
    expect(text(`is ${venue.name} full`)).toBeNull()
  })
  it('never answers allergy or diet questions', () => {
    expect(text(`is ${venue.name} gluten free`)).toBeNull()
    expect(text(`I have a nut allergy, where is ${venue.name}`)).toBeNull()
  })
  it('answers "open now" only with the ship clock, and from the venue state', () => {
    const q = `is ${venue.name} open now`
    expect(text(q)).toBeNull()
    expect(text(q, { time: '12:00', day: 'sea', upcoming: [] })).toMatch(/open now|closed now/)
  })
  it('a venue the ship has marked unavailable says so', () => {
    const v = DIRECTORY.find((x) => x.id === venue.id)! as { unavailableSince?: string }
    v.unavailableSince = '2027-01-01T00:00:00Z'
    try { expect(text(`is ${venue.name} open now`, { time: '12:00', day: 'sea', upcoming: [] })).toMatch(/unavailable/) } finally { delete v.unavailableSince }
  })
  it('lists the next events from the live programme, and does nothing without it', () => {
    expect(text('what is on tonight')).toBeNull()
    const live = { time: '18:00', day: 'sea' as const, upcoming: [{ title: 'Trivia', start: '19:00' }, { title: 'Movie', start: '20:00' }] }
    const c = text('what is on tonight', live)
    expect(c).toMatch(/Trivia/)
    expect(c).toMatch(/7:00 PM/)
  })
  it('picks one attribute', () => {
    expect(attributeOf('how long is it', [], conceptsOf('how long is it'))).toBe('duration')
    expect(attributeOf('where is it', ['FIND'], [])).toBe('where')
  })
})
