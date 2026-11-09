import { needId, normalizeTicks } from '../routes/stageWelcome'
import type { JourneyStage } from '../routes/hubs'

const KEY = 'princess.welcomeNeeds'

/** The "What you'll need" items this device has ticked (a per-device note, never sent anywhere). */
let cache: Readonly<Record<string, true>> | null = null
const listeners = new Set<() => void>()

export function loadTicks(): Readonly<Record<string, true>> {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw === null ? {} : normalizeTicks(JSON.parse(raw))
  } catch { cache = {} }
  return cache
}

function save(next: Readonly<Record<string, true>>): void {
  cache = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode: the ticks last until the page closes */ }
  listeners.forEach((l) => l())
}

export const subscribeTicks = (listener: () => void): (() => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** Ticks or unticks one item of a stage. */
export function toggleNeed(stage: JourneyStage, n: number): void {
  const id = needId(stage, n)
  const { [id]: was, ...rest } = loadTicks()
  save(was ? rest : { ...rest, [id]: true })
}

/** Clears every tick. */
export function resetTicks(): void { save({}) }

/** Forgets what is in memory so the next read comes from storage (tests). */
export function forgetTicks(): void { cache = null }
