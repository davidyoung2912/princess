import { clockAt, clockNow, setClockSpeed, stepClock } from '../domain/clock'
import { sailingById, stageAt, timeForStage, type StageId } from '../domain/sailings'
import { channel } from '../runtime/channel'
import { defaultDemoState, loadDemoState, saveDemoState, type DemoState } from './state'

const local = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

let current: DemoState = loadDemoState(Date.now(), local())
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export const getDemo = (): DemoState => current

export function subscribeDemo(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function commit(next: DemoState): void {
  current = next
  saveDemoState(next, local())
  notify()
  channel.post({ type: 'demo' })
}

/** Another tab changed the controls (the clock, a scenario): pick up its saved state. Call once at start-up. */
export function watchOtherTabs(): () => void {
  return channel.subscribe((m) => {
    if (m.type !== 'demo') return
    current = loadDemoState(Date.now(), local())
    notify()
  })
}

/** The demo clock's "now", in milliseconds since 1970. */
export const demoNow = (): number => clockNow(current.clock, Date.now())

export const updateDemo = (patch: Partial<DemoState>): void => commit({ ...current, ...patch })

export const setNetwork = (patch: Partial<DemoState['network']>): void => commit({ ...current, network: { ...current.network, ...patch } })

export const jumpTo = (at: number): void => commit({ ...current, clock: clockAt(at, Date.now(), current.clock.speed) })

export const stepBy = (ms: number): void => commit({ ...current, clock: stepClock(current.clock, ms, Date.now()) })

export const setSpeed = (speed: number): void => commit({ ...current, clock: setClockSpeed(current.clock, speed, Date.now()) })

export function jumpToStage(stage: StageId): void {
  const s = sailingById(current.sailingId)!
  jumpTo(timeForStage(s, stage))
}

export const currentStage = (): StageId => stageAt(sailingById(current.sailingId)!, demoNow())

export function toggleScenario(id: DemoState['scenarios'][number], on: boolean): void {
  const rest = current.scenarios.filter((x) => x !== id)
  commit({ ...current, scenarios: on ? [...rest, id] : rest })
}

/** Back to first-run controls (the data side of "Reset demo" is in data/lifecycle). */
export function resetDemoState(): void {
  current = defaultDemoState(Date.now())
  notify()
  channel.post({ type: 'demo' })
}
