import { describe, expect, it } from 'vitest'
import { createHttpGroups } from './httpApi'
import type { Http } from './http'

/** Person ids go to the server and come back exactly as the client holds them; nothing is translated. */
const PERSONA_GUIDS = { maya: 'maya', ethan: 'ethan', gerald: 'gerald' }

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

  it('sends person ids as they are and receives them unchanged', async () => {
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

  it('reads who a helper helps and pays a guest balance on the guest routes (BM8)', async () => {
    const { http, calls } = fake({
      '/me/helping': [],
      '/guests/g1/bookings/PC9/payments': { receipts: [] },
      '/guests/g1/bookings/PC9/payments/balance': { receipts: [] },
      '/guests/g1/bookings/PC9/folio': { lines: [] },
      '/guests/g1/bookings/PC9/checkin/status': { state: 'open' },
    })
    const { helping } = createHttpGroups(http).groups
    await helping.list()
    await helping.payments('g1', 'PC9')
    await helping.payBalance('g1', 'PC9', 'card-1')
    await helping.folio('g1', 'PC9')
    await helping.checkin('g1', 'PC9')
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({ path: '/guests/g1/bookings/PC9/payments/balance', body: { cardId: 'card-1' } })
    expect(calls.map((c) => c.path)).toContain('/me/helping')
    expect(calls.map((c) => c.path)).toContain('/guests/g1/bookings/PC9/folio')
    expect(calls.map((c) => c.path)).toContain('/guests/g1/bookings/PC9/checkin/status')
  })

  it('sends an invitation code to accept a helper grant (BM9)', async () => {
    const { http, calls } = fake({ '/me/helper/accept': { guestName: 'Ruth', relationship: 'Mother' } })
    const r = await createHttpGroups(http).groups.account.acceptHelperInvite('ABCD2345')
    expect(r.guestName).toBe('Ruth')
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/me/helper/accept', body: { code: 'ABCD2345' } })
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
      '/bookings/PC9/instalments': { balance: 0, finalDue: '2027-01-15', plans: [], chosen: null, next: null },
      '/bookings/PC9/instalments#put': { balance: 0, finalDue: '2027-01-15', plans: [], chosen: 3, next: null },
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
    await b.booking.instalments('PC9')
    await b.booking.setInstalments('PC9', 3)
    await b.booking.changePreview('PC9', 's2')
    await b.booking.cancel('PC9')
    await b.booking.sendResumeLink('email', 'a@b.example')
    expect(calls.find((c) => c.path === '/bookings')).toMatchObject({ method: 'POST', body: { expectedTotal: 5, option: 'full' } })
    expect(calls.find((c) => c.path === '/bookings/PC9/pay-balance')?.body).toEqual({ parts: [{ method: 'wallet', cents: 1 }], challenge: '123456' })
    expect(calls.some((c) => c.method === 'GET' && c.path === '/bookings/PC9/instalments')).toBe(true)
    expect(calls.find((c) => c.path === '/me/draft/resume-link')?.body).toEqual({ via: 'email', to: 'a@b.example' })
  })
})

describe('REST plan, waits, shows and ahead groups', () => {
  it('uses the trip routes with guest ids as they are', async () => {
    const { http, calls } = fake({
      '/trips': trips,
      '/bookings/PC2/plan': { days: [] },
      '/bookings/PC2/dining/slots?venue=v%201&day=3': [],
      '/bookings/PC2/excursions/cart/e1': {},
      '/bookings/PC2/dining/reservations': {},
      '/bookings/PC2/packages/purchases': {},
      '/bookings/PC2/checklist/c1': {},
      '/bookings/PC2/waits/queue': {},
      '/bookings/PC2/shows?day=2': [],
      '/bookings/PC2/shows/tickets': [],
      ['/bookings/PC2/clubs/' + PERSONA_GUIDS.maya]: {},
      '/bookings/PC2/bag-tags/way': {},
      '/bookings/PC2/prep/p1': [],
      '/me/favourites/toggle': ['a'],
      '/me/marketing/email/subscribe': {},
    })
    const g = createHttpGroups(http).groups
    await g.plan.overview()
    await g.plan.dining.slots('v 1', 3)
    await g.plan.excursions.addToCart('e1', ['maya', 'ethan'])
    await g.plan.dining.reserve({ venueId: 'v', day: 1, time: '18:00', guests: ['maya'], note: '' })
    await g.plan.packages.buy({ kind: 'addOn', item: 'x', guests: ['maya'] } as never, [], '1')
    await g.plan.checklist.tick('c1', true)
    await g.waits.joinQueue('v')
    await g.shows.day(2)
    await g.shows.reserve('s', 2, ['maya'])
    await g.ahead.clubs.save({ childId: 'maya', allergies: '' } as never)
    await g.ahead.tags.choose('print' as never)
    await g.ahead.prep.set('p1', true)
    await g.ahead.saved.toggle('a')
    await g.ahead.marketing.subscribe('email' as never, 'a@b.example', 'us' as never)
    const body = (path: string) => calls.find((c) => c.path === path)?.body
    expect(body('/bookings/PC2/excursions/cart/e1')).toEqual({ guests: [PERSONA_GUIDS.maya, PERSONA_GUIDS.ethan] })
    expect(body('/bookings/PC2/dining/reservations')).toMatchObject({ guests: [PERSONA_GUIDS.maya] })
    expect(body('/bookings/PC2/packages/purchases')).toEqual({ kind: 'addOn', item: 'x', guests: [PERSONA_GUIDS.maya], parts: [], challenge: '1' })
    expect(body('/bookings/PC2/checklist/c1')).toEqual({ done: true })
    expect(body('/bookings/PC2/shows/tickets')).toEqual({ eventId: 's', day: 2, guests: [PERSONA_GUIDS.maya] })
    expect(body(`/bookings/PC2/clubs/${PERSONA_GUIDS.maya}`)).toEqual({ allergies: '' })
    expect(body('/bookings/PC2/prep/p1')).toEqual({ done: true })
    expect(body('/me/marketing/email/subscribe')).toEqual({ contact: 'a@b.example', region: 'us' })
  })
})

describe('REST check-in and boarding groups', () => {
  it('saves a step by path with guests as they are and uses the embark routes', async () => {
    const { http, calls } = fake({
      '/trips': trips,
      '/bookings/PC2/checkin': {},
      '/bookings/PC2/checkin/steps/document': {},
      '/bookings/PC2/checkin/steps/confirm': {},
      '/bookings/PC2/checkin/submit': {},
      '/bookings/PC2/embark/companion/c1': {},
      '/bookings/PC2/embark/carry-on/k1': {},
      '/bookings/PC2/embark/bags': {},
      "/pass/lookup?number=PC%202&lastName=O'Neil&dob=1980-02-03": {},
    })
    const g = createHttpGroups(http).groups
    await g.checkin.view()
    await g.checkin.save({ step: 'document', guest: 'maya', kind: 'passport', country: 'US', number: 'X1', expires: '2030-01-01' } as never)
    await g.checkin.save({ step: 'confirm', guests: ['maya', 'ethan'] })
    await g.checkin.submit()
    await g.boarding.setCompanion('c1' as never, true)
    await g.boarding.setCarryOn('k1' as never, false)
    await g.boarding.setBags(true)
    await g.boarding.lookup('PC 2', "O'Neil", '1980-02-03')
    const body = (path: string) => calls.find((c) => c.path === path)?.body
    expect(body('/bookings/PC2/checkin/steps/document')).toEqual({ guest: PERSONA_GUIDS.maya, kind: 'passport', country: 'US', number: 'X1', expires: '2030-01-01' })
    expect(body('/bookings/PC2/checkin/steps/confirm')).toEqual({ guests: [PERSONA_GUIDS.maya, PERSONA_GUIDS.ethan] })
    expect(body('/bookings/PC2/embark/companion/c1')).toEqual({ done: true })
    expect(body('/bookings/PC2/embark/bags')).toEqual({ dropped: true })
    expect(calls.some((c) => c.path === "/pass/lookup?number=PC%202&lastName=O'Neil&dob=1980-02-03")).toBe(true)
  })
})

describe('REST on-board groups', () => {
  it('plans an event on the day it was last listed, and sends guests as they are', async () => {
    const { http, calls } = fake({
      '/trips': trips,
      '/bookings/PC2/onboard/program/3': { day: 3, events: [{ id: 'ev1' }], mine: [] },
      '/bookings/PC2/onboard/plan/ev1': [],
      '/bookings/PC2/onboard/muster': {},
      '/bookings/PC2/orders': {},
      ['/bookings/PC2/family/' + PERSONA_GUIDS.maya + '/auth']: {},
      '/bookings/PC2/tv': {},
      '/bookings/PC2/dining/reservations/r1/group/friends': {},
      '/bookings/PC2/ready/p1': [],
      ['/me/chat/blocks/' + PERSONA_GUIDS.gerald]: [],
      '/bookings/PC2/last-minute/x1': {},
    })
    const g = createHttpGroups(http).groups
    await g.onboard.program(3)
    await g.onboard.togglePlan('ev1', true)
    await g.onboard.confirmMuster(['maya'])
    await g.orders.place({ kind: 'food', lines: [{ itemId: 'i', qty: 1, extras: [], guest: 'maya' }], location: { kind: 'cabin' }, tip: 0 } as never)
    await g.family.setAuth('maya', { pickup: ['gerald'], signOutAlone: false, photos: true })
    await g.aboard.tv.set({ volume: 5 })
    await g.aboard.groups.addFriend('r1', { name: 'A', cabin: '1234' }, 4)
    await g.aboard.ready.set('p1', true)
    await g.aboard.chat.block('gerald', true)
    await g.aboard.lastMinute.book('x1', ['maya'])
    const call = (method: string, path: string) => calls.find((c) => c.method === method && c.path === path)?.body
    expect(call('PUT', '/bookings/PC2/onboard/plan/ev1')).toEqual({ on: true, day: 3 })
    expect(call('POST', '/bookings/PC2/onboard/muster')).toEqual({ guests: [PERSONA_GUIDS.maya] })
    expect(call('POST', '/bookings/PC2/orders')).toMatchObject({ lines: [{ guest: PERSONA_GUIDS.maya }] })
    expect(call('PUT', `/bookings/PC2/family/${PERSONA_GUIDS.maya}/auth`)).toEqual({ pickup: [PERSONA_GUIDS.gerald], signOutAlone: false, photos: true })
    expect(call('PATCH', '/bookings/PC2/tv')).toEqual({ volume: 5 })
    expect(call('POST', '/bookings/PC2/dining/reservations/r1/group/friends')).toEqual({ name: 'A', cabin: '1234' })
    expect(call('PUT', '/bookings/PC2/ready/p1')).toEqual({ on: true })
    expect(call('PUT', `/me/chat/blocks/${PERSONA_GUIDS.gerald}`)).toEqual({ on: true })
    expect(call('POST', '/bookings/PC2/last-minute/x1')).toEqual({ guests: [PERSONA_GUIDS.maya] })
  })
})

describe('REST after-cruise groups', () => {
  it('sends bags by guest guid and uses the booking routes', async () => {
    const { http, calls } = fake({
      '/trips': trips,
      '/bookings/PC2/disembark/choice': {},
      '/bookings/PC2/disembark/night/n1': {},
      '/bookings/PC2/disembark/final-bill/tip': {},
      '/bookings/PC2/disembark/final-bill/email': {},
      '/bookings/PC2/cases/c1': {},
      '/bookings/PC2/post-feedback': {},
      '/bookings/PC2/rebook/holds': {},
      '/bookings/PC2/rebook/appointment': {},
      '/me/loyalty-summary': {},
      '/bookings/PC2/history': {},
    })
    const g = createHttpGroups(http).groups
    await g.disembark.choose({ option: 'selfWalk' as never, bags: { maya: 2 } })
    await g.disembark.tick('n1', true)
    await g.disembark.adjustTip(50)
    await g.disembark.emailReceipt()
    await g.cases.withdraw('c1')
    await g.post.saveFeedback({ overall: 5 } as never)
    await g.post.hold('d1')
    await g.post.bookSlot(123)
    await g.post.cancelSlot()
    await g.post.loyalty()
    await g.post.history()
    const call = (method: string, path: string) => calls.find((c) => c.method === method && c.path === path)?.body
    expect(call('PUT', '/bookings/PC2/disembark/choice')).toEqual({ option: 'selfWalk', bags: { [PERSONA_GUIDS.maya]: 2 } })
    expect(call('PUT', '/bookings/PC2/disembark/night/n1')).toEqual({ done: true })
    expect(call('PUT', '/bookings/PC2/disembark/final-bill/tip')).toEqual({ keepPercent: 50 })
    expect(call('POST', '/bookings/PC2/rebook/holds')).toEqual({ departureId: 'd1' })
    expect(call('POST', '/bookings/PC2/rebook/appointment')).toEqual({ at: 123 })
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/bookings/PC2/cases/c1')).toBe(true)
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/bookings/PC2/rebook/appointment')).toBe(true)
  })
})
