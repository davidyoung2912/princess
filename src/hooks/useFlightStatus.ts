import type { FlightStatus } from '../domain/journey'
import { normalizeFlight, validFlightNumber } from '../domain/journey'
import { flightFeed } from '../feeds/flight'
import { useServedFeed } from './useServedFeeds'

/** A flight's status from the server (null until it is here, and when there is no flight number to watch). */
export function useFlightStatus(number: string | null, date: string): FlightStatus | null {
  const clean = number ? normalizeFlight(number) : ''
  return useServedFeed(!!number && validFlightNumber(clean), flightFeed, [clean, date])
}
