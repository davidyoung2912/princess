import { describe, expect, it } from 'vitest'
import { zonedToEpoch } from '../../../domain/timezones'
import { scheduleStatus } from './scheduleStatus'

const zone = 'America/Los_Angeles'
const at = (date: string, time: string) => zonedToEpoch(date, time, zone)

describe('schedule status', () => {
  it('is preliminary until the evening before', () => {
    expect(scheduleStatus('2027-03-14', zone, at('2027-03-10', '09:00')).status).toBe('preliminary')
    expect(scheduleStatus('2027-03-14', zone, at('2027-03-13', '17:59')).status).toBe('preliminary')
  })
  it('is final from 6 pm the evening before through the day', () => {
    expect(scheduleStatus('2027-03-14', zone, at('2027-03-13', '18:00')).status).toBe('final')
    expect(scheduleStatus('2027-03-14', zone, at('2027-03-14', '15:00')).status).toBe('final')
  })
  it('is past once the day is over', () => {
    expect(scheduleStatus('2027-03-14', zone, at('2027-03-15', '00:00')).status).toBe('past')
  })
  it('says when it is expected to be final', () => {
    expect(scheduleStatus('2027-03-14', zone, at('2027-03-10', '09:00')).finalAt).toBe(at('2027-03-13', '18:00'))
  })
})
