import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { getRates, setRates, subscribeRates } from '../rates/store'
import { ratesStale, type RateTable } from '../domain/rates'
import { fetchRates } from '../runtime'

/**
 * The saved rate table, and a function that asks for today's. The server's table is used, so every device agrees;
 * when the server cannot be reached the saved table stays and is called out of date.
 */
export function useRates(): { table: RateTable; refresh: (now: number) => void } {
  const table = useSyncExternalStore(subscribeRates, getRates, getRates)
  const refresh = useCallback((_now: number) => {
    void fetchRates().then(setRates).catch(() => {})
  }, [])
  // A table that is out of date is replaced as soon as a screen that shows it opens.
  useEffect(() => {
    if (ratesStale(getRates(), Date.now())) refresh(Date.now())
  }, [refresh])
  return { table, refresh }
}
