import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { asGuideView } from '../../../shared/api/guards'
import { en } from '../../../shared/i18n/locales/en'
import { JOURNEY_STAGES } from '../../../app/routes/hubs'

/** The task ids are written once, in the server's catalogue; the words for each are the client's, so this keeps the two in step. */
const RULES = readFileSync(new URL('../../../../server/Princess.Api/Domain/GuideRules.cs', import.meta.url), 'utf8')
const ids = [...new Set([...RULES.matchAll(/"((?:dream|discover|book|manage|prebook|getToShip|embark|sea|port|disembark|remember)\.[A-Za-z]+)"/g)].map((m) => m[1]))]

describe('the guide catalogue and its words', () => {
  it('finds the catalogue', () => {
    expect(ids.length).toBeGreaterThan(30)
  })

  it('has a title and a why for every task id', () => {
    const missing = ids.flatMap((id) => [`guide.${id}.title`, `guide.${id}.why`]).filter((k) => !(k in en))
    expect(missing).toEqual([])
  })

  it('has no words for a task the catalogue no longer has', () => {
    const known = new Set(ids)
    const extra = Object.keys(en).filter((k) => /^guide\.[a-zA-Z]+\.[a-zA-Z]+\.(title|why)$/.test(k)).filter((k) => !known.has(k.split('.').slice(1, 3).join('.')))
    expect(extra).toEqual([])
  })

  it('says how every stage moves on', () => {
    expect(JOURNEY_STAGES.filter((s) => !(`guide.moveOn.${s}` in en))).toEqual([])
  })

  it('gives every task a title and why that are plain sentences', () => {
    for (const id of ids) {
      const title = en[`guide.${id}.title` as keyof typeof en] as string
      const why = en[`guide.${id}.why` as keyof typeof en] as string
      expect(title.length).toBeGreaterThan(3)
      expect(why.trim().endsWith('.')).toBe(true)
    }
  })
})

describe('asGuideView', () => {
  const task = { id: 'dream.quiz', stage: 'dream', to: '/home/quiz', state: 'todo', urgency: 'none', urgencyReason: null, due: null, dueSource: null, opensAt: null, minutes: 3, hard: false, optional: false, doneBy: 'visit', blockedBy: null, carriedFrom: null }
  const view = { stage: 'dream', primaryId: 'dream.quiz', tasks: [task], moveOn: { stage: 'dream', date: null }, counts: { done: 0, total: 1, open: 1 } }

  it('accepts a guide as the server sends it', () => {
    const sent = { ...view, hidden: ['prebook.tours'], deferred: [{ id: 'prebook.dining', until: '2026-12-02' }] }
    expect(asGuideView(sent)).toEqual(sent)
  })

  it('reads a copy kept before skip and later existed as having nothing put aside', () => {
    expect(asGuideView(view)).toEqual({ ...view, hidden: [], deferred: [] })
  })

  it('refuses a copy with the wrong shape, an unknown state or a destination that is not an app address', () => {
    expect(asGuideView(null)).toBeNull()
    expect(asGuideView({ ...view, tasks: 'x' })).toBeNull()
    expect(asGuideView({ ...view, tasks: [{ ...task, state: 'maybe' }] })).toBeNull()
    expect(asGuideView({ ...view, tasks: [{ ...task, to: 'https://example.com' }] })).toBeNull()
  })
})
