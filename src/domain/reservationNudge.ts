import type { Slot } from './dining'

/** The nearest slot on the same night before (`earlier`) or after (`later`) the current time that still has a table, or null. Slots are "HH:MM" strings, so they sort as text. */
export function nearestFreeSlot(slots: readonly Slot[], current: string, direction: 'earlier' | 'later'): Slot | null {
  const free = slots.filter((s) => s.tables > 0 && (direction === 'earlier' ? s.time < current : s.time > current)).sort((a, b) => a.time.localeCompare(b.time))
  return (direction === 'earlier' ? free[free.length - 1] : free[0]) ?? null
}
