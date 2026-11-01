import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { PERSONAS } from '../domain/personas'
import { createHttpGroups } from './httpApi'
import type { Http } from './http'
import { fromWire, PERSONA_GUIDS, toWireId } from './personaIds'

const guidOf = (slug: string) => {
  const h = createHash('sha1').update(`princess-persona:user:${slug}`).digest('hex')
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20, 32)].join('-')
}

describe('persona ids', () => {
  it('match the ids the persona seed gives the twelve people', () => {
    for (const p of PERSONAS) expect(PERSONA_GUIDS[p.id]).toBe(guidOf(p.id))
  })
  it('swap guids for slugs in values and keys, and leave other people alone', () => {
    const other = '11111111-2222-3333-4444-555555555555'
    const out = fromWire<{ id: string; kids: Record<string, number>; list: string[] }>({
      id: PERSONA_GUIDS.ethan.toUpperCase(), kids: { [PERSONA_GUIDS.maya]: 5000 }, list: [PERSONA_GUIDS.gerald, other, 'hello'],
    })
    expect(out).toEqual({ id: 'ethan', kids: { maya: 5000 }, list: ['gerald', other, 'hello'] })
    expect(toWireId('maya')).toBe(PERSONA_GUIDS.maya)
    expect(toWireId(other)).toBe(other)
  })
})

function fake(responses: Record<string, unknown>) {
  const calls: { method: string; path: string; body?: unknown }[] = []
  const reply = (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body })
    if (!(path in responses)) return Promise.reject(new Error(`unexpected ${method} ${path}`))
    return Promise.resolve(responses[path])
  }
  const http = {
    get: (p: string) => reply('GET', p),
    post: (p: string, b?: unknown) => reply('POST', p, b),
    put: (p: string, b?: unknown) => reply('PUT', p, b),
    patch: (p: string, b?: unknown) => reply('PATCH', p, b),
    delete: (p: string) => reply('DELETE', p),
  } as unknown as Http
  return { http, calls }
}

const trips = { upcoming: [{ number: 'PC1', kind: 'linked' }, { number: 'PC2', kind: 'current' }], past: [] }

describe('REST account groups', () => {
  it('finds the current trip once and puts it in booking routes', async () => {
    const { http, calls } = fake({ '/trips': trips, '/bookings/PC2/payments': { cards: [] }, '/bookings/PC2/documents': { guests: [] } })
    const { groups } = createHttpGroups(http)
    await groups.payments.get()
    await groups.documents.get()
    expect(calls.filter((c) => c.path === '/trips')).toHaveLength(1)
    expect(calls.map((c) => c.path)).toContain('/bookings/PC2/documents')
  })

  it('retries the trip lookup after a failure and again after reset', async () => {
    let n = 0
    const calls: string[] = []
    const http = { get: (p: string) => { calls.push(p); return ++n === 1 ? Promise.reject(new Error('x')) : Promise.resolve(p === '/trips' ? trips : {}) } } as unknown as Http
    const { groups, reset } = createHttpGroups(http)
    await expect(groups.privacy.view()).rejects.toThrow()
    await groups.privacy.view()
    reset()
    await groups.privacy.view()
    expect(calls.filter((c) => c === '/trips')).toHaveLength(3)
  })

  it('sends person ids as guids and receives them as slugs', async () => {
    const { http, calls } = fake({
      '/trips': trips,
      [`/users/${PERSONA_GUIDS.ethan}/profile`]: { id: PERSONA_GUIDS.ethan, canEdit: false },
      [`/users/${PERSONA_GUIDS.maya}/documents/passport?booking=PC2`]: { guests: [{ id: PERSONA_GUIDS.maya }] },
      [`/users/${PERSONA_GUIDS.maya}/consents/shipPhotos?booking=PC2`]: { people: [] },
      '/bookings/PC2/budget': { budget: { total: null, alertAt: 80, kids: {} }, kids: [{ id: PERSONA_GUIDS.maya }], canEdit: true },
    })
    const { groups } = createHttpGroups(http)
    expect((await groups.account.profile('ethan')).id).toBe('ethan')
    expect((await groups.documents.set('maya', 'passport', { expires: '2030-01-01' })).guests[0].id).toBe('maya')
    await groups.documents.set('maya', 'passport', null)
    await groups.privacy.setConsent('maya', 'shipPhotos', true)
    await groups.budget.save({ total: 100000, alertAt: 80, kids: { maya: 5000 } } as never)
    const put = calls.find((c) => c.method === 'PUT' && c.path === '/bookings/PC2/budget')!
    expect(put.body).toEqual({ total: 100000, alertAt: 80, kids: { [PERSONA_GUIDS.maya]: 5000 } })
    expect(calls.find((c) => c.method === 'DELETE')?.path).toContain(PERSONA_GUIDS.maya)
    expect(calls.find((c) => c.path.includes('consents'))?.body).toEqual({ on: true })
  })

  it('has no current trip to act on when the person has none', async () => {
    const { http } = fake({ '/trips': { upcoming: [], past: [] } })
    await expect(createHttpGroups(http).groups.payments.get()).rejects.toMatchObject({ code: 'notFound' })
  })
})

describe('REST discover and booking groups', () => {
  it('uses the sailing, funnel and booking routes with the right verbs and bodies', async () => {
    const { http, calls } = fake({
      '/sailings/offers': [],
      '/sailings/s%201/quote?category=balcony&guests=2': { total: 1 },
      '/sailings/bookable': [],
      '/sailings/s1/cabins?category=interior': [],
      '/me/draft': null,
      '/booking/quote': { total: 5 },
      '/bookings': { number: 'PC9' },
      '/bookings/PC9/detail': { number: 'PC9' },
      '/bookings/PC9/pay-balance': { number: 'PC9' },
      '/bookings/PC9/change?sailingId=s2': { newTotal: 1 },
      '/bookings/PC9/change?sailingId=s2#post': { number: 'PC9' },
      '/bookings/PC9/cancel': { number: 'PC9' },
      '/me/draft/resume-link': { via: 'email' },
    })
    const b = createHttpGroups(http).groups
    await b.discover.offers()
    await b.discover.quote('s 1', 'balcony' as never, 2)
    await b.booking.dates()
    await b.booking.cabins('s1', 'interior' as never)
    expect(await b.booking.draft()).toBeNull()
    await b.booking.discardDraft().catch(() => undefined)
    await b.booking.quote({} as never)
    await b.booking.book({ draft: {}, expectedTotal: 5, option: 'full', parts: [{ method: 'wallet', cents: 5 }] } as never)
    await b.booking.get('PC9')
    await b.booking.payBalance('PC9', [{ method: 'wallet', cents: 1 }], '123456')
    await b.booking.changePreview('PC9', 's2')
    await b.booking.cancel('PC9')
    await b.booking.sendResumeLink('email', 'a@b.example')
    expect(calls.find((c) => c.path === '/bookings')).toMatchObject({ method: 'POST', body: { expectedTotal: 5, option: 'full' } })
    expect(calls.find((c) => c.path === '/bookings/PC9/pay-balance')?.body).toEqual({ parts: [{ method: 'wallet', cents: 1 }], challenge: '123456' })
    expect(calls.find((c) => c.path === '/me/draft/resume-link')?.body).toEqual({ via: 'email', to: 'a@b.example' })
  })
})
