/**
 * Filters kept in the address (`?q=snorkel&easy=1`), so Back and a reload bring a guest's search and chips back (R1). Framework-free: the hook
 * in `src/hooks/useUrlState.ts` reads and writes through these. Empty and default values are left out so addresses stay short.
 */
export type ParamValues = Record<string, string | number | boolean | null | undefined>

/** The address query with `values` applied: a null, empty, false or undefined value removes the key; true becomes `1`. Other keys are kept in order. */
export function withParams(current: URLSearchParams, values: ParamValues): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === false || value === '') next.delete(key)
    else next.set(key, value === true ? '1' : String(value))
  }
  return next
}

/** True when two queries hold the same keys and values, whatever the order. */
export function sameParams(a: URLSearchParams, b: URLSearchParams): boolean {
  const x = [...a.entries()].map(([k, v]) => `${k}=${v}`).sort()
  const y = [...b.entries()].map(([k, v]) => `${k}=${v}`).sort()
  return x.length === y.length && x.every((s, i) => s === y[i])
}

/** A flag read from the address: `1` or `true` is on. */
export const readFlag = (params: URLSearchParams, key: string): boolean => ['1', 'true'].includes(params.get(key) ?? '')

/** A whole number within a range read from the address, or the fallback. */
export function readInt(params: URLSearchParams, key: string, fallback: number, min: number, max: number): number {
  const raw = params.get(key)
  if (raw === null || !/^\d{1,4}$/.test(raw)) return fallback
  const n = Number(raw)
  return n >= min && n <= max ? n : fallback
}

/** Free text read from the address, trimmed and capped so a pasted address cannot fill a field with a novel. */
export const readText = (params: URLSearchParams, key: string, max = 80): string => (params.get(key) ?? '').slice(0, max)
