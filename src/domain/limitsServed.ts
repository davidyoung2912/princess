// The modules that register limits are imported here so a served answer finds every setter, wherever the screens are split.
import './services'
import './ahead'
import './postcruise'
import './disembark'
import './policy'
import './tv'
import './wifi'
import './photos'
import './health'
import './room'
import './orders'
import { setLimits } from './limits'
import { notifyCatalogue } from './catalogueServed'

/** The limits from the server: `{ version, values: { NAME: number | string } }`. */
export interface ServedLimits { version: string; values: Record<string, number | string> }

const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Reads the server's answer. A value that is not a finite number or a short string, or a name that is not SCREAMING_SNAKE, makes the whole answer null. */
export function normalizeLimits(raw: unknown): ServedLimits | null {
  if (!rec(raw) || typeof raw.version !== 'string' || raw.version.length === 0 || raw.version.length > 80 || !rec(raw.values)) return null
  const values: Record<string, number | string> = {}
  for (const [k, v] of Object.entries(raw.values)) {
    if (!/^[A-Z][A-Z0-9_]{0,60}$/.test(k)) return null
    if (typeof v === 'number' && Number.isFinite(v)) values[k] = v
    else if (typeof v === 'string' && v.length > 0 && v.length <= 60) values[k] = v
    else return null
  }
  return { version: raw.version, values }
}

/** Puts the served limits in use and tells the screens. */
export function applyLimits(l: ServedLimits): void {
  setLimits(l.values)
  notifyCatalogue()
}
