import { APP_PREFIX } from '../data/lifecycle'
import { normalizeRates, SAMPLE_TABLE, type RateTable } from '../domain/rates'

/** The last rate table fetched, kept on this device (ACC-07). It is not personal, so one record serves everyone. */
export const RATES_KEY = `${APP_PREFIX}rates`

export function loadRates(storage: Pick<Storage, 'getItem'> | null = safeStorage()): RateTable {
  try {
    const text = storage?.getItem(RATES_KEY)
    return text ? normalizeRates(JSON.parse(text)) : SAMPLE_TABLE
  } catch {
    return SAMPLE_TABLE
  }
}

export function saveRates(table: RateTable, storage: Pick<Storage, 'setItem'> | null = safeStorage()): boolean {
  try {
    storage?.setItem(RATES_KEY, JSON.stringify(table))
    return !!storage
  } catch {
    return false
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

let current: RateTable | null = null
const listeners = new Set<() => void>()

export function getRates(): RateTable {
  if (!current) current = loadRates()
  return current
}

export function subscribeRates(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setRates(table: RateTable): void {
  current = table
  saveRates(table)
  listeners.forEach((l) => l())
}
