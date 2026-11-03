import { beforeAll, describe, expect, it } from 'vitest'
import { daysBetween, journeyPosition } from './journeyPosition'
import { REFERENCE_SAILING, SAILINGS } from './sailings'
import { applySailings } from './sailingsServed'
import { zonedToEpoch } from './timezones'

const wire = () => ({
  version: 'abc',
  sailings: [{ id: 'sun-2027-03-21', departure: '2027-03-21', holiday: false, reference: true }],
  ports: [
    { id: 'fll', name: 'Fort Lauderdale', zone: 'America/New_York', tender: false },
    { id: 'cozumel', name: 'Cozumel, Mexico', zone: 'America/Cancun', tender: false },
  ],
  itinerary: [
    { day: 1, port: 'fll', arrive: null, allAboard: null, depart: '15:00' },
    { day: 2, port: 'sea', arrive: null, allAboard: null, depart: null },
    { day: 3, port: 'cozumel', arrive: '07:00', allAboard: '16:30', depart: '17:00' },
    { day: 4, port: 'sea', arrive: null, allAboard: null, depart: null },
    { day: 5, port: 'sea', arrive: null, allAboard: null, depart: null },
    { day: 6, port: 'sea', arrive: null, allAboard: null, depart: null },
    { day: 7, port: 'sea', arrive: null, allAboard: null, depart: null },
    { day: 8, port: 'fll', arrive: '06:00', allAboard: null, depart: null },
  ],
  shipHomeZone: 'America/New_York',
  shipWestZone: 'America/Belize',
})

const PHONE = 'America/Chicago'
const at = (date: string, time: string) => zonedToEpoch(date, time, 'America/New_York')

describe('journeyPosition', () => {
  beforeAll(async () => {
    const { normalizeSailings } = await import('./sailingsServed')
    applySailings(normalizeSailings(wire())!)
  })

  const pos = (now: number, hasBooking = true) => journeyPosition({ hasBooking, sailing: REFERENCE_SAILING, now, phoneZone: PHONE })

  it('has the sailing table loaded', () => expect(SAILINGS.length).toBe(1))

  it('puts a guest with no booking before booking, whatever the date', () => {
    const p = pos(at('2027-03-22', '12:00'), false)
    expect(p).toMatchObject({ stage: 'discover', sailingStage: null, day: null, onBoard: false, clock: 'local' })
  })

  it('counts days to departure before the cruise, on the guest\'s own clock', () => {
    const p = pos(at('2027-03-09', '12:00'))
    expect(p.onBoard).toBe(false)
    expect(p.clock).toBe('local')
    expect(p.zone).toBe(PHONE)
    expect(p.day).toEqual({ kind: 'daysToDeparture', days: 12 })
    expect(p.stage).toBe('prebook')
  })

  it('moves to get-to-ship when check-in opens', () => {
    expect(pos(at('2027-03-19', '12:00')).stage).toBe('getToShip')
  })

  it('is on board from embarkation, on ship time, with the cruise day', () => {
    const p = pos(at('2027-03-21', '12:00'))
    expect(p).toMatchObject({ onBoard: true, clock: 'ship', stage: 'embark', day: { kind: 'cruiseDay', day: 1, of: 8 } })
    expect(pos(at('2027-03-23', '12:00')).day).toEqual({ kind: 'cruiseDay', day: 3, of: 8 })
    expect(pos(at('2027-03-23', '12:00')).stage).toBe('port')
  })

  it('follows the ship\'s clock change west', () => {
    const p = pos(at('2027-03-24', '12:00'))
    expect(p.zone).toBe('America/Belize')
  })

  it('is no longer on board after arrival day midday, and counts days since', () => {
    expect(pos(at('2027-03-28', '08:00')).onBoard).toBe(true)
    const after = pos(at('2027-04-01', '12:00'))
    expect(after).toMatchObject({ onBoard: false, clock: 'local', stage: 'remember' })
    expect(after.day).toEqual({ kind: 'daysSinceReturn', days: 4 })
  })
})

describe('daysBetween', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2027-03-09', '2027-03-21')).toBe(12)
    expect(daysBetween('2027-03-21', '2027-03-21')).toBe(0)
  })

  it('takes the stage the server derived over the clock, and keeps the day and clock from the sailing', () => {
    const server = { stage: 'dream' as const, reason: 'noSailing', focusSailingId: null }
    const p = journeyPosition({ hasBooking: false, server, sailing: REFERENCE_SAILING, now: at('2027-03-10', '12:00'), phoneZone: PHONE })
    expect(p.stage).toBe('dream')
    expect(p.stageReason).toBe('noSailing')
    const booked = journeyPosition({ hasBooking: true, server: { stage: 'prebook', reason: 'paidInFull', focusSailingId: REFERENCE_SAILING.id }, sailing: REFERENCE_SAILING, now: at('2027-03-10', '12:00'), phoneZone: PHONE })
    expect(booked.stage).toBe('prebook')
    expect(booked.focusSailingId).toBe(REFERENCE_SAILING.id)
    expect(booked.day).toEqual({ kind: 'daysToDeparture', days: 11 })
  })

  it('falls back to the clock when the server gives no stage', () => {
    const p = journeyPosition({ hasBooking: false, server: { stage: null, reason: null, focusSailingId: null }, sailing: REFERENCE_SAILING, now: at('2027-03-10', '12:00'), phoneZone: PHONE })
    expect(p.stage).toBe('discover')
    expect(p.stageReason).toBeNull()
  })
})
