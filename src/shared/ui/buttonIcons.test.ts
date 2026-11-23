import { CalendarCheck, CalendarX } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { buttonIcon } from './buttonIcons'

describe('buttonIcon for making a reservation or booking', () => {
  it('gives every way of reserving or booking the calendar with a tick', () => {
    for (const label of ['Book a Table', 'Book', 'Make a reservation', 'New reservation', 'Reserve', 'Book a treatment']) expect(buttonIcon(label, false), label).toBe(CalendarCheck)
  })
  it('keeps cancelling a booking on its own icon', () => {
    expect(buttonIcon('Cancel reservation', false)).toBe(CalendarX)
  })
})
