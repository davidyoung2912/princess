import { useSyncExternalStore } from 'react'
import { getRates, setRates, subscribeRates } from '../rates/store'
import { stubRates, type RateTable } from '../domain/rates'

/** The saved rate table, and a function that asks the (stub) source for today's. */
export function useRates(): { table: RateTable; refresh: (now: number) => void } {
  const table = useSyncExternalStore(subscribeRates, getRates, getRates)
  return { table, refresh: (now) => setRates(stubRates(now)) }
}
