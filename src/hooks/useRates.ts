import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { getRates, setRates, subscribeRates } from '../rates/store'
import { ratesStale, stubRates, type RateTable } from '../domain/rates'
import { fetchRates } from '../runtime'

/**
 * The saved rate table, and a function that asks for today's. With the real API the server's table is used, so every device agrees;
 * without it, or when the server cannot be reached, the local stub is used (offline the saved table stays and is called out of date).
 */
export function useRates(): { table: RateTable; refresh: (now: number) => void } {
  const table = useSyncExternalStore(subscribeRates, getRates, getRates)
  const refresh = useCallback((now: number) => {
    if (!fetchRates) { setRates(stubRates(now)); return }
    void fetchRates().then(setRates).catch(() => {})
  }, [])
  // A table that is out of date is replaced as soon as a screen that shows it opens (real API only).
  useEffect(() => {
    if (fetchRates && ratesStale(getRates(), Date.now())) refresh(Date.now())
  }, [refresh])
  return { table, refresh }
}
