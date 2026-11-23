import { clashMap, sortItems, type PlanItem } from './planTimeline'

/**
 * A short health check for one day's plan (docs/review-and-completeness-plan.md, Phase H, day planning, item 1), worked out only from the lines already on
 * Today's Plan. It says what is missing or heavy, never what to do about money or bookings, and it says nothing about a day with nothing planned. A meal that
 * has already passed on today is not mentioned. Pure, so it can be tested without a screen.
 */
export type MealId = 'breakfast' | 'lunch' | 'dinner'
export type DayNote =
  | { id: 'meal'; meal: MealId }
  | { id: 'fullDay'; hours: number }
  | { id: 'clashes'; count: number }

/** Meal windows in minutes after midnight, ship time. */
export const MEALS: Record<MealId, readonly [number, number]> = { breakfast: [390, 600], lunch: [690, 870], dinner: [1050, 1260] }
const MEAL_ORDER: readonly MealId[] = ['breakfast', 'lunch', 'dinner']

/** More than this many hours of plan with no long gap is called a full day. */
export const FULL_DAY_HOURS = 6
/** A gap this long, between the end of one thing and the start of the next, counts as rest. */
export const REST_GAP_MIN = 60

const minuteOf = (start: string): number => Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5))

const live = (items: readonly PlanItem[]) => items.filter((i) => i.status !== 'cancelled')

/** Whether something on the plan covers a meal: a reservation or event at a dining venue in its window, or a shore tour that is out through most of it. */
function covered(items: readonly PlanItem[], meal: MealId): boolean {
  const [from, to] = MEALS[meal]
  return items.some((i) => {
    const start = minuteOf(i.start)
    const length = Math.max(0, Math.round((i.endAt - i.startAt) / 60_000))
    if (i.explorer === 'dining' || i.kind === 'dining') return start >= from - 30 && start <= to
    if (i.kind === 'tour') return Math.min(start + length, to) - Math.max(start, from) >= (to - from) * 0.6
    return false
  })
}

/** The notes for a day: missing meals still ahead (after `nowMinute`, 0 for another day), a day with six hours or more planned and no rest, and overlaps. */
export function dayCheck(items: readonly PlanItem[], nowMinute = 0): DayNote[] {
  const running = live(items)
  if (running.length === 0) return []
  const notes: DayNote[] = []
  for (const meal of MEAL_ORDER) if (MEALS[meal][1] > nowMinute && !covered(running, meal)) notes.push({ id: 'meal', meal })
  const hours = plannedHours(running)
  if (hours >= FULL_DAY_HOURS && !hasRest(running)) notes.push({ id: 'fullDay', hours: Math.round(hours * 10) / 10 })
  const overlaps = clashMap(running).size
  if (overlaps > 0) notes.push({ id: 'clashes', count: overlaps })
  return notes
}

/** Hours with something on, counting overlapping lines once. */
export function plannedHours(items: readonly PlanItem[]): number {
  let total = 0
  let end = -Infinity
  for (const i of sortItems(items)) {
    const from = Math.max(i.startAt, end)
    if (i.endAt > from) total += i.endAt - from
    end = Math.max(end, i.endAt)
  }
  return total / 3_600_000
}

/** Whether there is a gap of an hour or more between any two lines, or the day starts or ends with plenty of room. */
export function hasRest(items: readonly PlanItem[]): boolean {
  const sorted = sortItems(items)
  let end = sorted[0]?.endAt ?? 0
  for (const i of sorted.slice(1)) {
    if (i.startAt - end >= REST_GAP_MIN * 60_000) return true
    end = Math.max(end, i.endAt)
  }
  return false
}
