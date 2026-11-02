/**
 * The limits, windows, fees and rates the server enforces (multi-device plan 3, Phase 3 step 6). A domain module declares each as `export let NAME = default`
 * and registers a setter with `limit`; `GET /reference/limits` then replaces the default in place, so a screen's limit is the rule that checks it.
 * Pure: no network, no storage.
 */
type Value = number | string
interface Entry { set: (v: never) => void; kind: 'number' | 'string' }

const entries = new Map<string, Entry>()
let current: Record<string, Value> = {}

/** Registers a limit (called at module load). A value already served for this name is applied at once. */
export function limit<T extends Value>(name: string, set: (v: T) => void, initial: T): void {
  entries.set(name, { set: set as (v: never) => void, kind: typeof initial === 'number' ? 'number' : 'string' })
  const have = current[name]
  if (have !== undefined && typeof have === typeof initial) set(have as T)
}

export const limitNames = (): string[] => [...entries.keys()]

/** Applies served values. A name nobody registered is ignored; a value of the wrong kind is skipped. Returns how many were applied. */
export function setLimits(values: Record<string, Value>): number {
  current = { ...current, ...values }
  let n = 0
  for (const [name, v] of Object.entries(values)) {
    const e = entries.get(name)
    if (!e || typeof v !== e.kind) continue
    ;(e.set as (v: Value) => void)(v)
    n++
  }
  return n
}
