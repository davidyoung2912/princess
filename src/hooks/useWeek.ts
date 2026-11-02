import type { Week, WeekPrefs } from '../domain/autopilot'
import type { RestBlock } from '../domain/planPolish'
import { weekFeed, weekKey } from '../feeds/week'
import { useFeed } from './useServedFeeds'

/** The week the server builds for these wishes on a sailing; null until it is here. */
export function useWeek(sailingId: string, prefs: WeekPrefs, rest: readonly RestBlock[] = []): Week | null {
  return useFeed(weekFeed, sailingId, weekKey(prefs, rest))
}
