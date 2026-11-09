import type { StanleyLevel } from '../settings/settings'
import type { Inference } from '../domain/planning'

/**
 * What Stanley remembers, as the server keeps it (docs/stanley-gap-analysis-and-plan.md, phase 7). The server holds the preferences, so a guest on a new device sees the same list; this module reads its answers,
 * works out what the device has noticed but not yet saved, and layers the three plain proactivity choices over the four levels. Framework-free, so it is tested in node.
 */
export type MemoryScope = 'trip' | 'future'
export type MemorySource = 'told' | 'quiz' | 'plan' | 'carried'

export interface MemoryItem {
  id: string
  kind: string
  value: string
  /** The server's words for the item ("You like a relaxed pace"). */
  text: string
  /** Why Stanley has it. */
  reason: string
  scope: MemoryScope
  sailingId: string | null
  /** Mobility and diet: kept for the guest, told to a model only when switched on. */
  sensitive: boolean
  /** Whether answers may use it (always true for a kind that is not sensitive). */
  shared: boolean
  updatedAt: number
}

export interface MemoryKind { kind: string; values: string[]; multiple: boolean; sensitive: boolean }
export interface MemoryState { enabled: boolean; items: MemoryItem[]; kinds: MemoryKind[] }
export const EMPTY_MEMORY_STATE: MemoryState = { enabled: true, items: [], kinds: [] }

/** What is sent to remember something. */
export interface RememberRequest { kind: string; value: string; scope: MemoryScope; sailingId?: string; source: MemorySource; share?: boolean }

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

export function normalizeItem(raw: unknown): MemoryItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const scope = o.scope === 'trip' || o.scope === 'future' ? o.scope : null
  if (typeof o.id !== 'string' || !o.id || !scope || typeof o.kind !== 'string' || typeof o.value !== 'string' || typeof o.text !== 'string' || !o.text) return null
  const updatedAt = typeof o.updatedAt === 'number' && Number.isFinite(o.updatedAt) ? o.updatedAt : 0
  return { id: o.id.slice(0, 64), kind: text(o.kind, 20), value: text(o.value, 30), text: text(o.text, 120), reason: text(o.reason, 120), scope, sailingId: typeof o.sailingId === 'string' && o.sailingId ? o.sailingId.slice(0, 40) : null, sensitive: o.sensitive === true, shared: o.shared !== false, updatedAt }
}

export function normalizeMemory(raw: unknown): MemoryState {
  if (!raw || typeof raw !== 'object') return EMPTY_MEMORY_STATE
  const o = raw as Record<string, unknown>
  const kinds = Array.isArray(o.kinds)
    ? o.kinds.flatMap((k): MemoryKind[] => {
        const r = k as Record<string, unknown> | null
        return r && typeof r.kind === 'string' && Array.isArray(r.values) ? [{ kind: r.kind, values: r.values.filter((v): v is string => typeof v === 'string'), multiple: r.multiple === true, sensitive: r.sensitive === true }] : []
      })
    : []
  return { enabled: o.enabled !== false, items: (Array.isArray(o.items) ? o.items : []).map(normalizeItem).filter((i): i is MemoryItem => i !== null).slice(0, 40), kinds }
}

const INTEREST_OF_PASTED: Record<string, string> = { 'likes the water': 'water', 'likes history and culture': 'culture', 'likes to slow down': 'slow', 'likes a challenge': 'challenge' }

/**
 * What the device has worked out about the guest (the quiz, a pasted plan, the week settings, the daily rhythm) as things the server could keep. Nothing is saved from this list until the guest taps Remember,
 * and a quiz answer about mobility is not offered: mobility is set by the guest on purpose, on the access page. An item the server already holds is not offered again.
 */
export function noticedItems(inferences: readonly Inference[], held: readonly MemoryItem[]): { inference: Inference; request: Omit<RememberRequest, 'scope' | 'sailingId'> }[] {
  const out: { inference: Inference; request: Omit<RememberRequest, 'scope' | 'sailingId'> }[] = []
  for (const i of inferences) {
    let request: Omit<RememberRequest, 'scope' | 'sailingId'> | null = null
    if (i.id.startsWith('pace:')) request = { kind: 'pace', value: i.id.slice(5), source: 'plan' }
    else if (i.id.startsWith('rhythm:')) request = { kind: 'wake', value: i.id.slice(7), source: 'plan' }
    else if (i.id.startsWith('pasted:') && INTEREST_OF_PASTED[i.id.slice(7)]) request = { kind: 'interest', value: INTEREST_OF_PASTED[i.id.slice(7)], source: 'plan' }
    else if (i.id === 'quiz:quiet') request = { kind: 'interest', value: 'slow', source: 'quiz' }
    if (!request) continue
    if (held.some((h) => h.kind === request.kind && h.value === request.value)) continue
    if (out.some((o) => o.request.kind === request.kind && o.request.value === request.value)) continue
    out.push({ inference: i, request })
  }
  return out
}

/** The kept items that belong to a trip, for the carry-forward chooser at Remember: the ones the guest has not yet moved to future trips. */
export const tripItems = (items: readonly MemoryItem[], sailingId: string): MemoryItem[] => items.filter((i) => i.scope === 'trip' && i.sailingId === sailingId)

/** Booking facts are shown beside memory but are read from the booking and cannot be edited or forgotten here. */
export interface BookingFact { id: string; label: string; value: string }

/** The three plain choices (decision 5) over the four existing levels, which stay the mechanism. "Off" is not a proactivity choice; it turns Stanley off and is offered apart. */
export const PROACTIVITY = ['affects', 'suggest', 'guide'] as const
export type Proactivity = (typeof PROACTIVITY)[number]
const LEVEL_OF: Record<Proactivity, StanleyLevel> = { affects: 'asked', suggest: 'helpful', guide: 'chatty' }
export const levelOfProactivity = (p: Proactivity): StanleyLevel => LEVEL_OF[p]
/** The plain choice a level shows as, or null for Off. */
export const proactivityOfLevel = (l: StanleyLevel): Proactivity | null => (l === 'asked' ? 'affects' : l === 'helpful' ? 'suggest' : l === 'chatty' ? 'guide' : null)

/**
 * The mobility the guest set on the access page, offered as something Stanley could keep. It is offered only when there is a need ("any" is not worth keeping), never saved by itself,
 * and kept with the switch off, so no model hears it until the guest turns that on.
 */
export function noticedMobility(mobility: 'any' | 'easy' | 'wheelchair', held: readonly MemoryItem[]): Omit<RememberRequest, 'scope' | 'sailingId'> | null {
  if (mobility === 'any' || held.some((h) => h.kind === 'mobility')) return null
  return { kind: 'mobility', value: mobility, source: 'plan', share: false }
}

/** A typed-in preference: the kind and value must be ones the server offered, and a sensitive kind starts with its switch off. */
export function toldRequest(kinds: readonly MemoryKind[], kind: string, value: string, scope: MemoryScope, sailingId: string, share = false): RememberRequest | null {
  const k = kinds.find((x) => x.kind === kind)
  if (!k || !k.values.includes(value)) return null
  return { kind, value, scope, ...(scope === 'trip' ? { sailingId } : {}), source: 'told', ...(k.sensitive ? { share } : {}) }
}
