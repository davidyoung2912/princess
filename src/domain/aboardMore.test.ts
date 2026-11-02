import { describe, expect, it } from 'vitest'
import { calmestPlaces, cabinWords, challenge, dndNow, findCabin, HOLD_MINUTES, kidsReport, loungerBoard, matchFound, normalizeAboard, okStatus, seasickStatus, seenToday, soloState, startSolo, takeLounger, teenComplete, EMPTY_TEEN, TEEN_RULES, LAP_STEPS, STEP_GOAL } from './aboardMore'
import { cabinsFor } from './cabins'
import { REFERENCE_SAILING } from './sailings'

const MIN = 60_000
describe('aboardMore', () => {
  it('finds calm midship places on low decks', () => {
    const p = calmestPlaces()
    expect(p.length).toBeGreaterThan(0)
    expect(p.every((x) => x.section === 'midship' && x.deck <= 8)).toBe(true)
  })
  it('moves a seasickness request from asked to seen after thirty minutes', () => {
    expect(seasickStatus(null, 1)).toBe('none')
    expect(seasickStatus(0, 29 * MIN)).toBe('asked')
    expect(seasickStatus(0, 30 * MIN)).toBe('seen')
  })
  it('takes only a free lounger, one at a time, and lapses after the hold time', () => {
    const now = 1_000 * MIN
    const board = loungerBoard(now, null, [])
    const free = board.find((r) => r.state === 'free')
    expect(board).toHaveLength(8)
    if (!free) return
    const hold = takeLounger(board, null, free.id, now)!
    expect(hold.id).toBe(free.id)
    const other = board.find((r) => r.state === 'free' && r.id !== free.id)
    expect(takeLounger(board, hold, other?.id ?? 99, now)).toBe(hold)
    expect(loungerBoard(now + 10 * MIN, hold, []).find((r) => r.id === free.id)).toMatchObject({ state: 'mine', returnsIn: HOLD_MINUTES - 10 })
    expect(loungerBoard(now + HOLD_MINUTES * MIN, hold, []).find((r) => r.id === free.id)?.state).toBe('lapsed')
  })
  it('makes the same kids report each time', () => {
    expect(kidsReport('Mia', 'firefly', 3)).toEqual(kidsReport('Mia', 'firefly', 3))
    expect(kidsReport('Mia', 'firefly', 3)).toHaveLength(3)
  })
  it('needs every rule and both signatures for a teen agreement', () => {
    const full = { name: 'Al', agreed: [...TEEN_RULES], teenSigned: true, parentSigned: true }
    expect(teenComplete(full)).toBe(true)
    expect(teenComplete({ ...full, parentSigned: false })).toBe(false)
    expect(teenComplete(EMPTY_TEEN)).toBe(false)
  })
  it('says when an OK tap and a solo timer are due', () => {
    expect(okStatus({ lastAt: null, every: 4 }, 0)).toBe('none')
    expect(okStatus({ lastAt: 0, every: 2 }, 119 * MIN)).toBe('ok')
    expect(okStatus({ lastAt: 0, every: 2 }, 120 * MIN)).toBe('due')
    const s = startSolo('Spa', 30, 0)!
    expect(startSolo('x', 7, 0)).toBeNull()
    expect([29, 30, 45].map((m) => soloState(s, m * MIN))).toEqual(['running', 'due', 'overdue'])
    expect(soloState(null, 0)).toBe('none')
  })
  it('gives a words route for a real cabin and none for a made-up one', () => {
    const c = cabinsFor(REFERENCE_SAILING.id, 'balcony')[0]
    const f = findCabin(c.number)!
    expect(f.number).toBe(c.number)
    const w = cabinWords(f)
    expect(w.steps.map((s) => s.key)).toEqual(['bank', 'deck', 'side', 'number'])
    expect(findCabin('0000')).toBeNull()
  })
  it('holds back everything but critical notices in a do-not-disturb window across midnight', () => {
    const list = [{ id: 'a', from: '22:00', to: '07:00', on: true }]
    expect(dndNow(list, '23:30', 'offers')).toBe(true)
    expect(dndNow(list, '12:00', 'offers')).toBe(false)
    expect(dndNow(list, '23:30', 'critical')).toBe(false)
    expect(dndNow([{ ...list[0], on: false }], '23:30', 'offers')).toBe(false)
  })
  it('counts steps, goal days and deck laps', () => {
    const c = challenge({ '1': STEP_GOAL, '2': 2400 }, 2)
    expect(c).toMatchObject({ total: STEP_GOAL + 2400, daysMet: 1, toGoal: STEP_GOAL - 2400 })
    expect(c.laps).toBe(Math.floor((STEP_GOAL + 2400) / LAP_STEPS))
  })
  it('matches a lost report to what was handed in', () => {
    expect(matchFound({ what: 'my sunglasses' }).map((f) => f.id)).toEqual(['f1'])
    expect(matchFound({ what: 'umbrella' })).toEqual([])
  })
  it('lists up to two kinds seen today, the same each time', () => {
    expect(seenToday(3)).toEqual(seenToday(3))
    expect(seenToday(3).length).toBeLessThanOrEqual(2)
  })
  it('normalises junk to the empty state', () => {
    const s = normalizeAboard({ lounger: { id: 99 }, dnd: [{ id: 'a', from: 'bad' }], steps: { '9': 5, '1': -4 }, sightings: [{ id: 'x', species: 'dragon', day: 2 }] })
    expect(s.lounger).toBeNull()
    expect(s.dnd[0]).toMatchObject({ from: '22:00', on: false })
    expect(s.steps).toEqual({ '1': 0 })
    expect(s.sightings).toEqual([])
  })
})
