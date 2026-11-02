import { describe, expect, it } from 'vitest'
import { DISRUPTIONS } from './disruption'
import { addDebrief, awaitingDebrief, callbackStatus, CALLBACK_LIFETIME_MS, familyNotices, featuredGuide, GUIDES, hubFor, hubItems, knockOnCounts, needsHumanReview, normalizeCallback, normalizeDebriefs, orderedGuides, queueEstimate, requestCallback } from './disruptionHub'
import { en } from '../i18n/en'

describe('disruption hub', () => {
  it('has hub detail, in English, for every disruption', () => {
    for (const d of DISRUPTIONS) {
      const h = hubFor(d.id)!
      expect(h, d.id).toBeDefined()
      const keys = [h.meaning, h.next, ...h.done, ...h.knockOns.flatMap((k) => [k.item, k.detail]), ...(h.compensation ? Object.values(h.compensation) : []), ...(h.familyNotice ? [h.familyNotice] : [])]
      for (const k of keys) expect(en[k as keyof typeof en], k).toBeTruthy()
      expect(h.done.length, `${d.id} says what was already done`).toBeGreaterThan(0)
    }
  })
  it('shows the knock-on results already settled, never pending (XD-02)', () => {
    const counts = knockOnCounts(hubFor('portSkipped')!.knockOns)
    expect(counts).toEqual({ refunded: 1, moved: 1, cancelled: 1, kept: 0 })
    expect(knockOnCounts([])).toEqual({ refunded: 0, moved: 0, cancelled: 0, kept: 0 })
  })
  it('says what compensation is given, when and what to do, or that none applies (XD-03)', () => {
    expect(hubFor('portSkipped')!.compensation).not.toBeNull()
    expect(hubFor('illness')!.compensation).toBeNull()
  })
  it('lists active disruptions most serious first and ignores unknown ones', () => {
    expect(hubItems(['planChange', 'portSkipped', 'nope']).map((i) => i.def.id)).toEqual(['portSkipped', 'planChange'])
    expect(hubItems([])).toEqual([])
  })
  it('gives family notices only for changes that touch the whole ship (XD-07)', () => {
    expect(familyNotices(['portSkipped', 'clockChange'])).toEqual(['hub.portSkipped.family'])
    expect(familyNotices(['planChange'])).toEqual([])
  })
  it('has a guide for stranded, lost phone, outage and health, features health during an illness notice', () => {
    expect(GUIDES.map((g) => g.id)).toEqual(['stranded', 'lostPhone', 'outage', 'health'])
    for (const g of GUIDES) for (const k of [g.title, ...g.steps]) expect(en[k as keyof typeof en], k).toBeTruthy()
    expect(featuredGuide(['illness'])).toBe('health')
    expect(featuredGuide([])).toBeNull()
    expect(orderedGuides(['illness'])[0].id).toBe('health')
    expect(orderedGuides([]).map((g) => g.id)).toEqual(['stranded', 'lostPhone', 'outage', 'health'])
  })
})

describe('callback queue', () => {
  it('gives the same place for the same inputs, between 1 and 6, four minutes a place', () => {
    for (let t = 0; t < 40; t++) {
      const q = queueEstimate(t * 300_000, 7)
      expect(q).toEqual(queueEstimate(t * 300_000, 7))
      expect(q.position).toBeGreaterThanOrEqual(1)
      expect(q.position).toBeLessThanOrEqual(6)
      expect(q.waitMinutes).toBe(q.position * 4)
    }
  })
  it('counts down, comes due, then lapses after two hours', () => {
    const c = requestCallback(1_000_000, 'changes', 3, 'c1')
    expect(c.source).toBe('sim')
    const s = callbackStatus(c, c.at)
    expect(s.kind).toBe('waiting')
    if (s.kind === 'waiting') expect(s.minutes).toBe(c.position * 4)
    expect(callbackStatus(c, c.readyAt).kind).toBe('due')
    expect(callbackStatus(c, c.at + CALLBACK_LIFETIME_MS).kind).toBe('lapsed')
  })
  it('never says zero minutes while still waiting', () => {
    const c = requestCallback(0, 'urgent', 1, 'c')
    const s = callbackStatus(c, c.readyAt - 1)
    expect(s.kind === 'waiting' && s.minutes).toBe(1)
  })
  it('reads a saved request and drops a bad one', () => {
    const c = requestCallback(5, 'other', 1, 'x')
    expect(normalizeCallback(JSON.parse(JSON.stringify(c)))).toEqual(c)
    expect(normalizeCallback({ ...c, reason: 'bogus' })).toBeNull()
    expect(normalizeCallback({ ...c, at: 'soon' })).toBeNull()
    expect(normalizeCallback(null)).toBeNull()
  })
})

describe('follow-up after a disruption', () => {
  it('asks once per ended disruption and a poor answer goes to a person (XD-10)', () => {
    expect(awaitingDebrief(['portSkipped', 'nope'], [])).toEqual(['portSkipped'])
    const list = addDebrief([], 'portSkipped', 'poor', '  not good  ', 5)
    expect(awaitingDebrief(['portSkipped'], list)).toEqual([])
    expect(list[0].note).toBe('not good')
    expect(needsHumanReview(list[0])).toBe(true)
    expect(needsHumanReview(addDebrief([], 'illness', 'good', '', 1)[0])).toBe(false)
  })
  it('replaces an earlier answer and limits the note', () => {
    const first = addDebrief([], 'illness', 'ok', '', 1)
    const second = addDebrief(first, 'illness', 'good', 'x'.repeat(500), 2)
    expect(second).toHaveLength(1)
    expect(second[0].note).toHaveLength(280)
  })
  it('reads saved answers and drops bad ones', () => {
    expect(normalizeDebriefs([{ id: 'illness', rating: 'good', at: 1 }, { id: 'nope', rating: 'good', at: 1 }, { id: 'illness', rating: 'meh', at: 1 }, 4, null])).toEqual([{ id: 'illness', rating: 'good', note: '', at: 1 }])
    expect(normalizeDebriefs('x')).toEqual([])
  })
})
