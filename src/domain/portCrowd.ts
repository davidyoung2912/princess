import type { CrowdLevel } from './portPilot'

/**
 * Ships in port and the expected crowd (S6A-02). A simulation: a stable number per port and date, shaped like a real feed
 * so one can replace it. `source` says so wherever it is shown.
 */
export type CrowdPort = string

export interface PortCrowd {
  /** All ships alongside or at anchor, including this one. */
  ships: number
  guests: number
  level: CrowdLevel
  /** Busy days suggest a quiet day aboard. */
  stayAboardNote: boolean
}

const LEVELS: CrowdLevel[] = ['quiet', 'moderate', 'busy']
const bump = (l: CrowdLevel, by: number): CrowdLevel => LEVELS[Math.max(0, Math.min(2, LEVELS.indexOf(l) + by))]

export interface HourCrowd { hour: number; level: CrowdLevel }

/** The crowd hour by hour at a popular site: busiest from late morning to mid afternoon, quieter early and late. */
export function hourlyCrowd(crowd: Pick<PortCrowd, 'level'>, fromHour: number, toHour: number): HourCrowd[] {
  const out: HourCrowd[] = []
  for (let hour = fromHour; hour < toHour; hour++) {
    const shape = hour < 9 ? -1 : hour < 11 ? 0 : hour < 15 ? 1 : hour < 16 ? 0 : -1
    out.push({ hour, level: shape === 0 ? crowd.level : bump(crowd.level, shape) })
  }
  return out
}

/** The longest run of the quietest hours, as [from, to) hours, or null if there is no quiet hour at all. */
export function quietestWindow(hours: readonly HourCrowd[]): { from: number; to: number } | null {
  const best = Math.min(...hours.map((h) => LEVELS.indexOf(h.level)))
  if (!hours.length || best === 2 && hours.every((h) => h.level === 'busy')) return null
  let bestRun: { from: number; to: number } | null = null
  let start = -1
  hours.forEach((h, i) => {
    const hit = LEVELS.indexOf(h.level) === best
    if (hit && start < 0) start = h.hour
    const end = !hit || i === hours.length - 1
    if (start >= 0 && end) {
      const to = hit ? h.hour + 1 : h.hour
      if (!bestRun || to - start > bestRun.to - bestRun.from) bestRun = { from: start, to }
      start = -1
    }
  })
  return bestRun
}
