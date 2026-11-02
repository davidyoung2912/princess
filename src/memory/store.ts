import { APP_PREFIX } from '../data/lifecycle'
import { sync } from '../sync'
import { AWAY_ITEMS, cleanExtra, EXTRAS_MAX, type Extra } from '../domain/awayHome'
import { EMPTY_ACCESS, EMPTY_ALLERGY, normalizeAccess, normalizeAllergy, normalizeHold, normalizeShares, type AccessProfile, type AllergyFlag, type Hold, type Share } from '../domain/bookingPrep'
import { EMPTY_ABOARD, normalizeAboard, type AboardState } from '../domain/aboardMore'
import { EMPTY_FINISH, normalizeFinish, type FinishState } from '../domain/finishMore'
import { EMPTY_PLANNING, normalizePlanning, type PlanningState } from '../domain/planning'
import { normalizePlanLines, type PlanLine } from '../domain/prepMore'
import { EMPTY_MEDICAL, normalizeMedical, type MedicalCard } from '../domain/medicalCard'
import { FIT_QUESTIONS, type FitKey } from '../domain/dream'
import { CONTACT_NAME_MAX, CONTACT_NOTE_MAX, CONTACTS_MAX, isTopic, NOTE_MAX, REFLECTION_MAX, REFLECTIONS_MAX, type Contact, type Journal, type Reflection } from '../domain/memoryBook'

/** Everything Phase H6 keeps on this device for one person: the journal, "what I would change", wrapped and anniversary choices, contacts met on board, and what they have decided so far about a trip. */
/** What the guest remembers using, and what the package cost them (cents). */
export interface HindsightUse { drinks: number; dinners: number; wifiNights: number; paid: number }
export interface MemoryState {
  journal: Journal
  reflections: Reflection[]
  /** A drinks total for the wrapped cards; null keeps drinks out (the default). */
  drinks: number | null
  anniversary: boolean
  contacts: Contact[]
  blocked: string[]
  use: HindsightUse
  fit: FitKey[]
  budget: number | null
  /** The away-from-home checklist (S3-11): ticked item ids and the guest's own items. */
  away: string[]
  awayExtras: Extra[]
  /** The medical readiness card (S3-05): on this device, and in the account only if the guest turned on "keep my private notes on all my devices". */
  medical: MedicalCard
  /** Slice A of H8, all on this device: the 48 hour hold (S2-03), accessibility profile (S2-06), allergy pre-flag (S3-13) and pay-your-share ledger (S2-04). */
  hold: Hold | null
  access: AccessProfile
  allergy: AllergyFlag
  shares: Share[]
  /** Weekly companion switched off (S3-03), and the plan lines the guest confirmed from a pasted plan (S0-07). */
  companionOff: boolean
  pasted: PlanLine[]
  /** Slice B of H8, all on this device: polls, dream board, surprises, taste choices, child brief, rhythm, privacy, traditions, cabins. */
  planning: PlanningState
  /** Slice C of H8, on this device: seasickness request, lounger hold, kids report consent, teen agreement, OK tap, solo timer, cabin, do not disturb, dining choices, steps, lost reports, sightings. */
  aboard: AboardState
  /** Slice D of H8, on this device: cabin sweep, bag night, low-stress mode, ride pool, farewell, follow-up consent, traveller notes, gentle wording. */
  finish: FinishState
}

export const EMPTY_MEMORY: MemoryState = { journal: {}, reflections: [], drinks: null, anniversary: false, contacts: [], blocked: [], use: { drinks: 0, dinners: 0, wifiNights: 0, paid: 0 }, fit: [], budget: null, away: [], awayExtras: [], medical: EMPTY_MEDICAL, hold: null, access: EMPTY_ACCESS, allergy: EMPTY_ALLERGY, shares: [], companionOff: false, pasted: [], planning: EMPTY_PLANNING, aboard: EMPTY_ABOARD, finish: EMPTY_FINISH }

const money = (v: unknown): number | null => (typeof v === 'number' && v > 0 ? Math.min(100_000_000, Math.round(v)) : null)
const int = (v: unknown, max: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0)

export function normalizeMemory(raw: unknown): MemoryState {
  if (typeof raw !== 'object' || raw === null) return EMPTY_MEMORY
  const r = raw as Record<string, unknown>
  const journal: Journal = {}
  if (r.journal && typeof r.journal === 'object') {
    for (const [k, v] of Object.entries(r.journal as Record<string, unknown>)) {
      const day = Number(k)
      if (Number.isInteger(day) && day >= 1 && day <= 8 && typeof v === 'string' && v.trim() !== '') journal[day] = v.slice(0, NOTE_MAX)
    }
  }
  const reflections = (Array.isArray(r.reflections) ? r.reflections : []).flatMap((x): Reflection[] => {
    const o = x as Record<string, unknown> | null
    if (!o || typeof o.id !== 'string' || !isTopic(o.topic) || typeof o.text !== 'string' || o.text.trim() === '') return []
    return [{ id: o.id, topic: o.topic, text: o.text.slice(0, REFLECTION_MAX), shared: o.shared === true }]
  }).slice(0, REFLECTIONS_MAX)
  const contacts = (Array.isArray(r.contacts) ? r.contacts : []).flatMap((x): Contact[] => {
    const o = x as Record<string, unknown> | null
    if (!o || typeof o.id !== 'string' || typeof o.name !== 'string' || o.name.trim() === '' || o.consent !== true) return []
    const reply = o.reply === 'accepted' || o.reply === 'declined' ? o.reply : 'waiting'
    return [{ id: o.id, name: o.name.slice(0, CONTACT_NAME_MAX), note: typeof o.note === 'string' ? o.note.slice(0, CONTACT_NOTE_MAX) : '', consent: true, reply, at: typeof o.at === 'number' ? o.at : 0 }]
  }).slice(0, CONTACTS_MAX)
  const u = (r.use && typeof r.use === 'object' ? r.use : {}) as Record<string, unknown>
  const away = (Array.isArray(r.away) ? r.away : []).filter((k): k is string => AWAY_ITEMS.some((i) => i.id === k))
  const awayExtras = (Array.isArray(r.awayExtras) ? r.awayExtras : []).flatMap((x): Extra[] => {
    const o = x as Record<string, unknown> | null
    if (!o || typeof o.id !== 'string' || typeof o.text !== 'string' || cleanExtra(o.text) === '') return []
    return [{ id: o.id, text: cleanExtra(o.text), done: o.done === true }]
  }).slice(0, EXTRAS_MAX)
  return {
    journal, reflections, contacts, away, awayExtras, medical: normalizeMedical(r.medical), hold: normalizeHold(r.hold), access: normalizeAccess(r.access), allergy: normalizeAllergy(r.allergy), shares: normalizeShares(r.shares), companionOff: r.companionOff === true, pasted: normalizePlanLines(r.pasted), planning: normalizePlanning(r.planning), aboard: normalizeAboard(r.aboard), finish: normalizeFinish(r.finish),
    drinks: typeof r.drinks === 'number' && r.drinks > 0 ? int(r.drinks, 999) : null,
    anniversary: r.anniversary === true,
    blocked: (Array.isArray(r.blocked) ? r.blocked : []).filter((b): b is string => typeof b === 'string').map((b) => b.slice(0, CONTACT_NAME_MAX)).slice(0, 50),
    use: { drinks: int(u.drinks, 999), dinners: int(u.dinners, 20), wifiNights: int(u.wifiNights, 8), paid: int(u.paid, 100_000_000) },
    fit: (Array.isArray(r.fit) ? r.fit : []).filter((k): k is FitKey => FIT_QUESTIONS.some((q) => q.key === k)),
    // One trip budget: an older copy kept a second one under `planning` (the money plan and the trip-cost note), which is taken when there is no other.
    budget: money(r.budget) ?? money((r.planning as { budget?: unknown } | null | undefined)?.budget),
  }
}

export const memoryKeyFor = (personaId: string | null): string => `${APP_PREFIX}memory:${personaId ?? ''}`

export function loadMemory(personaId: string | null, storage: Pick<Storage, 'getItem'> | null = safeStorage()): MemoryState {
  try {
    const text = storage?.getItem(memoryKeyFor(personaId))
    return text ? normalizeMemory(JSON.parse(text)) : EMPTY_MEMORY
  } catch {
    return EMPTY_MEMORY
  }
}

export function saveMemory(personaId: string | null, state: MemoryState, storage: Pick<Storage, 'setItem'> | null = safeStorage()): boolean {
  try {
    storage?.setItem(memoryKeyFor(personaId), JSON.stringify(state))
    return !!storage
  } catch {
    return false
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const cache = new Map<string, MemoryState>()
const listeners = new Set<() => void>()

export function getMemory(personaId: string | null): MemoryState {
  const key = memoryKeyFor(personaId)
  let s = cache.get(key)
  if (!s) { s = loadMemory(personaId); cache.set(key, s) }
  return s
}

export function subscribeMemory(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The medical card, access profile and allergy flag: kept on the server in their own encrypted document (key `health`), apart from the rest. */
export type HealthPart = Pick<MemoryState, 'medical' | 'access' | 'allergy'>
export const healthOf = (m: MemoryState): HealthPart => ({ medical: m.medical, access: m.access, allergy: m.allergy })
/** Everything else in the memory document (key `memory`). */
export const restOf = (m: MemoryState): Omit<MemoryState, keyof HealthPart> => {
  const { medical: _m, access: _a, allergy: _l, ...rest } = m
  return rest
}

export function updateMemory(personaId: string | null, change: (s: MemoryState) => MemoryState): void {
  const prev = getMemory(personaId)
  const next = change(prev)
  cache.set(memoryKeyFor(personaId), next)
  saveMemory(personaId, next)
  listeners.forEach((l) => l())
  const before = prev
  if (JSON.stringify(healthOf(before)) !== JSON.stringify(healthOf(next))) sync.changed('health', personaId)
  if (JSON.stringify(restOf(before)) !== JSON.stringify(restOf(next))) sync.changed('memory', personaId)
}

/** Takes the server's copy (null: empty) without telling the sync module it changed. */
export function applyRemoteMemory(personaId: string | null, next: MemoryState): void {
  cache.set(memoryKeyFor(personaId), next)
  saveMemory(personaId, next)
  listeners.forEach((l) => l())
}

/** Takes the server's health document (null: empty) into the memory state without telling the sync module it changed. */
export function applyRemoteHealth(personaId: string | null, raw: unknown): void {
  const h = normalizeMemory(raw === null ? EMPTY_MEMORY : raw)
  applyRemoteMemory(personaId, { ...getMemory(personaId), medical: h.medical, access: h.access, allergy: h.allergy })
}

/** Takes the server's memory document (null: empty) but keeps this device's health details, which have their own document. */
export function applyRemoteMemoryRest(personaId: string | null, raw: unknown): void {
  const r = normalizeMemory(raw === null ? EMPTY_MEMORY : raw)
  applyRemoteMemory(personaId, { ...r, ...healthOf(getMemory(personaId)) })
}
