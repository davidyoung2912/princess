import { describe, expect, it } from 'vitest'
import { awayLevel, awayPackStatus, AWAY_PACK_KINDS, inPortWindow, isAway, nextReturnTime, normalizeAwayPack, returnTimes } from './awayFromShip'

const MIN = 60_000
const day = { arriveAt: 8 * 60 * MIN, allAboardAt: 16 * 60 * MIN, departAt: 16.5 * 60 * MIN, tender: false }
const tenderDay = { ...day, tender: true }

describe('away from ship', () => {
  it('counts leaving and ashore as away, and back or nothing as aboard', () => {
    expect(isAway('ashore')).toBe(true)
    expect(isAway('leaving')).toBe(true)
    expect(isAway('back')).toBe(false)
    expect(isAway(null)).toBe(false)
  })

  it('opens the leaving window only between arrival and sailing', () => {
    expect(inPortWindow(day, day.arriveAt - 1)).toBe(false)
    expect(inPortWindow(day, day.arriveAt)).toBe(true)
    expect(inPortWindow(day, day.departAt)).toBe(false)
  })

  it('lists the return moments in order, with the last tender only on a tender day', () => {
    const now = 10 * 60 * MIN
    expect(returnTimes(day, now).map((x) => x.id)).toEqual(['landing', 'allAboard', 'sails'])
    const t = returnTimes(tenderDay, now)
    expect(t.map((x) => x.id)).toEqual(['landing', 'lastTender', 'allAboard', 'sails'])
    expect(t.map((x) => x.at)).toEqual([...t.map((x) => x.at)].sort((a, b) => a - b))
  })

  it('puts the gangway time before all-aboard and the sailing 30 minutes after it', () => {
    const t = returnTimes(day, 10 * 60 * MIN)
    expect(t[0]!.at).toBeLessThan(day.allAboardAt)
    expect(t.find((x) => x.id === 'sails')!.at).toBe(day.allAboardAt + 30 * MIN)
  })

  it('finds the next moment still ahead and none once the ship has gone', () => {
    const times = returnTimes(day, day.allAboardAt + MIN)
    expect(nextReturnTime(times)?.id).toBe('sails')
    expect(nextReturnTime(returnTimes(day, day.allAboardAt + 31 * MIN))).toBeNull()
  })

  it('counts minutes left, never below zero', () => {
    const t = returnTimes(day, day.allAboardAt)
    expect(t.find((x) => x.id === 'allAboard')).toMatchObject({ minutesLeft: 0, passed: true })
    expect(returnTimes(day, day.allAboardAt - 90 * MIN).find((x) => x.id === 'allAboard')!.minutesLeft).toBe(90)
  })

  it('raises the level to "now" once the gangway time has passed', () => {
    expect(awayLevel(day, 9 * 60 * MIN)).toBe('plenty')
    const landing = returnTimes(day, 0).find((x) => x.id === 'landing')!
    expect(awayLevel(day, landing.at + MIN)).toBe('now')
    expect(awayLevel(day, day.allAboardAt + MIN)).toBe('late')
    expect(awayLevel(day, day.allAboardAt + 31 * MIN)).toBe('gone')
  })

  it('judges the copy by the port day it was made for', () => {
    const full = { at: 1, date: '2027-03-05', items: AWAY_PACK_KINDS.map((kind) => ({ kind, ok: true })) }
    expect(awayPackStatus(full, '2027-03-05').state).toBe('ready')
    expect(awayPackStatus(full, '2027-03-06')).toMatchObject({ state: 'none', saved: 0, at: null })
    expect(awayPackStatus(null, '2027-03-05').missing).toEqual([...AWAY_PACK_KINDS])
    const part = { ...full, items: full.items.map((i, n) => ({ ...i, ok: n !== 1 })) }
    expect(awayPackStatus(part, '2027-03-05')).toMatchObject({ state: 'partial', saved: AWAY_PACK_KINDS.length - 1, missing: ['portDay'] })
  })

  it('ignores a stored result that is not one, and unknown items in one that is', () => {
    expect(normalizeAwayPack('x')).toBeNull()
    expect(normalizeAwayPack({ at: 1, date: 'd' })).toBeNull()
    expect(normalizeAwayPack({ at: 1, date: 'd', items: [{ kind: 'pass', ok: true }, { kind: 'bogus', ok: true }, { kind: 'muster', ok: 'yes' }] })?.items).toEqual([{ kind: 'pass', ok: true }])
  })
})
