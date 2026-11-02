import { crowdOfWindow, type Conditions } from '../domain/journey'
import { conditionsFeed } from '../feeds/route'
import { useFeed } from './useServedFeeds'

/** Traffic and weather on the way to the port from the server; null until they are here. */
export function useRouteConditions(departure: string, windowStart: string | null): Conditions | null {
  return useFeed(conditionsFeed, departure, crowdOfWindow(windowStart))
}
