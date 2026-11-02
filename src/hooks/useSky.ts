import type { SimWeather } from '../domain/autopilot'
import type { PortId } from '../domain/sailings'
import { skyFeed } from '../feeds/sky'
import { useFeed } from './useServedFeeds'

/** The sky on a date from the server; null until it is here. */
export function useSky(date: string, port: PortId): SimWeather | null {
  return useFeed(skyFeed, date, port)
}
