import { describe, expect, it } from 'vitest'
import { buildReel, reelText, REEL_SLIDES_MAX, slideSeconds } from './highlightReel'
import { buildRecap } from './recap'
import { itinerary, REFERENCE_SAILING as S } from './sailings'
import type { TripEntry } from './tripDiary'
import { bestMoment, buildWrapped, cardText, extraCards, type WrappedExtras } from './wrapped'

const recap = buildRecap({ sailing: S, party: ['Ann'], tours: [], dinners: ['sabatini', 'sabatini'], photos: 3 })
const e = (day: number, text: string, o: Partial<TripEntry> = {}): TripEntry => ({ id: text, sailingId: S.id, day, at: day, kind: 'note', text, mood: null, auto: false, key: '', ...o })
const extras = (o: Partial<WrappedExtras> = {}): WrappedExtras => ({ steps: {}, sightings: 0, diary: [], ...o })

describe('Wrapped from the trip record', () => {
  it('adds nothing without a record, and leaves empty cards out', () => {
    expect(buildWrapped(recap, undefined, extras())).toEqual(buildWrapped(recap))
    expect(extraCards(extras({ steps: { '1': 0 } }))).toEqual([])
  })
  it('adds steps with the best day, sightings and the diary count', () => {
    const cards = extraCards(extras({ steps: { '1': 4000, '3': 9000 }, sightings: 2, diary: [e(2, 'Lovely', { mood: 'great' }), e(2, 'again', { mood: 'great' }), e(3, 'auto line', { auto: true })] }))
    expect(cards.map((c) => c.id)).toEqual(['steps', 'sightings', 'diary'])
    expect(cards[0]).toMatchObject({ big: '13,000' })
    expect(cards[0].line).toContain('day 3')
    expect(cards[2].big).toBe('2')
    expect(cards[2].line).toContain('1 day you loved')
  })
  it('never puts the guest\'s own words in a card', () => {
    const text = extraCards(extras({ diary: [e(2, 'Ann cried at the sunset', { mood: 'great' })], steps: { '1': 10 }, sightings: 1 })).map(cardText).join(' ')
    expect(text).not.toMatch(/Ann|sunset/)
  })
  it('finds the latest "Loved it" line of the guest\'s own, ignoring app lines', () => {
    expect(bestMoment([e(1, 'a', { mood: 'great' }), e(4, 'b', { mood: 'great' }), e(5, 'c', { mood: 'great', auto: true })])?.text).toBe('b')
    expect(bestMoment([e(1, 'a')])).toBeNull()
  })
})

describe('highlight reel', () => {
  const cards = buildWrapped(recap, undefined, extras({ steps: { '2': 5000 } }))
  it('opens and closes, visits the ports in between, and stays within the limit', () => {
    const slides = buildReel(S, recap, cards, [])
    expect(slides[0].id).toBe('open')
    expect(slides[slides.length - 1].id).toBe('close')
    const ports = itinerary(S).filter((d) => d.port !== 'sea').length
    expect(slides.filter((s) => s.id.startsWith('port-')).length).toBeLessThan(ports)
    expect(slides.length).toBeLessThanOrEqual(REEL_SLIDES_MAX)
  })
  it('uses the guest\'s own line for a port day, and leaves it out of the share', () => {
    const port = itinerary(S).find((d, i) => d.port !== 'sea' && i > 0 && i < itinerary(S).length - 1)!
    const slides = buildReel(S, recap, cards, [e(port.day, 'Secret sunset', { mood: 'great' })])
    expect(slides.find((s) => s.id === `port-${port.port}`)).toMatchObject({ line: 'Secret sunset', personal: true })
    expect(slides.some((s) => s.id === 'best')).toBe(true)
    expect(reelText(slides)).not.toContain('Secret sunset')
    expect(reelText(slides)).toContain(recap.title)
  })
  it('times the slides to about 45 seconds, between 3 and 6 each', () => {
    expect(slideSeconds(9)).toBe(5)
    expect(slideSeconds(3)).toBe(6)
    expect(slideSeconds(40)).toBe(3)
    expect(slideSeconds(0)).toBe(0)
  })
})
