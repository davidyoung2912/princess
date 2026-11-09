/**
 * Stanley's travel-day, port and onward-travel help (docs/stanley-gap-analysis-and-plan.md, phase 10), device side. The server rechecks the flight, replans for traffic, builds the shore plan, offers reviewed
 * phrases, packs the offline port pack, tours the ship by goal and lists the official sources for entry rules. This module reads those answers defensively and keeps the offline pack on the device. No time,
 * rule or translation is made here. Framework-free, so it is tested in node.
 */
export const INTERESTS = ['culture', 'nature', 'beach', 'shopping', 'quiet', 'family', 'food'] as const
export type Interest = (typeof INTERESTS)[number]
export const GOALS = ['essentials', 'family', 'dining', 'quiet', 'access'] as const
export type Goal = (typeof GOALS)[number]
export const CROWDS = ['quiet', 'busy', 'busiest'] as const
export type Crowd = (typeof CROWDS)[number]
export type TravelMode = 'walk' | 'taxi'
export const BUDGETS = [120, 240, 360, 480] as const

export interface FlightAlternative { offOption: string; mode: string; offAt: string; leaveBy: string; spare: number; text: string }
export interface FlightReplan {
  state: 'ok' | 'noPlan' | 'unknown'
  flight: string | null
  status: string
  delayMinutes: number
  provider: string
  asOf: number
  confidence: 'provider' | 'none'
  flightAt: string | null
  newFlightAt: string | null
  clock: string
  verdict: string
  spare: number | null
  leaveBy: string | null
  offAt: string | null
  alternatives: FlightAlternative[]
  message: string
  notes: string[]
}
export interface TrafficReplan { traffic: string; sky: string; leaveEarlierMinutes: number; provider: string; asOf: number; confidence: 'provider' | 'none'; message: string; notes: string[] }
export interface ShoreStop { id: string; kind: string; title: string; start: string; end: string; mode: 'walk' | 'taxi'; travelMinutes: number; cost: 'free' | 'paid'; cents: number; opens: string; closes: string; why: string }
export interface ReturnBrief { backBy: string; allAboard: string; bufferMinutes: number; clock: string; leaveLastStopBy: string; text: string }
export interface ShorePlan { port: string; portName: string; day: number; clock: string; ashoreFrom: string; stops: ShoreStop[]; returnBrief: ReturnBrief; notes: string[]; complete: boolean }
export interface Phrase { id: string; say: string; means: string; sounds: string; label: 'reviewed' | 'machine'; language: string }
export interface PersonCard { text: string; language: string; label: string }
export interface Phrases { port: string; language: string; phrases: Phrase[]; showPerson: PersonCard | null; note: string }
export interface PortPack {
  version: string; port: string; portName: string; day: number; clock: string; allAboard: string | null; backBy: string | null; tender: boolean
  contacts: string[]; takeMeBack: PersonCard | null; phrases: Phrase[]; notes: string[]; laws: string[]; basis: string
}
export interface EmbarkStep { placeId: string; name: string; deck: number; section: string; goal: Goal; why: string; walkFromPrevious: number; stepFree: boolean; note: string | null }
export interface EmbarkTour { goals: Goal[]; steps: EmbarkStep[]; notes: string[] }
export interface EntrySource { jurisdiction: string; authority: string; role: string; links: { label: string; url: string }[]; note: string }
export interface EntryInfo { sources: EntrySource[]; reviewedOn: string; note: string }

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const optStr = (v: unknown, max: number): string | null => (typeof v === 'string' && v ? v.slice(0, max) : null)
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const list = (v: unknown, count: number, max: number): string[] => arr(v).filter((x): x is string => typeof x === 'string').slice(0, count).map((x) => x.slice(0, max))
const oneOf = <T extends string>(v: unknown, all: readonly T[], fallback: T): T => (typeof v === 'string' && (all as readonly string[]).includes(v) ? (v as T) : fallback)

/** Only an https address is ever shown as a link. */
export const safeLink = (url: string): string | null => (/^https:\/\/[^\s"'<>]+$/.test(url) ? url : null)

export function normalizeFlight(raw: unknown): FlightReplan | null {
  const o = rec(raw)
  if (typeof o.state !== 'string') return null
  const alternatives = arr(o.alternatives).flatMap((a): FlightAlternative[] => {
    const x = rec(a)
    return typeof x.text === 'string' ? [{ offOption: str(x.offOption, 20), mode: str(x.mode, 20), offAt: str(x.offAt, 5), leaveBy: str(x.leaveBy, 5), spare: num(x.spare), text: x.text.slice(0, 200) }] : []
  }).slice(0, 3)
  return {
    state: oneOf(o.state, ['ok', 'noPlan', 'unknown'] as const, 'unknown'), flight: optStr(o.flight, 8), status: str(o.status, 12), delayMinutes: num(o.delayMinutes), provider: str(o.provider, 60), asOf: num(o.asOf),
    confidence: o.confidence === 'provider' ? 'provider' : 'none', flightAt: optStr(o.flightAt, 5), newFlightAt: optStr(o.newFlightAt, 5), clock: str(o.clock, 80), verdict: str(o.verdict, 12),
    spare: typeof o.spare === 'number' ? o.spare : null, leaveBy: optStr(o.leaveBy, 5), offAt: optStr(o.offAt, 5), alternatives, message: str(o.message, 500), notes: list(o.notes, 6, 300),
  }
}

export function normalizeTraffic(raw: unknown): TrafficReplan | null {
  const o = rec(raw)
  if (typeof o.traffic !== 'string') return null
  return { traffic: o.traffic.slice(0, 12), sky: str(o.sky, 12), leaveEarlierMinutes: num(o.leaveEarlierMinutes), provider: str(o.provider, 60), asOf: num(o.asOf), confidence: o.confidence === 'provider' ? 'provider' : 'none', message: str(o.message, 400), notes: list(o.notes, 4, 300) }
}

export function normalizePort(raw: unknown): ShorePlan | null {
  const o = rec(raw)
  if (typeof o.port !== 'string' || !Array.isArray(o.stops)) return null
  const stops = o.stops.flatMap((s): ShoreStop[] => {
    const x = rec(s)
    return typeof x.title === 'string' && typeof x.id === 'string'
      ? [{ id: x.id.slice(0, 60), kind: str(x.kind, 12), title: x.title.slice(0, 120), start: str(x.start, 5), end: str(x.end, 5), mode: x.mode === 'taxi' ? 'taxi' : 'walk', travelMinutes: num(x.travelMinutes), cost: x.cost === 'paid' ? 'paid' : 'free', cents: num(x.cents), opens: str(x.opens, 5), closes: str(x.closes, 5), why: str(x.why, 300) }]
      : []
  }).slice(0, 8)
  const r = rec(o.return)
  return {
    port: o.port.slice(0, 30), portName: str(o.portName, 60), day: num(o.day), clock: str(o.clock, 20), ashoreFrom: str(o.ashoreFrom, 5), stops,
    returnBrief: { backBy: str(r.backBy, 5), allAboard: str(r.allAboard, 5), bufferMinutes: num(r.bufferMinutes), clock: str(r.clock, 20), leaveLastStopBy: str(r.leaveLastStopBy, 5), text: str(r.text, 400) },
    notes: list(o.notes, 8, 300), complete: o.complete === true,
  }
}

const phrase = (p: unknown): Phrase[] => {
  const x = rec(p)
  return typeof x.say === 'string' && typeof x.means === 'string' ? [{ id: str(x.id, 12), say: x.say.slice(0, 200), means: x.means.slice(0, 200), sounds: str(x.sounds, 200), label: x.label === 'reviewed' ? 'reviewed' : 'machine', language: str(x.language, 30) }] : []
}

const card = (v: unknown): PersonCard | null => {
  const x = rec(v)
  return typeof x.text === 'string' && x.text ? { text: x.text.slice(0, 400), language: str(x.language, 30), label: str(x.label, 30) } : null
}

export function normalizePhrases(raw: unknown): Phrases | null {
  const o = rec(raw)
  if (typeof o.port !== 'string' || !Array.isArray(o.phrases)) return null
  return { port: o.port.slice(0, 30), language: str(o.language, 30), phrases: o.phrases.flatMap(phrase).slice(0, 12), showPerson: card(o.showPerson), note: str(o.note, 300) }
}

/** A phrase is shown as reviewed only when the server says so: anything else is marked as machine-made and carries the show-a-person fallback. */
export const isReviewed = (p: Phrase): boolean => p.label === 'reviewed'

export function normalizePack(raw: unknown): PortPack | null {
  const o = rec(raw)
  if (typeof o.version !== 'string' || typeof o.port !== 'string') return null
  return {
    version: o.version.slice(0, 20), port: o.port.slice(0, 30), portName: str(o.portName, 60), day: num(o.day), clock: str(o.clock, 20), allAboard: optStr(o.allAboard, 5), backBy: optStr(o.backBy, 5), tender: o.tender === true,
    contacts: list(o.contacts, 6, 200), takeMeBack: card(o.takeMeBack), phrases: arr(o.phrases).flatMap(phrase).slice(0, 12), notes: list(o.notes, 12, 300), laws: list(o.laws, 8, 300), basis: str(o.basis, 300),
  }
}

export function normalizeEmbark(raw: unknown): EmbarkTour | null {
  const o = rec(raw)
  if (!Array.isArray(o.steps)) return null
  const steps = o.steps.flatMap((s): EmbarkStep[] => {
    const x = rec(s)
    return typeof x.placeId === 'string' && typeof x.name === 'string'
      ? [{ placeId: x.placeId.slice(0, 40), name: x.name.slice(0, 80), deck: num(x.deck), section: str(x.section, 20), goal: oneOf(x.goal, GOALS, 'essentials'), why: str(x.why, 200), walkFromPrevious: num(x.walkFromPrevious), stepFree: x.stepFree === true, note: optStr(x.note, 200) }]
      : []
  }).slice(0, 8)
  return { goals: arr(o.goals).filter((g): g is Goal => typeof g === 'string' && (GOALS as readonly string[]).includes(g)), steps, notes: list(o.notes, 8, 300) }
}

export function normalizeEntry(raw: unknown): EntryInfo | null {
  const o = rec(raw)
  if (!Array.isArray(o.sources)) return null
  const sources = o.sources.flatMap((s): EntrySource[] => {
    const x = rec(s)
    if (typeof x.jurisdiction !== 'string') return []
    const links = arr(x.links).flatMap((l) => { const y = rec(l); const url = typeof y.url === 'string' ? safeLink(y.url) : null; return url ? [{ label: str(y.label, 80), url }] : [] })
    return [{ jurisdiction: x.jurisdiction.slice(0, 60), authority: str(x.authority, 160), role: str(x.role, 60), links, note: str(x.note, 300) }]
  }).slice(0, 8)
  return { sources, reviewedOn: str(o.reviewedOn, 10), note: str(o.note, 400) }
}

// ---- Offline port pack: opened through the saved-copy loader, so the last good copy stays on the device and works with no signal ----

/** The pack as plain text, for a screen reader or to print. Every time is followed by its clock. */
export function packText(p: PortPack): string {
  const lines = [p.portName, p.backBy ? `Back at the landing by ${p.backBy} (${p.clock}).` : '', p.allAboard ? `All aboard ${p.allAboard} (${p.clock}).` : '', ...p.contacts, ...p.notes, ...p.laws]
  return lines.filter(Boolean).join('\n')
}

/** Minutes between two "HH:mm" times on the same clock, for showing how long a stop is. */
export function minutesBetween(from: string, to: string): number {
  const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
  return m(to) - m(from)
}

/** Whether the plan is safe to follow: it has stops and none ends after the back-by time. The server already keeps to this; the check guards against an odd answer. */
export const planIsSafe = (p: ShorePlan): boolean => p.stops.length > 0 && p.stops.every((s) => minutesBetween(s.end, p.returnBrief.backBy) >= 0)

export const flightNeedsAttention = (f: FlightReplan): boolean => f.state === 'ok' && (f.verdict === 'cancelled' || f.verdict === 'tooEarly' || f.verdict === 'tight')
