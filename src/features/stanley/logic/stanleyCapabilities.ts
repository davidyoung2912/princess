import { isRecord } from '../../../shared/feeds/feed'

/** One ability in the server's catalogue (`GET /me/stanley/capabilities`). The app renders what it is given; it holds no list of its own. */
export interface StanleyCapability {
  id: string
  group: string
  title: string
  summary: string
  /** A sentence Stanley really handles, used for "Try it". */
  example: string
  stages: string[]
  /** 0 tells, 1 notices, 2 prepares and the guest confirms. */
  rung: number
  appliesWhen: 'always' | 'booking'
  state: 'available' | 'needsBooking'
}
export interface StanleyCapabilityGroup { id: string; title: string; intro: string }
export interface StanleyCatalogue { groups: StanleyCapabilityGroup[]; items: StanleyCapability[] }

const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() && v.length <= max ? v : null)

/** Reads the reply defensively: an item or group that is not in the agreed shape is dropped, and a reply that is not a catalogue is null. */
export function normalizeCatalogue(raw: unknown): StanleyCatalogue | null {
  if (!isRecord(raw) || !Array.isArray(raw.groups) || !Array.isArray(raw.items)) return null
  const groups = raw.groups.flatMap((g): StanleyCapabilityGroup[] => {
    if (!isRecord(g)) return []
    const id = text(g.id, 40), title = text(g.title, 120), intro = text(g.intro, 300)
    return id && title && intro ? [{ id, title, intro }] : []
  })
  const ids = new Set(groups.map((g) => g.id))
  const items = raw.items.flatMap((i): StanleyCapability[] => {
    if (!isRecord(i)) return []
    const id = text(i.id, 60), group = text(i.group, 40), title = text(i.title, 120), summary = text(i.summary, 400), example = text(i.example, 500)
    if (!id || !group || !ids.has(group) || !title || !summary || !example) return []
    const rung = typeof i.rung === 'number' && i.rung >= 0 && i.rung <= 2 ? i.rung : null
    if (rung === null) return []
    const stages = Array.isArray(i.stages) ? i.stages.filter((s): s is string => typeof s === 'string').slice(0, 11) : []
    return [{ id, group, title, summary, example, stages, rung, appliesWhen: i.appliesWhen === 'booking' ? 'booking' : 'always', state: i.state === 'needsBooking' ? 'needsBooking' : 'available' }]
  })
  return groups.length ? { groups, items } : null
}

/** The first ability in a group the guest can use now (the server lists the best first), for its "Try it" chip. Null when there is none. */
export const tryExample = (catalogue: StanleyCatalogue | null, group: string): string | null =>
  catalogue?.items.find((i) => i.group === group && i.state === 'available')?.example ?? null
