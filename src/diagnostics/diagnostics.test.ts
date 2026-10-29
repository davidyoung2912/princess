import { describe, expect, it } from 'vitest'
import { clearLog, DIAGNOSTICS_KEY, logToText, MAX_ENTRIES, MAX_MESSAGE, readLog, record, scrub } from './log'

const fakeStore = () => {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

describe('diagnostics log', () => {
  it('records an error with its time and keeps no stack', () => {
    const s = fakeStore()
    const e = new TypeError('x is undefined')
    record(s, 'error', e, new Date('2027-03-21T10:00:00Z'))
    expect(readLog(s)).toEqual([{ kind: 'error', at: '2027-03-21T10:00:00.000Z', message: 'TypeError: x is undefined' }])
    expect(s.getItem(DIAGNOSTICS_KEY)).not.toContain('at Object')
  })

  it('removes addresses, e-mail and long numbers, and cuts long text', () => {
    expect(scrub('Failed https://x.test/a?token=1 for a@b.com card 4111 1111 1111 1111')).toBe('Failed [link] for [email] card [number]')
    expect(scrub('y'.repeat(500))).toHaveLength(MAX_MESSAGE)
  })

  it('keeps only the newest entries', () => {
    const s = fakeStore()
    for (let i = 0; i < MAX_ENTRIES + 5; i++) record(s, 'screen', `problem ${i}`)
    const log = readLog(s)
    expect(log).toHaveLength(MAX_ENTRIES)
    expect(log.at(-1)?.message).toBe(`problem ${MAX_ENTRIES + 4}`)
  })

  it('survives damaged, foreign or blocked storage', () => {
    const s = fakeStore()
    s.setItem(DIAGNOSTICS_KEY, '{not json')
    expect(readLog(s)).toEqual([])
    s.setItem(DIAGNOSTICS_KEY, JSON.stringify([{ kind: 'nope', at: 1 }, { kind: 'slow', at: 'now', message: 'ok' }]))
    expect(readLog(s)).toHaveLength(1)
    expect(() => record(null, 'error', 'x')).not.toThrow()
    const full = { ...fakeStore(), setItem: () => { throw new Error('quota') } }
    expect(() => record(full, 'error', 'x')).not.toThrow()
  })

  it('clears, and writes text that says what it is', () => {
    const s = fakeStore()
    record(s, 'slow', 'Page took 5000 ms to load')
    expect(logToText(readLog(s))).toContain('slow  Page took 5000 ms to load')
    clearLog(s)
    expect(readLog(s)).toEqual([])
  })
})
