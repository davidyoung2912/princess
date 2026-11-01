import { describe, expect, it } from 'vitest'
import { createTelemetry, MAX_QUEUE, screenName, TELEMETRY_KEY } from './telemetry'

const fakeStore = () => {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), data }
}

describe('telemetry', () => {
  it('collects nothing without consent', () => {
    const s = fakeStore()
    const t = createTelemetry(s, () => false)
    t.error('error', new Error('boom'))
    t.event('install')
    expect(s.data.has(TELEMETRY_KEY)).toBe(false)
    expect(t.queued()).toEqual([])
  })
  it('scrubs error text and keeps no stack', () => {
    const s = fakeStore()
    const t = createTelemetry(s, () => true, () => new Date('2027-03-21T10:00:00Z'))
    t.error('error', new Error('failed for maya@example.com at https://x.test/a?b=1 card 4111 1111 1111 1111'))
    const [item] = t.queued()
    expect(item).toMatchObject({ type: 'error', kind: 'error', at: '2027-03-21T10:00:00.000Z' })
    expect(JSON.stringify(item)).not.toMatch(/maya|x\.test|4111/)
  })
  it('records only named events, with a screen name that has no ids', () => {
    const t = createTelemetry(fakeStore(), () => true)
    t.event('screen', '/home/orders/12345?x=1')
    t.event('screen', '/home/dining/book')
    t.event('nonsense' as never)
    expect(t.queued().map((i) => (i.type === 'event' ? i.screen : null))).toEqual(['home/orders', 'home/dining'])
  })
  it('stops reading when consent is withdrawn and forgets on clear', () => {
    let on = true
    const s = fakeStore()
    const t = createTelemetry(s, () => on)
    t.event('install')
    on = false
    expect(t.queued()).toEqual([])
    t.clear()
    expect(s.data.has(TELEMETRY_KEY)).toBe(false)
  })
  it('keeps the newest entries', () => {
    const t = createTelemetry(fakeStore(), () => true)
    for (let i = 0; i < MAX_QUEUE + 10; i++) t.event('offlineUse')
    expect(t.queued()).toHaveLength(MAX_QUEUE)
  })
})

describe('screenName', () => {
  it('drops numbers, ids and odd segments', () => {
    expect(screenName('/home/offers')).toBe('home/offers')
    expect(screenName('/trip/AB123/pay')).toBe('trip/pay')
    expect(screenName('/')).toBeUndefined()
    expect(screenName('/%%%/x y')).toBeUndefined()
  })
})
