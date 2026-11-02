import { describe, expect, it } from 'vitest'
import { MEET_NOTE_MAX, meetCard, meetProblem, meetText, type MeetInput } from './meetingPoint'

const ok: MeetInput = { kind: 'dropoff', time: '11:30', phone: '', note: '' }

describe('meeting-point card (N6.4)', () => {
  it('checks the time, the phone line and the note', () => {
    expect(meetProblem(ok)).toBeNull()
    expect(meetProblem({ ...ok, time: '25:00' })).toBe('time')
    expect(meetProblem({ ...ok, time: '' })).toBe('time')
    expect(meetProblem({ ...ok, phone: '+1 (954) 555-0100' })).toBeNull()
    expect(meetProblem({ ...ok, phone: 'call me maybe' })).toBe('phone')
    expect(meetProblem({ ...ok, note: 'x'.repeat(MEET_NOTE_MAX + 1) })).toBe('note')
  })

  it('gives no card for bad entries', () => {
    expect(meetCard({ ...ok, time: 'soon' })).toBeNull()
  })

  it('writes address, time, a landmark in words and a map link, with no picture', () => {
    const text = meetText(meetCard(ok)!)
    expect(text).toContain('Drop-off at the cruise terminal')
    expect(text).toContain('1850 Eller Drive')
    expect(text).toContain('11:30 AM')
    expect(text).toContain('curb')
    expect(text).toContain('https://www.google.com/maps/search/?api=1&query=')
    expect(text).not.toMatch(/Ring on arrival|Also:/)
  })

  it('leaves the pick-up time in the afternoon and adds the optional lines only when typed', () => {
    const text = meetText(meetCard({ kind: 'pickup', time: '09:05', phone: '555 0100', note: 'Grey car' })!)
    expect(text).toContain('Pick-up from: 9:05 AM')
    expect(text).toContain('Ring on arrival: 555 0100')
    expect(text).toContain('Also: Grey car')
    expect(meetText(meetCard({ ...ok, time: '12:00' })!)).toContain('12:00 PM')
  })
})
