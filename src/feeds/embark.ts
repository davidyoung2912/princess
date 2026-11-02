import { EMBARK_SOURCE, type EmbarkQueue, type ForecastStep, type QueueWindow, type StepId } from '../domain/embark'
import { createFeed, isInt, isRecord, oneOf } from './feed'

const STEPS: readonly StepId[] = ['terminal', 'security', 'photo', 'gangway']
const CROWDS = ['quiet', 'busy', 'busiest'] as const
const HHMM = /^\d{2}:\d{2}$/

/** Reads the server's windows: each with a crowd, a wait and the four steps in order. Anything wrong gives null. */
export function normalizeEmbarkQueue(raw: unknown): EmbarkQueue | null {
  if (!isRecord(raw) || !Array.isArray(raw.windows) || raw.windows.length > 12) return null
  const windows: QueueWindow[] = []
  for (const w of raw.windows) {
    if (!isRecord(w) || typeof w.start !== 'string' || !HHMM.test(w.start) || typeof w.end !== 'string' || !HHMM.test(w.end) || !oneOf(w.crowd, CROWDS) || !isInt(w.waitMinutes, 0, 240) || !isInt(w.total, 0, 600)) return null
    if (!Array.isArray(w.steps) || w.steps.length !== STEPS.length) return null
    const steps: ForecastStep[] = []
    for (let i = 0; i < STEPS.length; i++) {
      const s = w.steps[i]
      if (!isRecord(s) || s.id !== STEPS[i] || !isInt(s.walk, 0, 120) || !isInt(s.queue, 0, 240) || typeof s.accessibleLane !== 'boolean' || typeof s.quietLane !== 'boolean') return null
      steps.push({ id: STEPS[i], walk: s.walk, queue: s.queue, accessibleLane: s.accessibleLane, quietLane: s.quietLane })
    }
    windows.push({ start: w.start, end: w.end, crowd: w.crowd, waitMinutes: w.waitMinutes, steps, total: w.total })
  }
  const recommended = raw.recommended === null ? null : typeof raw.recommended === 'string' && windows.some((w) => w.start === raw.recommended) ? raw.recommended : undefined
  if (recommended === undefined) return null
  return { windows, recommended, source: EMBARK_SOURCE }
}

/** The windows a guest can make and what each costs in waiting, by priority, mobility, quiet and earliest time ("" for none). */
export const embarkFeed = createFeed<[priority: boolean, mobility: boolean, quiet: boolean, earliest: string], EmbarkQueue>((p, m, q, e) => `${p}|${m}|${q}|${e}`, normalizeEmbarkQueue, 'embark')
