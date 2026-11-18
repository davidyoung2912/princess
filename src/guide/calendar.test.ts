import { describe, expect, it } from 'vitest'
import { calendarDay, taskCalendarEvent, taskCalendarFile } from './calendar'

const task = (o: Partial<{ id: string; state: 'todo' | 'waiting' | 'blocked' | 'done'; due: string | null; opensAt: string | null }>) => ({ id: 'manage.pay', state: 'todo' as const, due: '2026-12-04', opensAt: null, ...o })

describe('a task in the calendar', () => {
  it('uses the day it opens when waiting, otherwise its due day, and none when done or undated', () => {
    expect(calendarDay(task({}))).toBe('2026-12-04')
    expect(calendarDay(task({ state: 'waiting', opensAt: '2026-12-19', due: '2026-12-22' }))).toBe('2026-12-19')
    expect(calendarDay(task({ state: 'done' }))).toBeNull()
    expect(calendarDay(task({ due: null }))).toBeNull()
  })

  it('makes a stable all-day event, so a second add replaces the first', () => {
    const a = taskCalendarEvent(task({}), 'Pay what is due', 'Your balance is due.', 1)
    const b = taskCalendarEvent(task({}), 'Pay what is due', 'Your balance is due.', 2)
    expect(a?.uid).toBe(b?.uid)
    expect(a).toMatchObject({ start: '2026-12-04', end: '2026-12-04', summary: 'Pay what is due' })
    expect(taskCalendarEvent(task({ state: 'waiting', opensAt: '2026-12-19' }), 'Check in online', 'x', 1)?.summary).toBe('Opens: Check in online')
  })

  it('writes a calendar file only when there is a day', () => {
    const file = taskCalendarFile(task({}), 'Pay, now', 'Why;', 1)
    expect(file).toContain('BEGIN:VEVENT')
    expect(file).toContain('DTSTART;VALUE=DATE:20261204')
    expect(file).toContain('SUMMARY:Pay\\, now')
    expect(taskCalendarFile(task({ due: null }), 't', 'w', 1)).toBeNull()
  })
})
