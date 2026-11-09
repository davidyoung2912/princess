import { describe, expect, it } from 'vitest'
import { deepLinkNotes, parseDeepLink } from './deepLink'

describe('deep links from alerts (MOB-07, COM-06)', () => {
  it('reads the trip and the update, and ignores anything odd', () => {
    expect(parseDeepLink('?trip=PC243902&update=chatSlow')).toEqual({ trip: 'PC243902', update: 'chatSlow' })
    expect(parseDeepLink('')).toEqual({ trip: null, update: null })
    expect(parseDeepLink('?trip=<script>&update=a b')).toEqual({ trip: null, update: null })
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
