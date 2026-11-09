import { describe, expect, it } from 'vitest'
import type { HistoryTrip } from '../api/finishTypes'
import { matchTrips } from './historySearch'

const trip = (id: string, title: string, ship: string, departure: string): HistoryTrip => ({ id, title, ship, departure, ports: [{ code: 'HNL', name: 'Honolulu', lat: 0, lon: 0 }], nights: 7, current: false, cancelled: false, fareCents: null, documents: [] })
const trips = [trip('a', 'Alaska Inside Passage', 'Royal Princess', '2024-06-01'), trip('b', 'Hawaii', 'Star Princess', '2025-02-10')]

// proves: REM-01#1
describe('matchTrips', () => {
  it('returns everything for a blank search', () => expect(matchTrips(trips, '  ')).toHaveLength(2))
  it('needs every word to match, in any field, ignoring case', () => {
    expect(matchTrips(trips, 'alaska royal').map((x) => x.id)).toEqual(['a'])
    expect(matchTrips(trips, '2025').map((x) => x.id)).toEqual(['b'])
    expect(matchTrips(trips, 'alaska star')).toEqual([])
  })
})
