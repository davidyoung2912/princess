import { describe, expect, it } from 'vitest'
import { JOURNEY_STAGES } from '../../routes/hubs'
import { actionGate, EXPLORER_IDS, type ActionGate, type ExplorerId } from './actionGate'
import { EXPLORER_ROUTES, explorerLens, explorerOrder, tileLine } from './lens'
import { en as EN } from '../../i18n/locales/en'

const open: ActionGate = { status: 'open' }
const line = (stage: (typeof JOURNEY_STAGES)[number], explorer: ExplorerId, gate: ActionGate = open, next?: string) => tileLine({ stage, explorer, gate, next })?.key ?? null

describe('tileLine (the stage table)', () => {
  it('invites research at dream and discover', () => {
    for (const s of ['dream', 'discover'] as const) {
      expect(line(s, 'dining', { status: 'needsBooking' })).toBe('explorers.see.dining')
      expect(line(s, 'spa', { status: 'needsBooking' })).toBe('explorers.see.spa')
      expect(line(s, 'excursions', { status: 'needsBooking' })).toBe('explorers.see.excursions')
      expect(line(s, 'entertainment')).toBe('explorers.see.events')
    }
  })
  it('says reserve after you book at book', () => {
    for (const id of ['dining', 'spa', 'excursions'] as const) expect(line('book', id, { status: 'needsBooking' })).toBe('explorers.afterBooking')
    expect(line('book', 'shopping')).toBe('explorers.see.events')
  })
  it('gives the date a window opens at manage', () => {
    expect(tileLine({ stage: 'manage', explorer: 'dining', gate: { status: 'opensOn', opensOn: '2027-01-12' } })).toEqual({ key: 'explorers.opensOn', params: { date: '2027-01-12' } })
    expect(line('manage', 'spa')).toBe('explorers.open.now')
    expect(line('manage', 'activities')).toBe('explorers.plan')
  })
  it('leads with the action before sailing and with what is next once aboard', () => {
    expect(line('prebook', 'dining')).toBe('explorers.book.dining')
    expect(line('getToShip', 'excursions')).toBe('explorers.book.excursions')
    expect(line('sea', 'dining', open, 'dinner at 7:00')).toBe('explorers.next')
    expect(line('port', 'entertainment', open, '3 events')).toBe('explorers.on.now')
  })
  it('says little at disembark and looks back at remember', () => {
    for (const id of EXPLORER_IDS) expect(line('disembark', id)).toBeNull()
    expect(line('disembark', 'dining', open, 'breakfast')).toBe('explorers.last.dining')
    expect(line('remember', 'dining', { status: 'finished' })).toBe('explorers.past.dining')
    expect(line('remember', 'shopping')).toBe('explorers.past.events')
  })
  it('always gives a reason where an action is not open, and never says disabled', () => {
    for (const stage of JOURNEY_STAGES) for (const id of ['dining', 'spa', 'excursions'] as const) {
      for (const gate of [{ status: 'readOnly' }, { status: 'closed' }, { status: 'opensOn', opensOn: '2027-01-12' }] as const) {
        if (stage === 'disembark' || stage === 'remember') continue
        const key = line(stage, id, gate)
        expect(key, `${stage} ${id} ${gate.status}`).not.toBeNull()
        expect(EN[key as keyof typeof EN].toLowerCase()).not.toContain('disabled')
      }
    }
  })
  it('never lets the stage change what the gate says is shut (levels 2 to 4 follow the gate only)', () => {
    for (const stage of JOURNEY_STAGES) for (const id of ['dining', 'spa', 'excursions'] as const) {
      if (stage === 'disembark' || stage === 'remember') continue
      for (const status of ['readOnly', 'closed'] as const) {
        expect(['explorers.open.now', 'explorers.next', 'explorers.book.dining', 'explorers.book.spa', 'explorers.book.excursions']).not.toContain(line(stage, id, { status }))
      }
    }
  })
  it('has text for every key it can return', () => {
    for (const stage of JOURNEY_STAGES) for (const id of EXPLORER_IDS) for (const status of ['open', 'opensOn', 'needsBooking', 'readOnly', 'closed', 'finished'] as const) {
      const l = tileLine({ stage, explorer: id, gate: { status, opensOn: '2027-01-12' }, next: 'x' })
      if (l) expect(EN[l.key as keyof typeof EN], l.key).toBeTruthy()
    }
  })
})

describe('the front door', () => {
  it('lists all seven Explorers at every stage, once each', () => {
    for (const stage of JOURNEY_STAGES) expect([...explorerOrder(stage)].sort()).toEqual([...EXPLORER_IDS].sort())
  })
  it('leads with dining and tours before sailing and with what is on when aboard', () => {
    expect(explorerOrder('prebook').slice(0, 2)).toEqual(['dining', 'excursions'])
    expect(explorerOrder('sea')[0]).toBe('entertainment')
  })
  it('points every Explorer at a different address', () => {
    expect(new Set(Object.values(EXPLORER_ROUTES)).size).toBe(7)
  })
})

describe('explorerLens', () => {
  it('opens on the whole trip before sailing and on today aboard', () => {
    expect(explorerLens('prebook', open)).toMatchObject({ first: 'booking', scope: 'trip' })
    expect(explorerLens('sea', open)).toMatchObject({ first: 'today', scope: 'day' })
    expect(explorerLens('dream', { status: 'needsBooking' })).toMatchObject({ first: 'saved' })
  })
  it('only changes words with the gate at manage', () => {
    expect(explorerLens('manage', open).purposeKey).toBe('explorers.purpose.plan')
    expect(explorerLens('manage', { status: 'opensOn', opensOn: '2027-01-12' }).purposeKey).toBe('explorers.purpose.wait')
  })
  it('is built only from the gate in actionGate (no stage input to it)', () => {
    expect(actionGate('dining', { hasBooking: true, finished: false, canBook: true })).toEqual(open)
  })
  it('has text for every key it returns', () => {
    for (const stage of JOURNEY_STAGES) {
      const l = explorerLens(stage, open)
      expect(EN[l.headingKey as keyof typeof EN]).toBeTruthy()
      expect(EN[l.purposeKey as keyof typeof EN]).toBeTruthy()
    }
  })
})
