import { describe, expect, it } from 'vitest'
import { actionGate, BOOKABLE_EXPLORERS, EXPLORER_IDS, type GateFacts } from './actionGate'

const base: GateFacts = { hasBooking: true, finished: false, canBook: true }

describe('actionGate', () => {
  it('is open when the server says the guest can book and no window is shut', () => {
    for (const id of BOOKABLE_EXPLORERS) expect(actionGate(id, base)).toEqual({ status: 'open' })
  })
  it('needs a booking before anything can be reserved', () => {
    for (const id of BOOKABLE_EXPLORERS) expect(actionGate(id, { ...base, hasBooking: false })).toEqual({ status: 'needsBooking' })
  })
  it('gives the date a shut window opens, and a plain closed state when there is none', () => {
    expect(actionGate('dining', { ...base, window: { open: false, opensOn: '2027-01-12' } })).toEqual({ status: 'opensOn', opensOn: '2027-01-12' })
    expect(actionGate('dining', { ...base, window: { open: false } })).toEqual({ status: 'closed' })
    expect(actionGate('dining', { ...base, window: { open: true } })).toEqual({ status: 'open' })
  })
  it('is read only for someone who cannot book', () => {
    expect(actionGate('spa', { ...base, canBook: false })).toEqual({ status: 'readOnly' })
  })
  it('never reads an unanswered server as open', () => {
    expect(actionGate('excursions', { ...base, canBook: null })).toEqual({ status: 'closed' })
  })
  it('is finished once the cruise is over, whatever else is true', () => {
    for (const id of EXPLORER_IDS) expect(actionGate(id, { ...base, finished: true })).toEqual({ status: 'finished' })
  })
  it('has nothing to reserve in the Explorers without a reservation', () => {
    for (const id of EXPLORER_IDS.filter((x) => !BOOKABLE_EXPLORERS.includes(x))) {
      expect(actionGate(id, { ...base, hasBooking: false, canBook: null })).toEqual({ status: 'open' })
    }
  })
})
