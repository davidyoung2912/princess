import { followsServer, getContext, serverNow } from '../account/context'
import { sailingFor } from '../account/sailing'
import { clockAt, clockNow, setClockSpeed, stepClock } from '../domain/clock'
import { stageAt, timeForStage, type StageId } from '../domain/sailings'
import { channel } from '../runtime/channel'
import { demoFromAnswer, fetchDemo, onDemoAnswer, publishDemo, publishJump, publishReset, sameAnswer, type DemoAnswer } from './publish'
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

/** Changes the controls; `publish: false` when the caller sends the change to the server another way (a jump). */
function commit(next: DemoState, publish = true): void {
  current = next
  saveDemoState(next, local())
  notify()
  channel.post({ type: 'demo' })
  if (publish) publishDemo(next)
}

/** The last saved controls the server gave this device, so a later answer that differs must come from another device. */
const SERVER_KEY = 'princess:demo-server'
const lastAnswer = (): DemoAnswer | null => {
  try { const t = local()?.getItem(SERVER_KEY); return t ? (JSON.parse(t) as DemoAnswer) : null } catch { return null }
}
const rememberAnswer = (a: DemoAnswer): void => { try { local()?.setItem(SERVER_KEY, JSON.stringify(a)) } catch { /* not remembered: the next pull may take the server's copy once */ } }
onDemoAnswer(rememberAnswer)

/**
 * Takes the clock and scenarios another device saved to the account (a demo account's controls follow the person). Does nothing when the server has
 * nothing saved, or its copy is the one this device last sent or received, so a clock stopped on this device stays stopped.
 */
export async function pullDemoFromServer(realNow: number = Date.now()): Promise<boolean> {
  const answer = await fetchDemo()
  if (!answer || answer.savedAt === 0) return false
  const seen = lastAnswer()
  if (seen && sameAnswer(seen, answer)) return false
  rememberAnswer(answer)
  current = demoFromAnswer(current, answer, realNow)
  saveDemoState(current, local())
  notify()
  channel.post({ type: 'demo' })
  return true
}

/** Another tab changed the controls (the clock, a scenario): pick up its saved state. Call once at start-up. */
export function watchOtherTabs(): () => void {
  return channel.subscribe((m) => {
    if (m.type !== 'demo') return
    current = loadDemoState(Date.now(), local())
    notify()
  })
}

/** "Now" in milliseconds since 1970: the server's time for a real account, the demo clock for a demo account. */
export const demoNow = (): number => (followsServer() ? serverNow() : clockNow(current.clock, Date.now()))

export const updateDemo = (patch: Partial<DemoState>): void => commit({ ...current, ...patch })

export const setNetwork = (patch: Partial<DemoState['network']>): void => commit({ ...current, network: { ...current.network, ...patch } })

/** Moves the clock; the server measures the jump on its own clock, so a phone with a wrong clock still agrees with it. */
export const jumpTo = (at: number): void => {
  commit({ ...current, clock: clockAt(at, Date.now(), current.clock.speed) }, false)
  publishJump(at)
}

export const stepBy = (ms: number): void => commit({ ...current, clock: stepClock(current.clock, ms, Date.now()) })

export const setSpeed = (speed: number): void => commit({ ...current, clock: setClockSpeed(current.clock, speed, Date.now()) })

export function jumpToStage(stage: StageId): void {
  jumpTo(timeForStage(sailingFor(getContext(), current.sailingId, demoNow()), stage))
}

export const currentStage = (): StageId => stageAt(sailingFor(getContext(), current.sailingId, demoNow()), demoNow())

export function toggleScenario(id: DemoState['scenarios'][number], on: boolean): void {
  const rest = current.scenarios.filter((x) => x !== id)
  commit({ ...current, scenarios: on ? [...rest, id] : rest })
}

/** Back to first-run controls (the data side of "Reset demo" is in data/lifecycle). */
export function resetDemoState(): void {
  current = defaultDemoState(Date.now())
  notify()
  channel.post({ type: 'demo' })
  publishReset()
  publishJump(demoNow())
}
