import { afterEach, describe, expect, it } from 'vitest'
import { demoFromAnswer, demoPayload, fetchDemo, normalizeAnswer, onDemoAnswer, publishDemo, publishJump, publishReset, sameAnswer, setDemoRemote, type DemoRemote } from './publish'
import { defaultDemoState } from './state'
import { clockAt, clockNow } from '../domain/clock'
import { SCENARIOS } from '../domain/scenarios'

afterEach(() => { setDemoRemote(null); onDemoAnswer(null) })

const remoteOf = (calls: string[], answer: unknown = null): DemoRemote => ({
  save: async (p) => { calls.push(`save ${p.clockOffsetSeconds}`); return answer },
  jump: async (at) => { calls.push(`jump ${at}`); return answer },
  reset: async () => { calls.push('reset'); return answer },
  load: async () => answer,
})

describe('demo publish', () => {
  it('turns the clock into an offset from real time, in seconds', () => {
    const real = Date.UTC(2026, 10, 1, 12)
    const state = { ...defaultDemoState(real), clock: clockAt(real + 2 * 3600_000, real, 60), scenarios: ['planChange' as const] }
    expect(demoPayload(state, real)).toEqual({ clockOffsetSeconds: 7200, clockSpeed: 60, scenarios: ['planChange'], sailingId: state.sailingId, phoneZone: state.phoneZone })
  })
  it('does nothing without a remote and ignores a failed send', async () => {
    const state = defaultDemoState(Date.now())
    expect(() => publishDemo(state)).not.toThrow()
    expect(await fetchDemo()).toBeNull()
    let sent = 0
    setDemoRemote({ ...remoteOf([]), save: async () => { sent++; throw new Error('offline') } })
    publishDemo(state)
    await new Promise((r) => setTimeout(r, 0))
    expect(sent).toBe(1)
    expect(await fetchDemo()).toBeNull()
  })
  it('sends a reset, then a jump, in that order, and tells the store what the server answered', async () => {
    const calls: string[] = []
    const answers: number[] = []
    setDemoRemote(remoteOf(calls, { clockOffsetSeconds: 5, clockSpeed: 1, scenarios: [], savedAt: 9000 }))
    onDemoAnswer((a) => answers.push(a.savedAt))
    publishReset()
    publishJump(123)
    await new Promise((r) => setTimeout(r, 0))
    expect(calls).toEqual(['reset', 'jump 123'])
    expect(answers).toEqual([9000, 9000])
  })
})

describe('the server answer', () => {
  it('is read defensively: unknown scenarios dropped, speed at least 1, nothing saved is savedAt 0', () => {
    expect(normalizeAnswer({ clockOffsetSeconds: 60.7, clockSpeed: 0, scenarios: ['planChange', 'nope', 'planChange'] })).toEqual({ clockOffsetSeconds: 60, clockSpeed: 1, scenarios: ['planChange'], savedAt: 0, sailingId: null, phoneZone: null })
    expect(normalizeAnswer('x')).toBeNull()
    expect(normalizeAnswer({ clockSpeed: 1 })).toBeNull()
  })
  it('takes a known sailing and phone zone and ignores unknown ones', () => {
    const a = normalizeAnswer({ clockOffsetSeconds: 0, clockSpeed: 1, scenarios: [], sailingId: 'sun-2026-11-22', phoneZone: 'America/Belize' })
    expect(a?.sailingId).toBe('sun-2026-11-22')
    expect(a?.phoneZone).toBe('America/Belize')
    expect(normalizeAnswer({ clockOffsetSeconds: 0, clockSpeed: 1, scenarios: [], sailingId: 'nope' })?.sailingId).toBeNull()
  })
  it('lists the scenarios the server accepts', () => {
    expect(SCENARIOS.length).toBe(16)
  })
  it('replaces the clock and scenarios but not the sailing or the pretend network', () => {
    const real = Date.UTC(2026, 10, 1, 12)
    const base = { ...defaultDemoState(real), phoneZone: 'America/Cancun' }
    const next = demoFromAnswer(base, { clockOffsetSeconds: 7200, clockSpeed: 1, scenarios: ['planChange'], savedAt: real, sailingId: null, phoneZone: null }, real)
    expect(clockNow(next.clock, real)).toBe(real + 7200_000)
    expect(next.scenarios).toEqual(['planChange'])
    expect(next.phoneZone).toBe('America/Cancun')
    expect(next.network).toEqual(base.network)
  })
  it('follows a fast clock from the moment it was saved', () => {
    const saved = Date.UTC(2026, 10, 1, 12)
    const next = demoFromAnswer(defaultDemoState(saved), { clockOffsetSeconds: 0, clockSpeed: 60, scenarios: [], savedAt: saved, sailingId: null, phoneZone: null }, saved + 60_000)
    expect(next.clock.speed).toBe(60)
    expect(clockNow(next.clock, saved + 60_000)).toBe(saved + 60_000 + 59 * 60_000)
  })
  it('compares answers on every field', () => {
    const a = { clockOffsetSeconds: 1, clockSpeed: 1, scenarios: ['planChange'], savedAt: 5, sailingId: null, phoneZone: null }
    expect(sameAnswer(a, { ...a })).toBe(true)
    expect(sameAnswer(a, { ...a, savedAt: 6, sailingId: null, phoneZone: null })).toBe(false)
    expect(sameAnswer(a, { ...a, scenarios: [] })).toBe(false)
  })
})
