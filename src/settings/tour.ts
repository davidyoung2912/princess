import { TOUR_STEPS } from '../tour/steps'

const KEY = 'princess.tourSeen'
const listeners = new Set<() => void>()
let cache: readonly string[] | null = null

/** The tour steps this device has already shown the guest (a per-device note, never sent anywhere). */
export function loadTourSeen(): readonly string[] {
  if (cache) return cache
  let seen: string[] = []
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (Array.isArray(data)) seen = data.filter((x): x is string => typeof x === 'string')
  } catch { /* unreadable: start again */ }
  cache = seen
  return cache
}

function save(seen: readonly string[]): void {
  cache = seen
  try { localStorage.setItem(KEY, JSON.stringify(seen)) } catch { /* private mode: the tour may show again */ }
  listeners.forEach((l) => l())
}

export const subscribeTour = (listener: () => void): (() => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** Remembers that a step has been dismissed. */
export function markTourStep(id: string): void {
  const seen = loadTourSeen()
  if (!seen.includes(id)) save([...seen, id])
}

/** Skips the rest of the tour: every step counts as seen. */
export function skipTour(): void { save([...new Set([...loadTourSeen(), ...TOUR_STEPS.map((s) => s.id)])]) }

/** Brings the whole tour back for the next visit. */
export function resetTour(): void { save([]) }
