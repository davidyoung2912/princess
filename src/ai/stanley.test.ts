import { beforeEach, describe, expect, it } from 'vitest'
import { askStanley, cooldownSeconds, revealSteps, getStanleyThread, historyToSend, normalizeStanley, setStanleyThread, stanleyProblem, type StanleyMessage } from './stanley'

const u = (text: string, at = 1): StanleyMessage => ({ id: `u${at}`, role: 'user', text, at })
const a = (text: string, kind: StanleyMessage['kind'] = 'answer', at = 2): StanleyMessage => ({ id: `a${at}`, role: 'assistant', text, at, kind })

describe('normalizeStanley', () => {
  it('reads each kind and keeps text only for an answer', () => {
    expect(normalizeStanley({ kind: 'answer', text: 'Hi', source: 'claude', handoff: null, fallback: null })).toEqual({ kind: 'answer', text: 'Hi', handoff: null, fallback: null })
    expect(normalizeStanley({ kind: 'blocked', text: 'ignored', handoff: null, fallback: null })?.text).toBe('')
    expect(normalizeStanley({ kind: 'unavailable', text: '', fallback: 'limit' })?.fallback).toBe('limit')
    expect(normalizeStanley({ kind: 'handoff', handoff: 'medical', text: '' })?.handoff).toBe('medical')
  })
  it('rejects a shape it does not know', () => {
    for (const bad of [null, 'x', {}, { kind: 'nope' }, { kind: 'answer', text: '  ' }, { kind: 'handoff', handoff: 'x', text: '' }]) expect(normalizeStanley(bad)).toBeNull()
  })
})

describe('historyToSend', () => {
  it('leaves out blocked, off-topic and failed exchanges', () => {
    const thread = [u('one'), a('A1'), u('rude'), a('', 'blocked'), u('weather?'), a('', 'offtopic'), u('three'), a('A3'), u('now')]
    expect(historyToSend(thread).map((m) => m.text)).toEqual(['one', 'A1', 'three', 'A3', 'now'])
  })
  it('keeps the latest 10 round trips', () => {
    const thread: StanleyMessage[] = []
    for (let i = 0; i < 14; i++) thread.push(u(`q${i}`, i * 2), a(`a${i}`, 'answer', i * 2 + 1))
    thread.push(u('last', 99))
    const sent = historyToSend(thread)
    expect(sent).toHaveLength(21)
    expect(sent[0].text).toBe('q4')
    expect(sent[20].text).toBe('last')
  })
})

describe('askStanley', () => {
  it('never sends an emergency to the server', async () => {
    let called = false
    const turn = await askStanley(async () => { called = true; return {} }, [u('there is a fire')])
    expect(turn.kind).toBe('handoff')
    expect(turn.handoff).toBe('emergency')
    expect(called).toBe(false)
  })
  it('returns the server answer, and unreachable when it fails or is malformed', async () => {
    expect((await askStanley(async () => ({ kind: 'answer', text: 'Yes' }), [u('hi')])).text).toBe('Yes')
    expect((await askStanley(async () => { throw new Error('x') }, [u('hi')])).fallback).toBe('network')
    expect((await askStanley(async () => ({ nope: 1 }), [u('hi')])).kind).toBe('unreachable')
  })
})

describe('the thread and the message check', () => {
  beforeEach(() => setStanleyThread([]))
  it('is kept in memory and capped', () => {
    setStanleyThread(Array.from({ length: 70 }, (_, i) => u(`m${i}`, i)))
    expect(getStanleyThread()).toHaveLength(60)
  })
  it('checks length', () => {
    expect(stanleyProblem(' ')).toBe('empty')
    expect(stanleyProblem('x'.repeat(501))).toBe('long')
    expect(stanleyProblem('hi')).toBeNull()
  })
})

describe('cooldown and reveal (S4)', () => {
  const msg = (role: 'user' | 'assistant', at: number, kind?: 'blocked' | 'answer'): StanleyMessage => ({ id: `${role}${at}`, role, text: 'x', at, kind })
  const blockedRun = (n: number) => Array.from({ length: n }, (_, i) => [msg('user', i * 10), msg('assistant', i * 10 + 1, 'blocked')]).flat()
  it('starts after three blocked replies in a row and counts down', () => {
    expect(cooldownSeconds(blockedRun(2), 100)).toBe(0)
    expect(cooldownSeconds(blockedRun(3), 100)).toBe(30)
    expect(cooldownSeconds(blockedRun(3), 100 + 12_000)).toBe(18)
    expect(cooldownSeconds(blockedRun(3), 100 + 40_000)).toBe(0)
  })
  it('is ended by a good answer', () => {
    expect(cooldownSeconds([...blockedRun(3), msg('user', 50), msg('assistant', 51, 'answer')], 100)).toBe(0)
  })
  it('reveals text in word-boundary pieces ending with the whole text', () => {
    const steps = revealSteps('one two three four five', 2)
    expect(steps).toEqual(['one two ', 'one two three four ', 'one two three four five'])
    expect(revealSteps('hi')).toEqual(['hi'])
    expect(revealSteps('')).toEqual([''])
  })
})
