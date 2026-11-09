import { describe, expect, it } from 'vitest'
import { t } from '../i18n'
import { whyCard } from '../ai/stanleyCard'
import { asSaved, normalizeFacts } from './stanleyFacts'

const card = (id: string, extra: object = {}) => ({
  id, title: 'Your dinners', lines: ['Crown Grill on day 4 at 19:30.'], abstained: false, links: [],
  provenance: { chips: ['Your booking'], owner: 'Your Princess booking', dataTime: '2027-03-05T12:00:00', freshness: 'live', checkWithPerson: false, note: 'Read from your booking when you asked.' }, ...extra,
})

describe('saved trip facts', () => {
  it('reads a list of cards and drops anything that is not one', () => {
    const facts = normalizeFacts({ cards: [card('dinner'), { id: 'bad' }, card('tours')] })!
    expect(facts.map((c) => c.id)).toEqual(['dinner', 'tours'])
  })
  it('ignores a reply that is not a list, and an empty trip is an empty list', () => {
    expect(normalizeFacts(null)).toBeNull()
    expect(normalizeFacts({ cards: 'x' })).toBeNull()
    expect(normalizeFacts({ cards: [] })).toEqual([])
  })
  it('shows a saved card as cached, with the route to a person, and keeps the time the booking was read', () => {
    const saved = asSaved(normalizeFacts({ cards: [card('dinner')] })![0]!, t('stanley.offline.note'))
    expect(saved.provenance.chips).toEqual(['Your booking', 'Cached'])
    expect(saved.provenance.freshness).toBe('cached')
    expect(saved.provenance.checkWithPerson).toBe(true)
    expect(saved.provenance.dataTime).toBe(Date.parse('2027-03-05T12:00:00'))
    expect(asSaved(saved, 'x').provenance.chips).toEqual(['Your booking', 'Cached'])
  })
})

describe('Why am I seeing this? for a moment and the diary prompt', () => {
  it('states a fact and a rule for each', () => {
    for (const kind of ['moment', 'story'] as const) {
      const c = whyCard(kind, t(`stanley.why.fact.${kind}` as never))
      expect(c.lines[0]).toContain(t(`stanley.why.fact.${kind}` as never))
      expect(c.lines[1]).toMatch(/^The rule:/)
    }
  })
})
