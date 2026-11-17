import { formatTime } from '../cruise'
import { eventPhase } from './upcoming'

/** The earliest table today at or after the ship clock, as "dinner at 7:00 PM" with its venue left to the page; null when none is left. */
export function nextTable(reservations: readonly { day: number; time: string }[], day: number, nowTime: string): string | null {
  const next = reservations.filter((r) => r.day === day && r.time >= nowTime).sort((a, b) => a.time.localeCompare(b.time))[0]
  return next ? `a table at ${formatTime(next.time)}` : null
}

/** The earliest treatment today that has not started, as "treatment at 2:30 PM"; null when none is left. */
export function nextTreatment(appointments: readonly { day: number; time: string; startAt: number }[], day: number, nowAt: number): string | null {
  const next = appointments.filter((a) => a.day === day && a.startAt >= nowAt).sort((a, b) => a.startAt - b.startAt)[0]
  return next ? `a treatment at ${formatTime(next.time)}` : null
}

/** The earliest booked tour today that has not left, as "a tour at 9:00 AM"; null when none is left. `tours` are today's booked tours with their start as ship time "HH:MM". */
export function nextTour(tours: readonly { start: string }[], nowTime: string): string | null {
  const next = tours.filter((x) => x.start >= nowTime).sort((a, b) => a.start.localeCompare(b.start))[0]
  return next ? `a tour at ${formatTime(next.start)}` : null
}

/** How many events are in progress right now, as "1 event" or "3 events"; null when none is (a cancelled event is not on). */
export function eventsOnNow(events: readonly { startAt: number; endAt: number; status: string }[], now: number): string | null {
  const count = events.filter((e) => e.status !== 'cancelled' && eventPhase(e, now) === 'now').length
  return count === 0 ? null : count === 1 ? '1 event' : `${count} events`
}
