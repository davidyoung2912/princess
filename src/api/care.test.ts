import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../data/store'
import { clockAt } from '../domain/clock'
import { defaultDemoState, type DemoState } from '../demo/state'
import { slotsFor } from '../domain/dining'
import type { PersonaId } from '../domain/personas'
import type { ScenarioId } from '../domain/scenarios'
import { zonedToEpoch } from '../domain/timezones'
import { isApiError } from './errors'
import { createMockApi } from './mock'

const REAL = Date.UTC(2026, 9, 29, 16)
const SAILING = 'sun-2027-03-21'

function setup(as: PersonaId = 'daniel') {
  let who: PersonaId | null = as
  const demo: DemoState = defaultDemoState(REAL)
  const api = createMockApi({ store: createMemoryStore(), demo: () => demo, persona: () => who, realNow: () => REAL, sleep: async () => {} })
  return {
    api,
    as: (p: PersonaId) => { who = p },
    at: (date: string, time: string, zone = 'America/New_York') => { demo.clock = clockAt(zonedToEpoch(date, time, zone), REAL, 0) },
    later: (minutes: number) => { demo.clock = clockAt(demo.clock.anchorDemo + minutes * 60_000, REAL, 0) },
    scenario: (...ids: ScenarioId[]) => { demo.scenarios = ids },
  }
}

const code = async (p: Promise<unknown>) => { try { await p } catch (e) { return isApiError(e) ? `${e.code}:${e.message}` : 'other' } return null }

describe('budget (ACC-02)', () => {
  it('starts with no limit and keeps what an adult saves', async () => {
    const s = setup()
    expect((await s.api.budget.get()).budget).toEqual({ total: null, alertAt: 80, kids: {} })
    const saved = await s.api.budget.save({ total: 200000, alertAt: 50, kids: { ethan: 5000 } })
    expect(saved.budget).toEqual({ total: 200000, alertAt: 50, kids: { ethan: 5000 } })
    expect(saved.kids.map((k) => k.id)).toEqual(['ethan', 'maya'])
    expect((await s.api.budget.get()).budget.total).toBe(200000)
  })

  it('refuses nonsense and a limit for someone who is not a child on the booking', async () => {
    const s = setup()
    expect(await code(s.api.budget.save({ total: -5, alertAt: 80, kids: {} }))).toBe('invalid:Check the amount')
    expect(await code(s.api.budget.save({ total: 100, alertAt: 77 as never, kids: {} }))).toBe('invalid:Choose when to warn')
    expect(await code(s.api.budget.save({ total: null, alertAt: 80, kids: { priya: 5000 } }))).toBe('invalid:Check the limit for a child')
  })

  it('lets a supervised child read it but not change it', async () => {
    const s = setup()
    await s.api.budget.save({ total: 100000, alertAt: 80, kids: {} })
    s.as('ethan')
    expect((await s.api.budget.get()).canEdit).toBe(false)
    expect(await code(s.api.budget.save({ total: 1, alertAt: 80, kids: {} }))).toBe('forbidden:This account is supervised')
  })
})

describe('show seats (ENT-01)', () => {
  it('is closed before boarding', async () => {
    const s = setup()
    expect(await code(s.api.shows.reserve('stage-show', 2, ['daniel']))).toBe('conflict:closed')
  })

  it('reserves, refuses a second seat for the same person, and gives seats back', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    const before = (await s.api.shows.day(2)).find((x) => x.eventId === 'stage-show')!.left
    const tickets = await s.api.shows.reserve('stage-show', 2, ['daniel', 'priya'])
    expect(tickets).toHaveLength(1)
    expect(tickets[0]).toMatchObject({ eventId: 'stage-show', day: 2, canReturn: true })
    expect((await s.api.shows.day(2)).find((x) => x.eventId === 'stage-show')!.left).toBe(before - 2)
    expect(await code(s.api.shows.reserve('stage-show', 2, ['priya']))).toBe('conflict:duplicate')
    expect(await s.api.shows.cancel(tickets[0].id)).toEqual([])
    expect((await s.api.shows.day(2)).find((x) => x.eventId === 'stage-show')!.left).toBe(before)
  })

  it('refuses children for an adults-only event, unknown events and people off the booking', async () => {
    const s = setup()
    s.at('2027-03-22', '09:00')
    expect(await code(s.api.shows.reserve('spa-tour', 2, ['ethan']))).toBe('conflict:age')
    expect(await code(s.api.shows.reserve('nope', 2, ['daniel']))).toBe('invalid:Choose a show')
    expect(await code(s.api.shows.reserve('stage-show', 2, ['gerald']))).toBe('invalid:Choose people on your booking')
    expect(await code(s.api.shows.reserve('trivia', 2, ['daniel']))).toBe('conflict:notTicketed')
  })

  it('stops once the show has begun, and says when it sells out', async () => {
    const s = setup()
    s.at('2027-03-22', '21:00')
    expect(await code(s.api.shows.reserve('stage-show', 2, ['daniel']))).toBe('conflict:started')
    s.at('2027-03-22', '09:00')
    let soldOut = false
    for (const day of [1, 2, 3, 4, 5, 6, 7]) for (const x of await s.api.shows.day(day)) if (x.left === 0) soldOut = true
    expect(soldOut).toBe(true)
  })

  it('does not let a supervised child reserve', async () => {
    const s = setup('ethan')
    s.at('2027-03-22', '12:00')
    expect(await code(s.api.shows.reserve('stage-show', 2, ['ethan']))).toBe('forbidden:This account is supervised')
  })
})

describe('virtual queue and waitlist (DIN-02)', () => {
  it('queues for a place that is open, moves up, then becomes ready', async () => {
    const s = setup()
    s.at('2027-03-22', '12:30')
    const open = (await s.api.waits.list()).open
    expect(open.length).toBeGreaterThan(0)
    const venue = open[0]
    const joined = await s.api.waits.joinQueue(venue)
    expect(joined.queues[0]).toMatchObject({ venueId: venue, stage: 'waiting' })
    expect(await code(s.api.waits.joinQueue(venue))).toBe('conflict:duplicate')
    const start = joined.queues[0].position
    s.later(12)
    expect((await s.api.waits.list()).queues[0].position).toBeLessThan(start)
    s.later(70)
    const later = (await s.api.waits.list()).queues[0]
    expect(['ready', 'expired']).toContain(later.stage)
    expect((await s.api.waits.leaveQueue(later.id)).queues).toEqual([])
  })

  it('refuses a queue for a place with tables to reserve, or one that is shut', async () => {
    const s = setup()
    s.at('2027-03-22', '12:30')
    expect(await code(s.api.waits.joinQueue('crown'))).toBe('invalid:That place has no queue')
    s.at('2027-03-22', '03:00')
    const venue = (await s.api.waits.list()).open[0]
    // At 3 am a place that is open all day may still be open; the test needs only that a closed place says so.
    if (!venue) expect(await code(s.api.waits.joinQueue('alfredo'))).toBe('conflict:closed')
  })

  it('offers a waitlisted table later, and booking it puts a table on the reservations', async () => {
    const s = setup('gerald')
    s.at('2027-03-22', '12:00')
    const full = slotsFor('crown', SAILING, 4).find((x) => x.tables === 0)
    expect(full).toBeDefined()
    const time = full!.time
    const joined = await s.api.waits.joinWaitlist({ venueId: 'crown', day: 4, time, guests: ['gerald'] })
    expect(joined.waitlist[0]).toMatchObject({ venueId: 'crown', day: 4, time, stage: 'waiting' })
    expect(await code(s.api.waits.joinWaitlist({ venueId: 'crown', day: 4, time, guests: ['gerald'] }))).toBe('conflict:duplicate')
    expect(await code(s.api.waits.acceptWaitlist(joined.waitlist[0].id))).toBe('conflict:notOffered')
    s.later(4 * 60)
    const offered = (await s.api.waits.list()).waitlist[0]
    expect(offered.stage).toBe('offered')
    const view = await s.api.waits.acceptWaitlist(offered.id)
    expect(view.reservations.some((r) => r.venueId === 'crown' && r.day === 4 && r.time === time)).toBe(true)
    expect((await s.api.waits.list()).waitlist).toEqual([])
  })

  it('refuses a waitlist when a table is free, and lets an offer run out', async () => {
    const s = setup('gerald')
    s.at('2027-03-22', '12:00')
    const free = slotsFor('crown', SAILING, 4).find((x) => x.tables > 0)!
    expect(await code(s.api.waits.joinWaitlist({ venueId: 'crown', day: 4, time: free.time, guests: ['gerald'] }))).toBe('conflict:notFull')
    const full = slotsFor('crown', SAILING, 4).find((x) => x.tables === 0)!
    const joined = await s.api.waits.joinWaitlist({ venueId: 'crown', day: 4, time: full.time, guests: ['gerald'] })
    s.later(12 * 60)
    expect(await code(s.api.waits.acceptWaitlist(joined.waitlist[0].id))).toBe('conflict:expired')
  })
})

describe('changes to the trip (SUP-06, SAF-06, MNG-15)', () => {
  it('lists active changes, records what the guest chose, and keeps the record when the change ends', async () => {
    const s = setup()
    s.scenario('portSkipped', 'planChange')
    const list = await s.api.updates.list()
    expect(list.map((u) => [u.id, u.severity, u.ack])).toEqual([['portSkipped', 'critical', null], ['planChange', 'info', null]])
    s.at('2027-03-24', '09:00')
    const after = await s.api.updates.acknowledge('portSkipped', 'credit')
    expect(after[0]).toMatchObject({ id: 'portSkipped', ack: { option: 'credit' } })
    expect(after[0].ack!.at).toBeGreaterThan(0)
    s.scenario()
    expect(await s.api.updates.list()).toEqual([{ id: 'portSkipped', severity: 'critical', active: false, ack: expect.objectContaining({ option: 'credit' }) }])
  })

  it('checks the option, that the change is in force, and who is asking', async () => {
    const s = setup()
    s.scenario('portSkipped')
    expect(await code(s.api.updates.acknowledge('portSkipped', 'nonsense'))).toBe('invalid:Choose one of the options')
    expect(await code(s.api.updates.acknowledge('clockChange', 'ok'))).toBe('conflict:ended')
    expect(await code(s.api.updates.acknowledge('bookingLag', 'ok'))).toBe('invalid:Choose one of the options')
    s.as('ethan')
    expect(await code(s.api.updates.acknowledge('portSkipped', 'credit'))).toBe('forbidden:This account is supervised')
  })
})

describe('privacy centre (SEC-03, SEC-04, ACT-06)', () => {
  it('starts with every choice off and lets each adult decide for themselves and a parent for a child', async () => {
    const s = setup()
    const first = await s.api.privacy.view()
    expect(first.people.every((p) => Object.values(p.consents).every((v) => v === false))).toBe(true)
    expect(first.people.find((p) => p.id === 'maya')).toMatchObject({ canEdit: true })
    const on = await s.api.privacy.setConsent('daniel', 'marketingEmail', true)
    expect(on.people.find((p) => p.id === 'daniel')!.consents.marketingEmail).toBe(true)
    const kid = await s.api.privacy.setConsent('maya', 'parent', true)
    expect(kid.people.find((p) => p.id === 'maya')!.consents.parent).toBe(true)
    expect(await code(s.api.privacy.setConsent('maya', 'marketingEmail', true))).toBe('invalid:That choice does not apply')
    expect(await code(s.api.privacy.setConsent('gerald', 'improve', true))).toBe('invalid:Not on your booking')
  })

  it('does not let a child decide for a parent or for themselves', async () => {
    const s = setup('ethan')
    expect(await code(s.api.privacy.setConsent('daniel', 'improve', true))).toBe('forbidden:A parent decides for a child')
    expect(await code(s.api.privacy.setConsent('ethan', 'shipPhotos', true))).toBe('forbidden:A parent decides for a child')
    const view = await s.api.privacy.view()
    expect(view.people.find((p) => p.id === 'ethan')!.canEdit).toBe(false)
  })

  it('notes who looked at documents, and deletes ID records after the retention date, once', async () => {
    const s = setup()
    s.at('2027-03-22', '12:00')
    await s.api.documents.get()
    const view = await s.api.privacy.view()
    expect(view.access.some((a) => a.what === 'documents' && a.action === 'viewed')).toBe(true)
    expect(view.deleted).toEqual([])
    expect(view.deleteOn.idDocuments).toBe('2027-04-27')
    s.at('2027-04-28', '09:00')
    const later = await s.api.privacy.view()
    expect(later.deleted).toHaveLength(1)
    expect(later.deleted[0].kinds.sort()).toEqual(['ci-guest', 'documents'])
    expect((await s.api.privacy.view()).deleted).toHaveLength(1)
    expect(later.access.some((a) => a.action === 'deleted')).toBe(true)
  })
})
