import { describe, expect, it } from 'vitest'
import { ALTERNATIVES } from './alternatives'
import { activeDisruptions, DISRUPTIONS, validOption } from './disruption'
import { consentsFor, deleteOn, isDue, kindsToDelete, normalizeConsents, RETENTION } from './privacy'
import { canJoinWaitlist, HOLD_MIN, queueState, startingPosition, waitlistState } from './queue'
import { routeBetween, stepFreeInstead } from './route'
import { canReturn, isTicketed, seatsLeft, takenByOthers, TICKETED, ticketProblem } from './tickets'
import { SCENARIOS } from './scenarios'
import { TOP_TASKS } from '../routes/nav'

const MIN = 60_000

describe('tickets', () => {
  it('knows which events have seats, and always leaves the same number', () => {
    expect(isTicketed('stage-show')).toBe(true)
    expect(isTicketed('trivia')).toBe(false)
    expect(takenByOthers('wine', 2)).toBe(takenByOthers('wine', 2))
    for (const id of Object.keys(TICKETED)) for (const day of [2, 6]) expect(takenByOthers(id, day)).toBeLessThanOrEqual(TICKETED[id].capacity)
  })

  it('subtracts our own seats and never goes below zero', () => {
    const left = seatsLeft('spa-tour', 2, 0)
    expect(seatsLeft('spa-tour', 2, 2)).toBe(Math.max(0, left - 2))
    expect(seatsLeft('spa-tour', 2, 999)).toBe(0)
  })

  it('has some events sold out and some with room, so both can be shown', () => {
    const all = Object.keys(TICKETED).flatMap((id) => [1, 2, 3, 4, 5, 6, 7].map((d) => seatsLeft(id, d, 0)))
    expect(all.some((n) => n === 0)).toBe(true)
    expect(all.some((n) => n > 5)).toBe(true)
  })

  it('refuses a seat for the right reason', () => {
    const base = { event: { id: 'stage-show', status: 'on' as const, startAt: 10_000_000, age: 'all' as const }, now: 0, guests: [{ id: 'a', age: 40 }], holders: [] as string[], held: 0 }
    expect(ticketProblem(base)).toBeNull()
    expect(ticketProblem({ ...base, event: { ...base.event, id: 'trivia' } })).toBe('notTicketed')
    expect(ticketProblem({ ...base, event: { ...base.event, status: 'cancelled' } })).toBe('cancelled')
    expect(ticketProblem({ ...base, now: 10_000_000 })).toBe('started')
    expect(ticketProblem({ ...base, guests: [] })).toBe('party')
    expect(ticketProblem({ ...base, event: { ...base.event, age: 'adults' }, guests: [{ id: 'k', age: 12 }] })).toBe('age')
    expect(ticketProblem({ ...base, holders: ['a'] })).toBe('duplicate')
    expect(canReturn({ startAt: 5 }, 4)).toBe(true)
    expect(canReturn({ startAt: 5 }, 5)).toBe(false)
  })
})

describe('virtual queue and waitlist', () => {
  it('moves up as time passes, then holds the table, then lets it go', () => {
    const start = startingPosition('alfredo', 0)
    expect(start).toBeGreaterThanOrEqual(3)
    expect(start).toBeLessThanOrEqual(10)
    const first = queueState(0, 5, 0)
    expect(first).toMatchObject({ stage: 'waiting', position: 5 })
    expect(queueState(0, 5, 12 * MIN).position).toBe(3)
    expect(queueState(0, 5, 30 * MIN)).toMatchObject({ stage: 'ready' })
    expect(queueState(0, 5, (30 + HOLD_MIN) * MIN).stage).toBe('expired')
    expect(queueState(0, 5, 29 * MIN).waitMinutes).toBe(1)
  })

  it('offers a waitlisted table, with a deadline before the slot', () => {
    const slot = 10 * 60 * MIN
    expect(waitlistState(0, slot, 60 * MIN).stage).toBe('waiting')
    expect(waitlistState(0, slot, 181 * MIN).stage).toBe('offered')
    expect(waitlistState(0, slot, 301 * MIN).stage).toBe('expired')
    // Joined close to the slot: offered sooner, and never after 15 minutes before it.
    const late = waitlistState(0, 2 * 60 * MIN, 61 * MIN)
    expect(late.stage).toBe('offered')
    expect(late.expiresAt).toBe(2 * 60 * MIN - 15 * MIN)
    expect(canJoinWaitlist(60 * MIN, 0)).toBe(true)
    expect(canJoinWaitlist(30 * MIN, 0)).toBe(false)
  })
})

describe('route finder', () => {
  it('walks along one deck, or rides a lift and walks the rest', () => {
    const same = routeBetween('eclipse', 'crown', { stepFree: false })
    expect(same).toMatchObject({ ok: true })
    if (same.ok) expect(same.steps.map((s) => s.kind)).toEqual(['walk', 'arrive'])
    const across = routeBetween('medical', 'lido-pool', { stepFree: false })
    expect(across).toMatchObject({ ok: true })
    if (across.ok) {
      expect(across.steps.map((s) => s.kind)).toEqual(['walk', 'lift', 'walk', 'arrive'])
      expect(across.steps.find((s) => s.kind === 'lift')).toMatchObject({ from: 4, to: 17 })
      expect(across.minutes).toBeGreaterThan(5)
    }
  })

  it('says so when a place has steps, and suggests a step-free one of the same kind', () => {
    const r = routeBetween('lido-pool', 'sun-bar', { stepFree: true })
    expect(r).toMatchObject({ ok: false, reason: 'notStepFree', place: { id: 'sun-bar' }, instead: { id: 'sea-view' } })
    expect(routeBetween('lido-pool', 'sun-bar', { stepFree: false })).toMatchObject({ ok: true, stepFree: false })
    expect(stepFreeInstead({ id: 'x', name: 'x', deck: 1, section: 'aft', kind: 'medical', stepFree: false })).toMatchObject({ id: 'medical' })
  })

  it('handles the same place and unknown places', () => {
    expect(routeBetween('eclipse', 'eclipse', { stepFree: false })).toMatchObject({ ok: false, reason: 'same' })
    expect(routeBetween('eclipse', 'nowhere', { stepFree: false })).toMatchObject({ ok: false, reason: 'unknown' })
  })
})

describe('disruptions', () => {
  it('are all real scenarios, with a choice to make and a way to say "I understand"', () => {
    const ids = new Set(SCENARIOS.map((s) => s.id))
    for (const d of DISRUPTIONS) {
      expect(ids.has(d.id), d.id).toBe(true)
      expect(d.options.length, d.id).toBeGreaterThan(0)
      expect(d.changes.length, d.id).toBeGreaterThan(0)
    }
  })

  it('lists the serious ones first and checks the option', () => {
    expect(activeDisruptions(['planChange', 'portSkipped', 'belizeTender']).map((d) => d.id)).toEqual(['portSkipped', 'belizeTender', 'planChange'])
    expect(activeDisruptions(['bookingLag'])).toEqual([])
    const skipped = DISRUPTIONS[0]
    expect(validOption(skipped, 'credit')).toBe(true)
    expect(validOption(skipped, 'nonsense')).toBe(false)
  })
})

describe('privacy', () => {
  it('deletes ID and photo data a set time after the cruise, and keeps the rest until asked', () => {
    const id = RETENTION.find((r) => r.id === 'idDocuments')!
    expect(deleteOn(id, '2027-03-28')).toBe('2027-04-27')
    expect(isDue(id, '2027-03-28', '2027-04-26')).toBe(false)
    expect(isDue(id, '2027-03-28', '2027-04-27')).toBe(true)
    expect(deleteOn(RETENTION.find((r) => r.id === 'payment')!, '2027-03-28')).toBeNull()
    expect(kindsToDelete('2027-03-28', '2027-04-01')).toEqual([])
    expect(kindsToDelete('2027-03-28', '2027-04-27').sort()).toEqual(['ci-guest', 'documents'])
    expect(kindsToDelete('2027-03-28', '2027-07-01').sort()).toEqual(['ci-guest', 'clubReg', 'documents', 'illness'])
  })

  it('starts every consent off and ignores bad data', () => {
    expect(Object.values(normalizeConsents(undefined)).every((v) => v === false)).toBe(true)
    expect(normalizeConsents({ marketingEmail: true, parent: 'yes' })).toMatchObject({ marketingEmail: true, parent: false })
  })

  it('asks a child under 13 for almost nothing, with a parent deciding', () => {
    expect(consentsFor(10).map((c) => c.id)).toEqual(['shipPhotos', 'parent'])
    expect(consentsFor(30).map((c) => c.id)).toEqual(['marketingEmail', 'marketingSms', 'improve', 'shipPhotos'])
  })
})

describe('desk and phone alternatives', () => {
  it('exist for every top task', () => {
    for (const task of TOP_TASKS) expect(ALTERNATIVES[task.id], task.id).toBeDefined()
  })
})
