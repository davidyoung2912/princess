import { describe, expect, it } from 'vitest'
import { createTelemetry, MAX_QUEUE, screenName, TELEMETRY_KEY } from './telemetry'

const fakeStore = () => {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), data }
}

describe('telemetry', () => {
  it('counts nothing without consent, but still queues problems', () => {
    const s = fakeStore()
    const t = createTelemetry(s, () => false)
    t.event('install')
    expect(s.data.has(TELEMETRY_KEY)).toBe(false)
    t.error('error', new Error('boom'))
    expect(t.queued().map((i) => i.type)).toEqual(['error'])
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
    t.error('screen', 'still reported')
    expect(t.queued().map((i) => i.type)).toEqual(['error'])
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

describe('telemetry flush', () => {
  const fake = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> => {
    const m = new Map<string, string>()
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v) }, removeItem: (k) => { m.delete(k) } }
  }
  const at = () => new Date('2027-03-21T10:00:00Z')

  it('sends the queue and forgets what was accepted', async () => {
    const t = createTelemetry(fake(), () => true, at)
    t.event('install')
    t.error('error', new Error('boom'))
    const sent: unknown[][] = []
    expect(await t.flush(async (items) => { sent.push(items) })).toBe(2)
    expect(sent[0]).toHaveLength(2)
    expect(t.queued()).toEqual([])
  })

  it('keeps the queue when the send fails and sends nothing without consent', async () => {
    const on = createTelemetry(fake(), () => true, at)
    on.event('install')
    expect(await on.flush(async () => { throw new Error('offline') })).toBe(0)
    expect(on.queued()).toHaveLength(1)
    const off = createTelemetry(fake(), () => false, at)
    off.event('install')
    let called = false
    expect(await off.flush(async () => { called = true })).toBe(0)
    expect(called).toBe(false)
  })

  it('sends problems without consent, and keeps usage counts that were queued before consent was withdrawn', async () => {
    const store = fake()
    let on = true
    const t = createTelemetry(store, () => on, at)
    t.event('install')
    t.error('error', new Error('boom'))
    on = false
    const sent: { type: string }[][] = []
    expect(await t.flush(async (items) => { sent.push(items) })).toBe(1)
    expect(sent[0].map((i) => i.type)).toEqual(['error'])
    on = true
    expect(t.queued().map((i) => i.type)).toEqual(['event'])
  })

  it('keeps items queued while the send was in flight', async () => {
    const t = createTelemetry(fake(), () => true, at)
    t.event('install')
    await t.flush(async () => { t.event('dataLight') })
    expect(t.queued().map((i) => (i.type === 'event' ? i.name : ''))).toEqual(['dataLight'])
  })
})
