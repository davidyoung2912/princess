/**
 * One simulated feed that the server can answer: the local simulation is used at once, and the server's figures replace it when they arrive
 * (real API only; mock mode has no fetcher). An answer that is not the expected shape is ignored, so a bad server never breaks a screen.
 */
export interface Feed<A extends unknown[], V> {
  /** What is known now: the server's answer if it has come, else the local simulation (the same figures, so nothing jumps). */
  now(...args: A): V
  /** Fetches the server's answer once per key; resolves true when a new value was stored. Failures leave the simulation in use. */
  load(...args: A): Promise<boolean>
  /** Set by the runtime in REST mode; null when there is no server. */
  setFetcher(f: ((...args: A) => Promise<unknown>) | null): void
  forget(): void
}

export function createFeed<A extends unknown[], V>(key: (...args: A) => string, local: (...args: A) => V, normalize: (raw: unknown) => V | null): Feed<A, V> {
  let fetcher: ((...args: A) => Promise<unknown>) | null = null
  const served = new Map<string, V>()
  return {
    now: (...args) => served.get(key(...args)) ?? local(...args),
    async load(...args) {
      const k = key(...args)
      if (!fetcher || served.has(k)) return false
      try {
        const value = normalize(await fetcher(...args))
        if (value === null) return false
        served.set(k, value)
        return true
      } catch {
        return false
      }
    },
    setFetcher: (f) => { fetcher = f },
    forget: () => served.clear(),
  }
}

export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max
export const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => typeof v === 'string' && (list as readonly string[]).includes(v)
