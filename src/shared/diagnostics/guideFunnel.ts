import type { GuideView } from '../api/guideTypes'
import { JOURNEY_STAGES, type JourneyStage } from '../../app/routes/hubs'
import { openTasks } from '../../features/guide/logic/view'
import { deviceStore } from '../data/deviceStorage'

/**
 * Which guide tasks this guest saw, finished and put aside, kept on this device only (G7). It holds task ids with three yes-or-no marks and nothing else: no words typed, no
 * dates, no counts of visits. It shows which tasks are seen and ignored, so the catalogue can be tuned. Not sent anywhere.
 */
export const FUNNEL_KEY = 'princess:diagnostics:guide'
export interface Marks { seen: boolean; done: boolean; skipped: boolean }
export type Funnel = Record<string, Marks>

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const ID = /^(?:dream|discover|book|manage|prebook|getToShip|embark|sea|port|disembark|remember)\.[A-Za-z]+$/

export function readFunnel(store: Store | null): Funnel {
  const out: Funnel = {}
  try {
    const raw: unknown = JSON.parse(store?.getItem(FUNNEL_KEY) ?? '{}')
    if (raw && typeof raw === 'object') {
      for (const [id, v] of Object.entries(raw)) {
        if (!ID.test(id) || !v || typeof v !== 'object') continue
        const m = v as Record<string, unknown>
        out[id] = { seen: m.seen === true, done: m.done === true, skipped: m.skipped === true }
      }
    }
  } catch { /* unreadable marks start again from nothing */ }
  return out
}

const write = (store: Store, f: Funnel): void => store.setItem(FUNNEL_KEY, JSON.stringify(f))

/** Marks one task. Never throws: a full or blocked store must not get in the way of the plan. */
export function markTask(store: Store | null, id: string, mark: keyof Marks): void {
  if (!store || !ID.test(id)) return
  try {
    const f = readFunnel(store)
    const m = f[id] ?? { seen: false, done: false, skipped: false }
    if (m[mark]) return
    f[id] = { ...m, [mark]: true }
    write(store, f)
  } catch { /* nothing to do */ }
}

/** Notes what a guide shows: the tasks Home lists are seen, the ones that are done are done. Writes only when something changed. */
export function noteGuide(store: Store | null, view: GuideView): void {
  if (!store) return
  try {
    const f = readFunnel(store)
    let changed = false
    const mark = (id: string, k: keyof Marks) => {
      if (!ID.test(id)) return
      const m = f[id] ?? { seen: false, done: false, skipped: false }
      if (m[k]) return
      f[id] = { ...m, [k]: true }
      changed = true
    }
    for (const x of openTasks(view)) mark(x.id, 'seen')
    for (const x of view.tasks) if (x.state === 'done' && x.carriedFrom === null) { mark(x.id, 'seen'); mark(x.id, 'done') }
    if (changed) write(store, f)
  } catch { /* nothing to do */ }
}

export const clearFunnel = (store: Store | null): void => { try { store?.removeItem(FUNNEL_KEY) } catch { /* nothing to do */ } }

/** Tasks seen, done and put aside in each stage, in journey order, leaving out stages with nothing seen. */
export function funnelByStage(f: Funnel): { stage: JourneyStage; seen: number; done: number; skipped: number }[] {
  return JOURNEY_STAGES.map((stage) => {
    const own = Object.entries(f).filter(([id]) => id.startsWith(`${stage}.`)).map(([, m]) => m)
    return { stage, seen: own.filter((m) => m.seen).length, done: own.filter((m) => m.done).length, skipped: own.filter((m) => m.skipped).length }
  }).filter((r) => r.seen > 0 || r.done > 0 || r.skipped > 0)
}

const device = (): Storage | null => { return deviceStore() }

/** The same marks, kept in this device's storage (a blocked store is ignored). */
export const noteGuideHere = (view: GuideView): void => noteGuide(device(), view)
export const markTaskHere = (id: string, mark: keyof Marks): void => markTask(device(), id, mark)
