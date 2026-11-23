import { describe, expect, it } from 'vitest'
import { deepLinkNotes, parseDeepLink, type DeepLink } from './deepLink'

describe('deep links from alerts (MOB-07, COM-06)', () => {
  it('reads the trip and the update, and ignores anything odd', () => {
    expect(parseDeepLink('?trip=PC243902&update=chatSlow')).toEqual({ trip: 'PC243902', update: 'chatSlow', reservation: null, caseNumber: null, port: null, date: null })
    expect(parseDeepLink('')).toEqual({ trip: null, update: null, reservation: null, caseNumber: null, port: null, date: null })
    expect(parseDeepLink('?trip=<script>&update=a b')).toEqual({ trip: null, update: null, reservation: null, caseNumber: null, port: null, date: null })
  })
  it('says so when the alert was about another trip', () => {
    expect(deepLinkNotes({ trip: 'A', update: null }, { currentTrip: 'B', activeUpdates: null })).toEqual(['otherTrip'])
    expect(deepLinkNotes({ trip: 'A', update: null }, { currentTrip: 'A', activeUpdates: null })).toEqual([])
    expect(deepLinkNotes({ trip: 'A', update: null }, { currentTrip: null, activeUpdates: null })).toEqual([])
  })
  it('says so when the change has ended, but only once the list is known', () => {
    expect(deepLinkNotes({ trip: null, update: 'x' }, { currentTrip: null, activeUpdates: ['y'] })).toEqual(['updateEnded'])
    expect(deepLinkNotes({ trip: null, update: 'x' }, { currentTrip: null, activeUpdates: ['x'] })).toEqual([])
    expect(deepLinkNotes({ trip: null, update: 'x' }, { currentTrip: null, activeUpdates: null })).toEqual([])
  })
})

const link = (over: Partial<DeepLink>): DeepLink => ({ trip: null, update: null, reservation: null, caseNumber: null, port: null, date: null, ...over })
describe('reservation, case and port-day links (MOB-07, COM-06)', () => {
  it('reads the reservation, case, port and date, and ignores odd values', () => {
    expect(parseDeepLink('?reservation=r-12&case=CS-0007&port=nassau&date=2027-03-24')).toMatchObject({ reservation: 'r-12', caseNumber: 'CS-0007', port: 'nassau', date: '2027-03-24' })
    expect(parseDeepLink('?reservation=a%20b&date=tomorrow')).toMatchObject({ reservation: null, date: null })
  })
  it('says so when a reservation is gone, a case is closed or the port day has passed, once known', () => {
    const now = { currentTrip: null, activeUpdates: null }
    expect(deepLinkNotes(link({ reservation: 'r1' }), { ...now, reservations: ['r2'] })).toEqual(['reservationGone'])
    expect(deepLinkNotes(link({ reservation: 'r1' }), { ...now, reservations: ['r1'] })).toEqual([])
    expect(deepLinkNotes(link({ reservation: 'r1' }), { ...now, reservations: null })).toEqual([])
    expect(deepLinkNotes(link({ caseNumber: 'C1' }), { ...now, openCases: [] })).toEqual(['caseClosed'])
    expect(deepLinkNotes(link({ port: 'nassau', date: '2027-03-24' }), { ...now, today: '2027-03-25' })).toEqual(['portPassed'])
    expect(deepLinkNotes(link({ port: 'nassau', date: '2027-03-24' }), { ...now, today: '2027-03-24' })).toEqual([])
    expect(deepLinkNotes(link({ port: 'nassau', date: '2027-03-24' }), now)).toEqual([])
  })
})
