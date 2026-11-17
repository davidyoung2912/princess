import { isRecord } from '../feeds/feed'

/** What the guest lets Stanley do on his own, as the server serves it (`GET /me/stanley/permissions`). The levels, the rows and which are on all come from the server; the app holds no list of its own. */
export interface StanleyLevelChoice { id: number; name: string; line: string; available: boolean }
export type StanleyRowState = 'on' | 'off' | 'needsLevel' | 'soon'
export interface StanleyPermissionRow { id: string; group: string; wording: string; example: string; never: string; needsLevel: number; state: StanleyRowState }
export interface StanleyPermissions {
  level: number
  effectiveLevel: number
  voiceLimited: boolean
  childLimited: boolean
  paused: boolean
  pausedUntil: number | null
  levels: StanleyLevelChoice[]
  rows: StanleyPermissionRow[]
}
export interface StanleyConsentLine { ability: string; state: string; source: string; at: number }

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() && v.length <= max ? v : null)
const STATES: readonly string[] = ['on', 'off', 'needsLevel', 'soon']

/** Reads the reply defensively: a level or row that is not in the agreed shape is dropped, and a reply without the four levels is not used. */
export function normalizePermissions(raw: unknown): StanleyPermissions | null {
  if (!isRecord(raw) || typeof raw.level !== 'number' || typeof raw.effectiveLevel !== 'number' || !Array.isArray(raw.levels) || !Array.isArray(raw.rows)) return null
  const levels = raw.levels.flatMap((l): StanleyLevelChoice[] => {
    if (!isRecord(l) || typeof l.id !== 'number' || l.id < 1 || l.id > 4) return []
    const name = str(l.name, 60), line = str(l.line, 300)
    return name && line ? [{ id: l.id, name, line, available: l.available === true }] : []
  })
  if (levels.length === 0) return null
  const rows = raw.rows.flatMap((r): StanleyPermissionRow[] => {
    if (!isRecord(r)) return []
    const id = str(r.id, 12), group = str(r.group, 20), wording = str(r.wording, 200), example = str(r.example, 300), never = str(r.never, 300)
    if (!id || !group || !wording || !example || !never || typeof r.needsLevel !== 'number' || typeof r.state !== 'string' || !STATES.includes(r.state)) return []
    return [{ id, group, wording, example, never, needsLevel: r.needsLevel, state: r.state as StanleyRowState }]
  })
  return {
    level: raw.level, effectiveLevel: raw.effectiveLevel, voiceLimited: raw.voiceLimited === true, childLimited: raw.childLimited === true,
    paused: raw.paused === true, pausedUntil: typeof raw.pausedUntil === 'number' ? raw.pausedUntil : null, levels, rows,
  }
}

export function normalizeConsent(raw: unknown): StanleyConsentLine[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((c): StanleyConsentLine[] => {
    if (!isRecord(c)) return []
    const ability = str(c.ability, 20), state = str(c.state, 12), source = str(c.source, 12)
    return ability && state && source && typeof c.at === 'number' ? [{ ability, state, source, at: c.at }] : []
  })
}

/** The rows of one group, in the server's order. */
export const rowsOf = (p: StanleyPermissions, group: string): StanleyPermissionRow[] => p.rows.filter((r) => r.group === group)

/** Whether a row's switch can be used now: its ability exists and the level reaches it. */
export const canSwitch = (r: StanleyPermissionRow): boolean => r.state === 'on' || r.state === 'off'

/** The headline for what is on: "7 things are on. 3 are off." counts only the rows that exist; rows that are coming are not counted. */
export const countRows = (p: StanleyPermissions): { on: number; off: number; soon: number } => ({
  on: p.rows.filter((r) => r.state === 'on').length,
  off: p.rows.filter((r) => r.state === 'off' || r.state === 'needsLevel').length,
  soon: p.rows.filter((r) => r.state === 'soon').length,
})
