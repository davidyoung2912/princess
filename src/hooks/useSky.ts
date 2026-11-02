import type { SimWeather } from '../domain/autopilot'
import type { PortId } from '../domain/sailings'
import { skyFeed } from '../feeds/sky'
import { useFeed } from './useServedFeeds'

/** A day's sky from the server; null until it is here. */
export function useSky(sailingId: string, day: number, port: PortId): SimWeather | null {
  return useFeed(skyFeed, sailingId, day, port)
}
