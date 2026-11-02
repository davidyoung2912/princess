import { APP_PREFIX } from '../data/lifecycle'
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
}

export const EMPTY_MEMORY: MemoryState = { journal: {}, reflections: [], drinks: null, anniversary: false, contacts: [], blocked: [], use: { drinks: 0, dinners: 0, wifiNights: 0, paid: 0 }, fit: [], budget: null }

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
  return {
    journal, reflections, contacts,
    drinks: typeof r.drinks === 'number' && r.drinks > 0 ? int(r.drinks, 999) : null,
    anniversary: r.anniversary === true,
    blocked: (Array.isArray(r.blocked) ? r.blocked : []).filter((b): b is string => typeof b === 'string').map((b) => b.slice(0, CONTACT_NAME_MAX)).slice(0, 50),
    use: { drinks: int(u.drinks, 999), dinners: int(u.dinners, 20), wifiNights: int(u.wifiNights, 8), paid: int(u.paid, 100_000_000) },
    fit: (Array.isArray(r.fit) ? r.fit : []).filter((k): k is FitKey => FIT_QUESTIONS.some((q) => q.key === k)),
    budget: typeof r.budget === 'number' && r.budget > 0 ? Math.min(100_000_000, Math.round(r.budget)) : null,
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

export function updateMemory(personaId: string | null, change: (s: MemoryState) => MemoryState): void {
  const next = change(getMemory(personaId))
  cache.set(memoryKeyFor(personaId), next)
  saveMemory(personaId, next)
  listeners.forEach((l) => l())
}
