import { describe, expect, it } from 'vitest'
import { EMPTY_ACCESS } from '../domain/bookingPrep'
import { appendTranscript, cardSpeech, dayPlanCard, pocketCard, speakable, voiceSupport, POCKET_FACTS, type PocketInput } from './stanleyVoice'
import type { StanleyCard } from './stanleyCard'

const card = (id: string, over: Partial<StanleyCard> = {}): StanleyCard => ({
  id, title: `T${id}`, lines: ['a', 'b', 'c', 'd'], abstained: false, links: [],
  provenance: { chips: [], source: '', owner: '', dataTime: null, freshness: 'live', checkWithPerson: false, note: '' } as unknown as StanleyCard['provenance'], ...over,
})
const words = { facts: 'F', contacts: 'C', guest: 'Guest services', emergency: 'Emergency', needs: 'Needs', allergy: 'Allergies', step: 'Step-free', wheels: 'Wheelchair', none: 'None kept', foot: 'Check with a person' }
const base = (over: Partial<PocketInput> = {}): PocketInput => ({ title: 'Pocket', subtitle: 'Ship', facts: [], access: EMPTY_ACCESS, allergy: { items: [], at: null }, words, ...over })

describe('voice support', () => {
  it('reads what the window offers, and nothing when there is no window', () => {
    expect(voiceSupport(undefined)).toEqual({ listen: false, speak: false })
    expect(voiceSupport({ webkitSpeechRecognition: function R() {}, speechSynthesis: {} })).toEqual({ listen: true, speak: true })
    expect(voiceSupport({ speechSynthesis: {} })).toEqual({ listen: false, speak: true })
  })
})

describe('appendTranscript', () => {
  it('joins with one space, ignores blanks and respects the limit', () => {
    expect(appendTranscript('', '  hello   there ', 50)).toBe('hello there')
    expect(appendTranscript('Where is ', 'the pool', 50)).toBe('Where is the pool')
    expect(appendTranscript('abc', '   ', 50)).toBe('abc')
    expect(appendTranscript('abc', 'defghi', 6)).toBe('abc de')
  })
})

describe('speakable', () => {
  it('drops addresses and marks, and ends each line with a pause', () => {
    expect(speakable('**Dinner** at 7\nSee https://x.test/a now')).toBe('Dinner at 7. See now.')
    expect(speakable('Already done.\n\n')).toBe('Already done.')
  })
  it('says when a card could not confirm or is a saved copy', () => {
    const n = { abstained: 'I cannot confirm this.', cached: 'This is a saved copy.' }
    expect(cardSpeech(card('1', { abstained: true }), n)).toContain('cannot confirm')
    expect(cardSpeech(card('2', { provenance: { ...card('2').provenance, freshness: 'cached' } }), n)).toContain('saved copy')
    expect(cardSpeech(card('3'), n)).not.toContain('saved')
  })
})

describe('pocketCard', () => {
  it('puts facts first, then contacts and needs, and stays one page', () => {
    const many = Array.from({ length: 9 }, (_, i) => card(String(i)))
    const c = pocketCard(base({ facts: many }))
    expect(c.lines).toHaveLength(POCKET_FACTS + 3)
    expect(c.lines[0]).toBe('T0: a; b; c')
    expect(c.lines.at(-3)).toContain('Guest services: ')
    expect(c.lines.at(-1)).toBe('Needs: None kept')
    expect(c.footer).toBe('Check with a person')
  })
  it('leaves out a card that could not confirm', () => {
    expect(pocketCard(base({ facts: [card('1', { abstained: true })] })).lines).toHaveLength(3)
  })
  it('prints only the needs the guest chose to keep', () => {
    const c = pocketCard(base({ access: { ...EMPTY_ACCESS, device: 'wheelchair' }, allergy: { items: ['Peanut', 'Shellfish'], at: 1 } }), true)
    expect(c.lines.at(-1)).toBe('Needs: Wheelchair; Allergies: Peanut, Shellfish')
    expect(c.large).toBe(true)
  })
})

describe('dayPlanCard', () => {
  const w = { empty: 'Nothing planned.', waiting: 'Your day has not loaded.', foot: 'Plans can change.' }
  const row = (state: string, start: string, title: string) => ({ state, entry: { start, title } })
  it('lists the day in time order without dropped items, in large print by default', () => {
    const c = dayPlanCard({ title: 'Today', subtitle: 'Day 2', ready: true, words: w, rows: [row('kept', '19:00', 'Dinner'), row('dropped', '10:00', 'Quiz'), row('kept', '09:00', 'Tour')] })
    expect(c.lines).toEqual(['09:00  Tour', '19:00  Dinner'])
    expect(c.large).toBe(true)
  })
  it('never shows an unloaded day as a free one', () => {
    expect(dayPlanCard({ title: 'T', subtitle: '', ready: false, words: w, rows: [] }).lines).toEqual(['Your day has not loaded.'])
    expect(dayPlanCard({ title: 'T', subtitle: '', ready: true, words: w, rows: [] }).lines).toEqual(['Nothing planned.'])
  })
})
