import { describe, expect, it } from 'vitest'
import { accommodationStatus } from './tickets'

describe('accommodation request status on a ticket (PRE-10)', () => {
  const guests = [{ id: 'a' }, { id: 'b' }]
  it('shows only seating-related requests for the guests on the ticket', () => {
    const requests = [{ kind: 'assistiveListening', guest: 'a', status: 'received' }, { kind: 'cpap', guest: 'a', status: 'confirmed' }, { kind: 'wheelchair', guest: 'z', status: 'confirmed' }]
    expect(accommodationStatus(guests, requests)).toEqual([{ guest: guests[0], kind: 'assistiveListening', status: 'received' }])
    expect(accommodationStatus(guests, [])).toEqual([])
  })
})
