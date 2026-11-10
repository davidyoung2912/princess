import { describe, expect, it } from 'vitest'
import { LIBRARY, PAGE_QA } from './stanleyLibrary'
import { REVIEWED_ON } from './stanleyLibrary/governance'
import { costDashboard, cardExpired, deviceSignals, expiresInMs, normalizeTierSummary, reviewItems, staleReport, SUGGESTION_MINUTES, TIP_MINUTES, type TierRow } from './stanleyOps'
import type { TierCounts } from '../diagnostics/stanleyTiers'

const DAY = 86_400_000
const at = (iso: string): number => Date.parse(`${iso}T12:00:00Z`)
const row = (o: Partial<TierRow>): TierRow => ({ tier: 'trip', source: '', stage: 'sea', topic: 'x', outcome: 'ok', modelTier: '', replies: 1, calls: 0, inputTokens: 0, outputTokens: 0, ...o })
const counts = (o: Partial<TierCounts>): TierCounts => ({ library: 0, ship: 0, trip: 0, before: 0, model: 0, handoff: 0, unanswered: 0, ...o })
const sum = (rows: TierRow[]) => ({ since: '', replies: 0, modelCalls: 0, inputTokens: 0, outputTokens: 0, rows })

describe('review workflow', () => {
  it('lists every authored entry once, with an owner and a due date', () => {
    const items = reviewItems(at(REVIEWED_ON))
    expect(items).toHaveLength(LIBRARY.length + PAGE_QA.length)
    expect(items.every((i) => i.owner.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(i.expiresOn))).toBe(true)
  })

  it('has nothing overdue on the review day, and everything overdue long after', () => {
    expect(reviewItems(at(REVIEWED_ON)).filter((i) => i.status === 'overdue')).toEqual([])
    expect(reviewItems(at(REVIEWED_ON) + 800 * DAY).every((i) => i.status === 'overdue')).toBe(true)
  })

  it('shows high-risk entries (6 months) as due first', () => {
    const all = staleReport(at(REVIEWED_ON) + 150 * DAY).flatMap((o) => o.items)
    expect(all.length).toBeGreaterThan(0)
    expect(all.every((i) => i.risk === 'high' && i.status === 'due')).toBe(true)
  })

  it('groups by owner, the busiest first, soonest expiry first inside a group', () => {
    const report = staleReport(at(REVIEWED_ON) + 800 * DAY)
    for (let i = 1; i < report.length; i++) expect(report[i - 1].overdue).toBeGreaterThanOrEqual(report[i].overdue)
    for (const o of report) for (let i = 1; i < o.items.length; i++) expect(o.items[i - 1].daysLeft).toBeLessThanOrEqual(o.items[i].daysLeft)
  })
})

describe('device signals', () => {
  it('reports the unanswered share, repeats and the no-model share; none before anything is counted', () => {
    expect(deviceSignals(counts({}), {})).toEqual({ unansweredShare: null, repeats: [], noModelShare: null })
    const s = deviceSignals(counts({ library: 6, ship: 2, model: 1, unanswered: 1 }), { 'library:a.b': 3, 'ship:x': 1 })
    expect(s.unansweredShare).toBe(10)
    expect(s.noModelShare).toBe(89)
    expect(s.repeats).toEqual([{ id: 'library:a.b', count: 3 }])
  })
})

describe('cost dashboard', () => {
  it('measures the tier mix against the decision 6 targets', () => {
    const d = costDashboard(sum([
      row({ replies: 70 }), row({ tier: 'model', replies: 25, calls: 25, modelTier: 'small', inputTokens: 2500, outputTokens: 500 }), row({ tier: 'model', replies: 5, calls: 5, modelTier: 'large', inputTokens: 1000, outputTokens: 500 }),
    ]))
    expect(d.replies).toBe(100)
    expect(d.noModelPercent).toBe(70)
    expect(d.largePercent).toBe(5)
    expect(d.meetsNoModel).toBe(true)
    expect(d.meetsLarge).toBe(true)
    expect(d.tokensPerResolved).toBe(45)
  })

  it('fails the targets when too much needs a model or the large tier', () => {
    const d = costDashboard(sum([row({ replies: 50 }), row({ tier: 'model', replies: 40, calls: 40, modelTier: 'default' }), row({ tier: 'model', replies: 10, calls: 10, modelTier: 'large' })]))
    expect(d.meetsNoModel).toBe(false)
    expect(d.meetsLarge).toBe(false)
  })

  it('does not count a handed-off, blocked or failed reply as resolved, and reports handoffs and failures', () => {
    const d = costDashboard(sum([row({ replies: 6 }), row({ tier: 'handoff', replies: 2 }), row({ tier: 'blocked', outcome: 'blocked', replies: 1 }), row({ tier: 'model', outcome: 'limit', replies: 1 })]))
    expect(d.handoffPercent).toBe(20)
    expect(d.failedPercent).toBe(10)
  })

  it('says nothing before any reply', () => {
    expect(costDashboard(sum([]))).toMatchObject({ replies: 0, noModelPercent: null, largePercent: null, tokensPerResolved: null, meetsNoModel: null, meetsLarge: null })
  })

  it('reads the server summary defensively', () => {
    expect(normalizeTierSummary(null)).toBeNull()
    expect(normalizeTierSummary({ rows: 'x' })).toBeNull()
    const s = normalizeTierSummary({ since: '2026-11-01', rows: [{ tier: 'model', replies: 3, calls: 3, inputTokens: -5, outputTokens: 'x', extra: 'ignored' }, 7] })
    expect(s?.rows).toHaveLength(1)
    expect(s?.rows[0]).toMatchObject({ tier: 'model', replies: 3, inputTokens: 0, outputTokens: 0 })
  })
})

describe('stale-tip expiry', () => {
  const card = { critical: false, tip: false, fingerprint: 'a' }
  it('times a suggestion out after its minutes, and a quiet tip sooner', () => {
    expect(cardExpired(card, 0, (SUGGESTION_MINUTES - 1) * 60_000)).toBe(false)
    expect(cardExpired(card, 0, SUGGESTION_MINUTES * 60_000)).toBe(true)
    expect(cardExpired({ ...card, tip: true }, 0, TIP_MINUTES * 60_000)).toBe(true)
    expect(TIP_MINUTES).toBeLessThan(SUGGESTION_MINUTES)
  })
  it('expires at once when the facts behind it change', () => {
    expect(cardExpired(card, 0, 1000, { fingerprint: 'a' })).toBe(false)
    expect(cardExpired(card, 0, 1000, { fingerprint: 'b' })).toBe(true)
  })
  it('never expires an alert', () => {
    const alert = { critical: true, tip: false, fingerprint: 'a' }
    expect(cardExpired(alert, 0, 100 * DAY, { fingerprint: 'b' })).toBe(false)
    expect(expiresInMs(alert, 0, 0)).toBeNull()
  })
  it('says how long is left, never below zero', () => {
    expect(expiresInMs(card, 0, 60_000)).toBe((SUGGESTION_MINUTES - 1) * 60_000)
    expect(expiresInMs(card, 0, 100 * DAY)).toBe(0)
  })
})
