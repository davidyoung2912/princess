import { GUIDE_PORTS, replacePortKnowledge, type PortKnowledge } from './portContent'
import { replacePorts, type PortGuide } from './ports'
import { notifyCatalogue } from './catalogueServed'

/**
 * The port guides and port knowledge from the server (multi-device plan 3, Phase 3 step 4). The authored values in `ports.ts` and `portContent.ts`
 * show until it arrives; the last answer is kept on the device as a cache.
 */
export interface ServedPorts {
  version: string
  guides: Record<string, PortGuide>
  knowledge: Record<string, PortKnowledge>
  coords: Record<string, [number, number]>
}

type Rec = Record<string, unknown>
const rec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max = 800): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const num = (v: unknown, min = 0, max = 1_000_000): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const strs = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 40 && v.every((x) => str(x))
const each = (v: unknown, ok: (x: Rec) => boolean): boolean => Array.isArray(v) && v.length <= 40 && v.every((x) => rec(x) && ok(x))

function guide(id: string, r: unknown): boolean {
  if (!rec(r) || r.id !== id || !str(r.short, 60) || (r.landing !== 'pier' && r.landing !== 'tender')) return false
  if (!str(r.blurb) || !str(r.bestTime) || !str(r.access) || !strs(r.doThis)) return false
  return each(r.excursions, (e) => str(e.id, 40) && str(e.name, 120) && num(e.hours, 0.25, 24) && num(e.price) && (e.access === 'easy' || e.access === 'some' || e.access === 'demanding'))
}

function knowledge(r: unknown): boolean {
  if (!rec(r) || !str(r.taxiStand) || (r.lang !== undefined && !str(r.lang, 12))) return false
  for (const k of ['scams', 'etiquette', 'advisories', 'laws', 'dontBringBack', 'kids'] as const) if (!strs(r[k])) return false
  return each(r.fairPrices, (p) => str(p.route, 200) && num(p.car) && num(p.ceiling) && (p.ceiling as number) >= (p.car as number))
    && each(r.phrases, (p) => str(p.say, 200) && str(p.means, 200) && str(p.sounds, 200))
    && each(r.allergy, (a) => str(a.allergy, 60) && str(a.language, 80) && (a.lang === undefined || str(a.lang, 12)) && str(a.text) && str(a.english))
    && each(r.walks, (w) => str(w.id, 40) && str(w.name, 120) && num(w.minutes, 1, 600) && str(w.step) && str(w.accessible) && str(w.sit) && str(w.restroom))
    && each(r.dayPasses, (d) => str(d.id, 40) && str(d.name, 120) && num(d.price) && str(d.distance, 120) && (d.crowd === 'quiet' || d.crowd === 'moderate' || d.crowd === 'busy'))
    && each(r.vendors, (v) => str(v.name, 120) && str(v.what, 200))
    && each(r.souvenirs, (s) => str(s.item, 120) && str(s.fair, 60))
}

/** Reads the server's answer, all or nothing: every guide port needs a guide and its knowledge, every guide a coordinate pair, and every entry its expected shape. */
export function normalizePorts(raw: unknown): ServedPorts | null {
  if (!rec(raw) || !str(raw.version, 80) || !rec(raw.guides) || !rec(raw.knowledge) || !rec(raw.coords)) return null
  for (const id of Object.keys(raw.guides)) if (!guide(id, raw.guides[id])) return null
  for (const id of Object.keys(raw.knowledge)) if (!knowledge(raw.knowledge[id])) return null
  for (const id of Object.keys(raw.coords)) {
    const c = raw.coords[id]
    if (!Array.isArray(c) || c.length !== 2 || !num(c[0], -180, 180) || !num(c[1], -90, 90)) return null
  }
  for (const id of GUIDE_PORTS) if (!raw.guides[id] || !raw.knowledge[id] || !raw.coords[id]) return null
  if (!raw.guides.fll || !raw.coords.fll) return null
  return { version: raw.version, guides: raw.guides as unknown as ServedPorts['guides'], knowledge: raw.knowledge as unknown as ServedPorts['knowledge'], coords: raw.coords as unknown as ServedPorts['coords'] }
}

/** Puts the served port content in use and tells the screens. */
export function applyPorts(p: ServedPorts): void {
  replacePorts({ guides: p.guides, coords: p.coords })
  replacePortKnowledge(p.knowledge)
  notifyCatalogue()
}
