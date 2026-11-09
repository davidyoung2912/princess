import { describe, expect, it } from 'vitest'
import type { PlanEntry, PlanRow } from '../domain/planChange'
import { addCustom, readCustom, removeCustom } from '../data/customReminders'
import { dueCustom } from '../domain/localReminders'
import { normalizeStanley } from './stanley'
import { canConfirm, canUndo, changeForAction, changeIdFor, clockHhmm, newKey, normalizeAction, normalizeReceipts, planSnapshot, problemOf, reminderForAction, type StanleyAction } from './stanleyAction'

const raw = (over: Record<string, unknown> = {}) => ({
  id: 'a1', kind: 'order_item', status: 'prepared', title: 'Send 2 x towels to your stateroom', lines: ['2 x Towels', 'Usually about 20 minutes.'], who: ['Your stateroom'], cents: null, terms: 'No charge.',
  expiresAt: '2027-03-05T12:10:00Z', onDevice: false, doneAt: null, undoUntil: null, reason: null, params: { item: 'towels', qty: '2' }, receipt: null, ...over,
})
const NOW = Date.parse('2027-03-05T12:00:00Z')
const action = (over: Record<string, unknown> = {}): StanleyAction => normalizeAction(raw(over))!

const entry = (id: string, start = '15:00'): PlanEntry => ({ id, title: id, start, minutes: 60, kind: 'event', outdoor: false, path: '/plan' })
const row = (id: string, state: PlanRow['state'] = 'planned'): PlanRow => ({ entry: entry(id), state })

describe('normalizeAction', () => {
  it('reads the server preview, and rejects anything that is not the agreed shape', () => {
    const a = action()
    expect(a).toMatchObject({ id: 'a1', kind: 'order_item', status: 'prepared', cents: null, onDevice: false, params: { item: 'towels', qty: '2' } })
    expect(a.expiresAt).toBe(NOW + 10 * 60_000)
    for (const bad of [null, 'x', {}, raw({ kind: 'pay_bill' }), raw({ status: 'paid' }), raw({ expiresAt: 'soon' }), raw({ id: '' }), raw({ title: '' })]) expect(normalizeAction(bad)).toBeNull()
  })

  it('keeps only strings in params and lines, and bounds their sizes', () => {
    const a = action({ params: { ok: 'x', n: 5, long: 'y'.repeat(900) }, lines: ['a', 7, 'b'] })
    expect(a.params.n).toBeUndefined()
    expect(a.params.long.length).toBe(400)
    expect(a.lines).toEqual(['a', 'b'])
  })

  it('reads a list of receipts, skipping anything unreadable', () => {
    expect(normalizeReceipts([raw(), { nope: 1 }, raw({ id: 'a2', status: 'done' })]).map((r) => r.id)).toEqual(['a1', 'a2'])
    expect(normalizeReceipts('x')).toEqual([])
  })

  it('rides on the server reply only for an answer', () => {
    const turn = normalizeStanley({ kind: 'answer', text: 'I can do that.', tier: 'action', action: raw() })
    expect(turn?.tier).toBe('action')
    expect(turn?.action?.id).toBe('a1')
    expect(normalizeStanley({ kind: 'blocked', text: '', action: raw() })?.action).toBeNull()
  })
})

describe('what can still be done', () => {
  it('lets a prepared preview be confirmed until it expires, and a done action be undone until its undo time', () => {
    expect(canConfirm(action(), NOW)).toBe(true)
    expect(canConfirm(action(), NOW + 11 * 60_000)).toBe(false)
    expect(canConfirm(action({ status: 'done' }), NOW)).toBe(false)
    const done = action({ status: 'done', undoUntil: '2027-03-05T14:00:00Z', receipt: 'STN-1234ABCD' })
    expect(canUndo(done, NOW)).toBe(true)
    expect(canUndo(done, NOW + 121 * 60_000)).toBe(false)
    expect(canUndo(action(), NOW)).toBe(false)
  })

  it('makes a fresh key each press and maps the server errors to a few words', () => {
    expect(newKey()).toMatch(/^k[a-z0-9]{8,}$/)
    expect(newKey(() => 0.1, () => 1)).not.toBe(newKey(() => 0.2, () => 1))
    expect(['expired', 'changed', 'off', 'forbidden', 'tooLate', 'keyUsed', ''].map(problemOf)).toEqual(['expired', 'changed', 'off', 'forbidden', 'tooLate', 'other', 'other'])
  })
})

describe('the day plan', () => {
  it('sends only what is in the plan and what could be added, with titles and times', () => {
    const snap = planSnapshot([row('quiz'), row('yoga', 'dropped'), row('bingo', 'moved')], [entry('trivia')], 3)
    expect(snap.map((s) => [s.id, s.listed])).toEqual([['quiz', true], ['bingo', true], ['trivia', false]])
    expect(snap[0]).toEqual({ id: 'quiz', title: 'quiz', start: '15:00', day: 3, listed: true })
  })

  it('turns a confirmed plan action into the plan\'s own change, with an id that finds it again', () => {
    const drop = action({ kind: 'plan_change', onDevice: true, title: 'Drop quiz', params: { op: 'drop', itemId: 'quiz', day: '3' } })
    const c = changeForAction(drop, [row('quiz')], [], NOW)!
    expect(c).toMatchObject({ id: changeIdFor(drop), day: 3, source: 'assistant', edits: [{ op: 'drop', id: 'quiz' }] })
    expect(c.undoUntil).toBe(NOW + 120 * 60_000)
    const move = action({ kind: 'plan_change', onDevice: true, params: { op: 'move', itemId: 'quiz', day: '3', to: '17:00' } })
    expect(changeForAction(move, [row('quiz')], [], NOW)!.edits).toEqual([{ op: 'move', id: 'quiz', to: '17:00' }])
    const add = action({ kind: 'plan_change', onDevice: true, params: { op: 'add', itemId: 'trivia', day: '3' } })
    expect(changeForAction(add, [row('quiz')], [entry('trivia', '16:30')], NOW)!.edits).toEqual([{ op: 'add', entry: { ...entry('trivia', '16:30'), kind: 'added' } }])
  })

  it('does nothing when the plan no longer has the item, or the details are not right', () => {
    const base = { kind: 'plan_change', onDevice: true }
    expect(changeForAction(action({ ...base, params: { op: 'drop', itemId: 'gone', day: '3' } }), [row('quiz')], [], NOW)).toBeNull()
    expect(changeForAction(action({ ...base, params: { op: 'drop', itemId: 'quiz', day: '3' } }), [row('quiz', 'dropped')], [], NOW)).toBeNull()
    expect(changeForAction(action({ ...base, params: { op: 'move', itemId: 'quiz', day: '3', to: 'late' } }), [row('quiz')], [], NOW)).toBeNull()
    expect(changeForAction(action({ ...base, params: { op: 'add', itemId: 'nope', day: '3' } }), [], [], NOW)).toBeNull()
    expect(changeForAction(action({ ...base, params: { op: 'drop', itemId: 'quiz', day: 'x' } }), [row('quiz')], [], NOW)).toBeNull()
    expect(changeForAction(action(), [row('quiz')], [], NOW)).toBeNull()
  })
})

describe('reminders', () => {
  it('makes a reminder from a confirmed remind_me action, due when the caller says', () => {
    const a = action({ kind: 'remind_me', onDevice: true, params: { at: '16:15', text: 'Be back' } })
    expect(reminderForAction(a, NOW)).toEqual({ id: 'a1', at: NOW, text: 'Be back' })
    expect(reminderForAction(a, null)).toBeNull()
    expect(reminderForAction(action({ kind: 'remind_me', params: { at: 'soon' } }), NOW)).toBeNull()
    expect(reminderForAction(action(), NOW)).toBeNull()
  })

  it('names a clock time on the ship\'s clock', () => {
    expect(clockHhmm(Date.parse('2027-03-21T21:30:00Z'), 'America/Cancun')).toBe('16:30')
    expect(clockHhmm(Date.parse('2027-03-21T21:30:00Z'), 'UTC')).toBe('21:30')
  })

  it('keeps reminders on this device, shows one only when it is due, and forgets it when undone', () => {
    const mem = new Map<string, string>()
    const fake = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }
    const real = globalThis.localStorage
    Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true })
    try {
      addCustom({ id: 'a1', at: NOW + 60_000, text: 'Be back' })
      addCustom({ id: 'a1', at: NOW + 60_000, text: 'Be back' })
      expect(readCustom()).toHaveLength(1)
      expect(dueCustom(readCustom(), NOW)).toEqual([])
      expect(dueCustom(readCustom(), NOW + 61_000)).toEqual([{ key: 'custom:a1', kind: 'custom', amount: 0, urgent: false, text: 'Be back' }])
      expect(removeCustom('a1')).toEqual([])
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: real, configurable: true })
    }
  })
})
