import { formatTime } from '../cruise'

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
