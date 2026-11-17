import { describe, expect, it } from 'vitest'
import { normalizeAutoActs, normalizeAutoDrafts, normalizeAutoPlan, normalizeAutoRun, normalizeAutoStanding } from './stanleyAuto'

const m = (key: string, dueAt = '2027-01-13T17:00:00Z') => ({ key, text: 'Your final payment is due in 7 days.', dueAt, receipt: 'STN-ABCD1234' })

describe('normalizeAutoRun', () => {
  it('rejects anything that is not the agreed shape', () => {
    expect(normalizeAutoRun(null)).toBeNull()
    expect(normalizeAutoRun({ made: [] })).toBeNull()
  })
  it('keeps the server order and what was made', () => {
    expect(normalizeAutoRun({ on: true, made: [m('b'), m('a')] })!.made.map((x) => x.key)).toEqual(['b', 'a'])
  })
  it('drops a reminder with no key or an unreadable time', () => {
    const r = normalizeAutoRun({ on: true, made: [m(''), m('a', 'soon'), m('c')] })!
    expect(r.made.map((x) => x.key)).toEqual(['c'])
  })
  it('says off when the guest has not switched it on', () => {
    expect(normalizeAutoRun({ on: false, made: [], waiting: [], notChecked: ['x'] })).toMatchObject({ on: false, made: [], notChecked: ['x'] })
  })
})

describe('normalizeAutoPlan', () => {
  const pick = { id: 'trivia', day: 3, title: 'Trivia', start: '10:00', minutes: 45, place: 'bar' }
  it('rejects anything that is not the agreed shape', () => {
    expect(normalizeAutoPlan(null)).toBeNull()
    expect(normalizeAutoPlan({ picks: [] })).toBeNull()
  })
  it('keeps good picks in server order and drops bad ones', () => {
    const r = normalizeAutoPlan({ on: true, picks: [pick, { ...pick, id: '' }, { ...pick, start: 'ten' }, { ...pick, day: 0 }, { ...pick, id: 'b', day: 2 }], added: ['x'], removed: [] })!
    expect(r.picks.map((p) => p.id)).toEqual(['trivia', 'b'])
    expect(r.added).toEqual(['x'])
  })
  it('says off', () => {
    expect(normalizeAutoPlan({ on: false, picks: [] })).toMatchObject({ on: false, picks: [] })
  })
})

describe('normalizeAutoDrafts', () => {
  it('rejects anything that is not the agreed shape', () => {
    expect(normalizeAutoDrafts({ drafts: [] })).toBeNull()
  })
  it('keeps only the two known kinds with words', () => {
    const r = normalizeAutoDrafts({ on: true, drafts: [{ kind: 'late-note', text: 'Hello', savedAt: 'x' }, { kind: 'other', text: 'no' }, { kind: 'party-plan', text: '' }], saved: ['Note'] })!
    expect(r.drafts.map((d) => d.kind)).toEqual(['late-note'])
    expect(r.saved).toEqual(['Note'])
  })
})

describe('normalizeAutoActs', () => {
  const act = { key: 'aut04:s:2', text: 'Reserve a table in the Eclipse Dining Room, night 2, 18:00', receipt: 'STN-ABCD1234' }
  it('rejects anything that is not the agreed shape', () => {
    expect(normalizeAutoActs(null)).toBeNull()
    expect(normalizeAutoActs({ made: [] })).toBeNull()
  })
  it('keeps what was done in server order and drops an act with no key or words', () => {
    const r = normalizeAutoActs({ on: true, made: [act, { ...act, key: '' }, { ...act, text: '' }, { ...act, key: 'b' }], waiting: ['x'] })!
    expect(r.made.map((x) => x.key)).toEqual(['aut04:s:2', 'b'])
    expect(r.waiting).toEqual(['x'])
  })
  it('says off', () => {
    expect(normalizeAutoActs({ on: false, made: [], waiting: [], notChecked: ['n'] })).toMatchObject({ on: false, made: [], notChecked: ['n'] })
  })
})

describe('normalizeAutoStanding', () => {
  it('rejects anything that is not the agreed shape', () => {
    expect(normalizeAutoStanding(null)).toBeNull()
    expect(normalizeAutoStanding({ usualDinner: 3 })).toBeNull()
  })
  it('keeps only times and the three requests a standing order may repeat', () => {
    const r = normalizeAutoStanding({ usualDinner: '18:30', orderItem: 'plumbing', orderTime: '19:00', dinnerTimes: ['18:00', 'late'], orderItems: ['ice', 'plumbing'], notChecked: [] })!
    expect(r.usualDinner).toBe('18:30')
    expect(r.orderItem).toBe('')
    expect(r.dinnerTimes).toEqual(['18:00'])
    expect(r.orderItems).toEqual(['ice'])
  })
})
