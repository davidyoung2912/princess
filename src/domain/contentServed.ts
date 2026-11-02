// The modules that register content are imported here so a served answer finds every target, wherever the screens are split.
import './services'
import './ahead'
import './postcruise'
import './finishMore'
import './disembark'
import './embark'
import './help'
import './policy'
import './games'
import './tv'
import './wifi'
import './laundry'
import './photos'
import './health'
import './safety'
import './room'
import './orders'
import './menus'
import { setContent } from './content'
import { notifyCatalogue } from './catalogueServed'

/** The content from the server: `{ version, values: { 'module.NAME': list or record } }`. */
export interface ServedContent { version: string; values: Record<string, unknown[] | Record<string, unknown>> }

const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Reads the server's answer; a malformed key or a value that is neither a list nor a record makes the whole answer null. */
export function normalizeContent(raw: unknown): ServedContent | null {
  if (!rec(raw) || typeof raw.version !== 'string' || raw.version.length === 0 || raw.version.length > 80 || !rec(raw.values)) return null
  for (const [k, v] of Object.entries(raw.values)) {
    if (!/^[a-zA-Z]+\.[A-Z][A-Z0-9_]{0,60}$/.test(k)) return null
    if (!Array.isArray(v) && !rec(v)) return null
  }
  return { version: raw.version, values: raw.values as ServedContent['values'] }
}

/** Puts the served content in use and tells the screens. */
export function applyContent(c: ServedContent): void {
  setContent(c.values)
  notifyCatalogue()
}
