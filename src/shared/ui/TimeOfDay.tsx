import { dayPartOf, type DayPart } from '../../features/explorer/domain/dayPart'
import { Moon, MoonStar, Sun, Sunrise, Sunset } from './icons'

const ICON = { smallHours: MoonStar, morning: Sunrise, day: Sun, evening: Sunset, night: Moon } as const satisfies Record<DayPart, unknown>

/** The icon for the part of the day a start time falls in (sunrise, sun, sunset, moon). Decorative: the time is always written beside it. */
export function TimeOfDayIcon({ time }: { time: string }) {
  const part = dayPartOf(time)
  if (!part) return null
  const Icon = ICON[part]
  return <Icon className={`time-of-day time-of-day--${part}`} aria-hidden="true" focusable="false" />
}
