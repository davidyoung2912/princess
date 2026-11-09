import { describe, expect, it } from 'vitest'
import { buildIcs, buildIcsCalendar, type IcsEvent } from './calendar'

const base: IcsEvent = { uid: 'PB1-sail@princess.concept', summary: 'Sail-away', description: '', location: '', start: '2027-03-21', end: '2027-03-21', stamp: Date.UTC(2026, 9, 29, 12) }

describe('calendar export: zones', () => {
  it('writes a zoned time in UTC so it lands on the right moment', () => {
    const ics = buildIcs({ ...base, at: '16:00', zone: 'America/New_York', minutes: 30 })
    // 21 March 2027 is after the US spring change (14 March): EDT, UTC-4.
    expect(ics).toContain('DTSTART:20270321T200000Z')
    expect(ics).toContain('DTEND:20270321T203000Z')
  })

  it('uses the standard-time offset before the clock change', () => {
    const ics = buildIcs({ ...base, start: '2027-03-10', end: '2027-03-10', at: '16:00', zone: 'America/New_York' })
    expect(ics).toContain('DTSTART:20270310T210000Z')
  })

  it('handles a zone with no daylight saving', () => {
    expect(buildIcs({ ...base, at: '09:00', zone: 'America/Cancun' })).toContain('DTSTART:20270321T140000Z')
  })

  it('writes a floating time when there is no zone', () => {
    const ics = buildIcs({ ...base, at: '09:00', minutes: 90 })
    expect(ics).toContain('DTSTART:20270321T090000\r\n')
    expect(ics).toContain('DTEND:20270321T103000\r\n')
  })

  it('carries a floating event past midnight onto the next date', () => {
    expect(buildIcs({ ...base, at: '23:30', minutes: 60 })).toContain('DTEND:20270322T003000\r\n')
  })
})

describe('calendar export: update and cancel', () => {
  it('keeps the uid and starts at sequence 0', () => {
    const ics = buildIcs(base)
    expect(ics).toContain('UID:PB1-sail@princess.concept')
    expect(ics).toContain('SEQUENCE:0\r\n')
    expect(ics).toContain('METHOD:PUBLISH')
  })

  it('an update reuses the uid with a higher sequence', () => {
    const ics = buildIcs({ ...base, sequence: 2, summary: 'Sail-away (moved)' })
    expect(ics).toContain('UID:PB1-sail@princess.concept')
    expect(ics).toContain('SEQUENCE:2\r\n')
  })

  it('ignores a negative or fractional sequence', () => {
    expect(buildIcs({ ...base, sequence: -3 })).toContain('SEQUENCE:0\r\n')
    expect(buildIcs({ ...base, sequence: 1.9 })).toContain('SEQUENCE:1\r\n')
  })

  it('a cancelled event is marked cancelled and the file is a cancel', () => {
    const ics = buildIcs({ ...base, sequence: 3, cancelled: true })
    expect(ics).toContain('METHOD:CANCEL')
    expect(ics).toContain('STATUS:CANCELLED\r\n')
    expect(ics).toContain('SEQUENCE:3\r\n')
  })

  it('cancelled wins over tentative', () => {
    const ics = buildIcs({ ...base, tentative: true, cancelled: true })
    expect(ics).toContain('STATUS:CANCELLED')
    expect(ics).not.toContain('TENTATIVE')
  })

  it('a mixed file stays a publish', () => {
    const ics = buildIcsCalendar([base, { ...base, uid: 'other', cancelled: true }])
    expect(ics).toContain('METHOD:PUBLISH')
    expect(ics.match(/STATUS:CANCELLED/g)).toHaveLength(1)
  })
})
