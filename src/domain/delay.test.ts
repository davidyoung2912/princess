import { describe, expect, it } from 'vitest'
import { claimRecord, delayNextSteps, delayVisibleToOthers, EMPTY_DELAY, expectedArrival, MAX_DELAY_HISTORY, nextDeadline, normalizeDelay, reportDelay, resolveDelay, setShareEta } from './delay'
import { REFERENCE_SAILING, itinerary, allAboardEpoch } from './sailings'
import { en } from '../i18n/en'

const input = { reason: 'traffic' as const, lateMinutes: 30, note: ' stuck ', tellParty: true }

describe('delay', () => {
  it('tells the line always and the party only when asked (S4A-03)', () => {
    expect(reportDelay(EMPTY_DELAY, input, 10, 'a').current?.told).toEqual(['line', 'party'])
    expect(reportDelay(EMPTY_DELAY, { ...input, tellParty: false }, 10, 'a').current?.told).toEqual(['line'])
  })
  it('keeps a clean record and bounds minutes and note', () => {
    const r = reportDelay(EMPTY_DELAY, { ...input, lateMinutes: 99999, note: 'x'.repeat(500) }, 10, 'a').current!
    expect(r.lateMinutes).toBe(480)
    expect(r.note).toHaveLength(200)
    expect(reportDelay(EMPTY_DELAY, { ...input, lateMinutes: -4 }, 10, 'a').current?.lateMinutes).toBe(5)
    expect(reportDelay(EMPTY_DELAY, input, 10, 'a').current?.note).toBe('stuck')
  })
  it('moves an earlier delay to the history and keeps the record after arriving', () => {
    const one = reportDelay(EMPTY_DELAY, input, 10, 'a')
    const two = reportDelay(one, input, 20, 'b')
    expect(two.history.map((h) => h.id)).toEqual(['a'])
    const done = resolveDelay(two, 30)
    expect(done.current).toBeNull()
    expect(done.history[0]).toMatchObject({ id: 'b', resolvedAt: 30 })
    expect(resolveDelay(EMPTY_DELAY, 1)).toBe(EMPTY_DELAY)
  })
  it('bounds the history', () => {
    let s = EMPTY_DELAY
    for (let i = 0; i < 30; i++) s = resolveDelay(reportDelay(s, input, i, `d${i}`), i + 1)
    expect(s.history).toHaveLength(MAX_DELAY_HISTORY)
  })
  it('shows the flag to others only when told, shared and open (S4A-08)', () => {
    const open = reportDelay(EMPTY_DELAY, input, 1, 'a')
    expect(delayVisibleToOthers(open)).toBe(true)
    expect(delayVisibleToOthers(setShareEta(open, false))).toBe(false)
    expect(delayVisibleToOthers(reportDelay(EMPTY_DELAY, { ...input, tellParty: false }, 1, 'a'))).toBe(false)
    expect(delayVisibleToOthers(resolveDelay(open, 2))).toBe(false)
    expect(delayVisibleToOthers(EMPTY_DELAY)).toBe(false)
  })
  it('adds the delay to the planned time', () => {
    const r = reportDelay(EMPTY_DELAY, input, 1, 'a').current!
    expect(expectedArrival(1_000_000, r)).toBe(1_000_000 + 30 * 60_000)
  })
  it('has steps with English text for every stage', () => {
    for (const stage of ['booked', 'embarkation', 'cozumel', 'seaDay'] as const) for (const k of delayNextSteps(stage)) expect(en[k as keyof typeof en], k).toBeTruthy()
    expect(delayNextSteps('cozumel')).toContain('delay.next.portAgent')
    expect(delayNextSteps('embarkation')).toContain('delay.next.terminal')
  })
  it('lists the facts an insurer asks for', () => {
    const r = reportDelay(EMPTY_DELAY, { ...input, note: '' }, 1, 'a').current!
    const lines = claimRecord(r, 'Traffic', 'today')
    expect(lines.map((l) => l.value)).toEqual(['today', 'Traffic', '30', '-', 'line, party'])
  })
  it('finds the next moment the ship will not wait past', () => {
    const day1 = nextDeadline(REFERENCE_SAILING, 0)!
    expect(nextDeadline(REFERENCE_SAILING, day1)).toBe(allAboardEpoch(REFERENCE_SAILING, 3))
    const last = allAboardEpoch(REFERENCE_SAILING, 5)!
    expect(nextDeadline(REFERENCE_SAILING, last)).toBeNull()
    expect(itinerary(REFERENCE_SAILING)).toHaveLength(8)
  })
  it('reads saved state and defaults to sharing', () => {
    expect(normalizeDelay(null)).toEqual(EMPTY_DELAY)
    expect(normalizeDelay({ current: { id: 'a', at: 1, reason: 'bogus', lateMinutes: 5 }, history: [4], shareEta: false })).toEqual({ current: null, history: [], shareEta: false })
    const kept = normalizeDelay(JSON.parse(JSON.stringify(reportDelay(EMPTY_DELAY, input, 1, 'a'))))
    expect(kept.current?.id).toBe('a')
    expect(kept.shareEta).toBe(true)
  })
})
