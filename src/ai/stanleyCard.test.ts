import { describe, expect, it } from 'vitest'
import { t } from '../i18n'
import { SCREEN_LIST } from '../routes/screens'
import { CHIPS, cardText, explainScreenCard, normalizeCard, whyCard } from './stanleyCard'
import { normalizeStanley } from './stanley'

const raw = {
  id: 'dinner', title: 'Your dinners', lines: ['Crown Grill on day 4 at 19:30.', 'Your main dinner is set to late.'], abstained: false,
  links: [{ label: 'Dining', path: '/plan/dining' }, { label: 'Bad', path: 'https://x.test' }],
  provenance: { chips: ['Your booking', 'Not a chip'], owner: 'Your Princess booking', dataTime: '2027-03-05T12:00:00', freshness: 'live', checkWithPerson: false, note: 'Read from your booking when you asked.' },
}

describe('answer cards', () => {
  it('reads the server card, keeps only known chips and in-app links, and takes the data time from the data', () => {
    const c = normalizeCard(raw)!
    expect(c.provenance.chips).toEqual(['Your booking'])
    expect(c.links).toEqual([{ label: 'Dining', path: '/plan/dining' }])
    expect(c.provenance.dataTime).toBe(Date.parse('2027-03-05T12:00:00'))
    expect(c.provenance.freshness).toBe('live')
    expect(cardText(c)).toBe('Your dinners\nCrown Grill on day 4 at 19:30.\nYour main dinner is set to late.')
  })

  it('refuses anything that is not the agreed shape, so plain text is shown instead', () => {
    for (const bad of [null, 'x', {}, { ...raw, lines: [] }, { ...raw, title: '' }, { ...raw, provenance: undefined }, { ...raw, provenance: { ...raw.provenance, freshness: 'fresh' } }])
      expect(normalizeCard(bad)).toBeNull()
  })

  it('has no data time when the server sends none, and an unreadable one is none', () => {
    expect(normalizeCard({ ...raw, provenance: { ...raw.provenance, dataTime: null } })!.provenance.dataTime).toBeNull()
    expect(normalizeCard({ ...raw, provenance: { ...raw.provenance, dataTime: 'soon' } })!.provenance.dataTime).toBeNull()
  })

  it('carries an abstention and the way to a person', () => {
    const c = normalizeCard({ ...raw, abstained: true, provenance: { ...raw.provenance, chips: [], freshness: 'cached', checkWithPerson: true } })!
    expect(c.abstained).toBe(true)
    expect(c.provenance.checkWithPerson).toBe(true)
  })

  it('knows the five chips the plan names', () => {
    expect([...CHIPS]).toEqual(['Your booking', 'Ship schedule', 'Princess policy', 'Estimated', 'Cached'])
  })

  it('is read from a resolver reply with the tier named', () => {
    const turn = normalizeStanley({ kind: 'answer', text: 'Your dinners\nCrown Grill', tier: 'resolver', source: 'scripted', card: raw })!
    expect(turn.tier).toBe('resolver')
    expect(turn.card?.id).toBe('dinner')
    expect(normalizeStanley({ kind: 'answer', text: 'Hello', tier: 'model' })!.card).toBeNull()
    expect(normalizeStanley({ kind: 'blocked', card: raw })!.card).toBeNull()
  })
})

describe('Explain this screen', () => {
  it('explains every screen from its own authored words, with no data time because it is not live data', () => {
    for (const s of SCREEN_LIST) {
      const c = explainScreenCard(s.id)!
      expect(c.title).toBe(t(s.titleKey))
      expect(c.lines[0]).toBe(t(s.subtextKey))
      expect(c.lines[1]).toBe(t('stanley.explain.screen.next'))
      expect(c.provenance.dataTime).toBeNull()
      expect(c.provenance.freshness).toBe('provisional')
    }
  })
  it('has nothing to say about a page that is not a screen', () => {
    expect(explainScreenCard(undefined)).toBeNull()
    expect(explainScreenCard('nope')).toBeNull()
  })
})

describe('Why am I seeing this?', () => {
  it('gives the fact and the rule for each kind, in words that say it is a rule and not an AI choice', () => {
    for (const kind of ['chip', 'tip', 'suggestion'] as const) {
      const c = whyCard(kind, 'you are on the page "Dining"')
      expect(c.lines[0]).toContain('you are on the page "Dining"')
      expect(c.lines[1]).toContain('The rule:')
      expect(c.provenance.note).toBe(t('stanley.why.note.rule'))
      expect(c.provenance.chips).toEqual([])
    }
  })
})
