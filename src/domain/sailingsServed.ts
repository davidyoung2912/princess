import { replaceSailings, type ItineraryTemplateDay, type Port, type PortId, type Sailing } from './sailings'
import { notifyCatalogue } from './catalogueServed'
import { normalizeEntries, setSailingEntries, type SailingEntry } from './shipCatalogue'

/**
 * The sailings table from the server (multi-device plan 3, Phase 3): sailings, ports, the eight-day itinerary the older sailings run (each day with
 * the zone the ship's clocks follow), and the catalogue's `entries` (every sailing of every ship). The authored values in `sailings.ts` show until it arrives; the last answer is kept on the device as a cache
 * (`runtime/index.ts`). Pure apart from the swap and the change notice.
 */
export interface ServedSailings {
  version: string
  sailings: Sailing[]
  ports: Record<string, Port>
  template: ItineraryTemplateDay[]
  entries: SailingEntry[]
}

const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max = 120): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const hhmm = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))

function sailing(raw: unknown): Sailing | null {
  if (!rec(raw) || !str(raw.id, 40) || !date(raw.departure)) return null
  const s: Sailing = { id: raw.id, departure: raw.departure }
  if (raw.holiday === true) s.holiday = true
  if (raw.reference === true) s.reference = true
  return s
}

function port(raw: unknown): Port | null {
  if (!rec(raw) || !str(raw.id, 20) || !str(raw.name) || !str(raw.zone, 60) || typeof raw.tender !== 'boolean') return null
  return { id: raw.id as PortId, name: raw.name, zone: raw.zone, tender: raw.tender }
}

function day(raw: unknown): ItineraryTemplateDay | null {
  if (!rec(raw) || typeof raw.day !== 'number' || !Number.isInteger(raw.day) || raw.day < 1 || raw.day > 30 || !str(raw.port, 20)) return null
  if (!str(raw.shipZone, 60)) return null
  const out: ItineraryTemplateDay = { day: raw.day, port: raw.port as PortId, zone: raw.shipZone }
  for (const k of ['arrive', 'allAboard', 'depart'] as const) {
    const v = raw[k]
    if (v === null || v === undefined) continue
    if (!hhmm(v)) return null
    out[k] = v
  }
  return out
}

/**
 * Reads the server's answer. All or nothing: anything malformed, no reference sailing, an itinerary that is not the eight days in order, or a day with no ship zone, or a day at
 * a port the table does not list gives null (the authored values, or the kept copy, stay).
 */
export function normalizeSailings(raw: unknown): ServedSailings | null {
  if (!rec(raw) || !str(raw.version, 80)) return null
  if (!Array.isArray(raw.sailings) || !Array.isArray(raw.ports) || !Array.isArray(raw.itinerary)) return null
  const sailings = raw.sailings.map(sailing)
  const ports = raw.ports.map(port)
  const template = raw.itinerary.map(day)
  if (sailings.some((x) => !x) || ports.some((x) => !x) || template.some((x) => !x)) return null
  const ss = sailings as Sailing[]
  const ps = ports as Port[]
  const ts = template as ItineraryTemplateDay[]
  if (ss.length === 0 || ss.filter((x) => x.reference).length !== 1 || new Set(ss.map((x) => x.id)).size !== ss.length) return null
  if (ts.length !== 8 || ts.some((t, i) => t.day !== i + 1)) return null
  const ids = new Set(ps.map((p) => p.id as string))
  if (!ts.every((t) => t.port === 'sea' || ids.has(t.port))) return null
  const byId: Record<string, Port> = {}
  for (const p of ps) byId[p.id] = p
  return { version: raw.version, sailings: ss, ports: byId, template: ts, entries: normalizeEntries(raw.entries) }
}

/** Puts the served table in use and tells the screens. */
export function applySailings(s: ServedSailings): void {
  replaceSailings({ sailings: s.sailings, ports: s.ports, template: s.template })
  setSailingEntries(s.entries)
  notifyCatalogue()
}
