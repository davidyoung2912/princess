import { describe, expect, it } from 'vitest'
import { nearestFreeSlot } from './reservationNudge'

const slots = [{ time: '17:30', tables: 2 }, { time: '18:00', tables: 0 }, { time: '18:30', tables: 3 }, { time: '19:00', tables: 1 }, { time: '20:00', tables: 4 }]

describe('nearestFreeSlot', () => {
  it('finds the closest free slot either way, skipping full ones', () => {
    expect(nearestFreeSlot(slots, '18:30', 'earlier')?.time).toBe('17:30')
    expect(nearestFreeSlot(slots, '18:30', 'later')?.time).toBe('19:00')
    expect(nearestFreeSlot(slots, '19:00', 'later')?.time).toBe('20:00')
  })
  it('gives null when there is none', () => {
    expect(nearestFreeSlot(slots, '17:30', 'earlier')).toBeNull()
    expect(nearestFreeSlot(slots, '20:00', 'later')).toBeNull()
  })
})

import { dayCard, portCard } from './export'

describe('share cards', () => {
  it('lists only booked things in time order', () => {
    const c = dayCard({ day: 2, date: '2027-01-02', port: 'sea', place: '', entries: [{ kind: 'dinner', time: '19:00', name: 'Crown Grill', guests: [] }, { kind: 'tour', time: '09:00', name: 'Reef tour', guests: [] }, { kind: 'sail', time: '17:00', name: '', guests: [] }], gaps: [] }, 'Sun Princess', 'My plan')
    expect(c.lines).toEqual(['09:00  Reef tour', '19:00  Crown Grill'])
  })
  it('makes a port card from its facts', () => {
    expect(portCard('Cozumel', [{ label: 'Currency', value: 'Peso' }]).lines).toEqual(['Currency: Peso'])
  })
})
