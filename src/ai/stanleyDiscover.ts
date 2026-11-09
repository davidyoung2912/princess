/**
 * Dream and Discover intelligence (docs/stanley-gap-analysis-and-plan.md, phase 8), device side. The server reads the guest's words into filters, finds directions and compares sailings; this module reads its
 * answers defensively, lets the guest edit the filters and weights, and builds what is sent back. No figure is worked out here. Framework-free, so it is tested in node.
 */
export interface DiscoverFilters {
  months?: number[]
  nightsMin?: number
  nightsMax?: number
  regions?: string[]
  warm?: boolean
  maxTender?: number
  maxPerNightCents?: number
}

export interface DiscoverChip { key: string; label: string; assumed: boolean }
export interface Interview { filters: DiscoverFilters; chips: DiscoverChip[]; assumptions: string[]; understood: boolean }

export interface Direction {
  kind: string
  label: string
  sailingId: string
  title: string
  departure: string
  nights: number
  perNightCents: number | null
  met: string[]
  missed: string[]
  noData: string[]
  tradeOffs: string[]
}
export interface Directions { directions: Direction[]; considered: number; note: 'none' | 'onlyOne' | null }

export const CRITERIA = ['price', 'ports', 'seaDays', 'tender', 'fit'] as const
export type Criterion = (typeof CRITERIA)[number]
export const WEIGHT_MAX = 5
export const DEFAULT_WEIGHT = 3
export type Weights = Record<Criterion, number>

export interface CompareCell { key: string; text: string; known: boolean }
export interface CompareRow { sailingId: string; title: string; score: number | null; cells: CompareCell[]; missing: string[]; portNotes: string[] }
export interface CompareChoice { criterion: string; label: string; sailingIds: string[] }
export interface Comparison { rows: CompareRow[]; weights: Weights; ifYouValue: CompareChoice[]; priceBasis: string; note: string }

export interface Brief { text: string; filters: DiscoverFilters; shortlist: string[]; weights: Weights; needs: string[]; title: string }
export const EMPTY_BRIEF: Brief = { text: '', filters: {}, shortlist: [], weights: defaultWeights(), needs: [], title: '' }

export const TEXT_MAX = 500
export const SHORTLIST_MAX = 5
export const COMPARE_MAX = 4

export function defaultWeights(): Weights {
  return { price: DEFAULT_WEIGHT, ports: DEFAULT_WEIGHT, seaDays: DEFAULT_WEIGHT, tender: DEFAULT_WEIGHT, fit: DEFAULT_WEIGHT }
}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const strings = (v: unknown, count: number, max: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, count).map((x) => x.slice(0, max)) : [])
const int = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) ? v : undefined)

export function normalizeFilters(raw: unknown): DiscoverFilters {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const f: DiscoverFilters = {}
  const months = Array.isArray(o.months) ? o.months.filter((m): m is number => Number.isInteger(m) && (m as number) >= 1 && (m as number) <= 12) : []
  if (months.length > 0) f.months = months
  if (int(o.nightsMin) !== undefined) f.nightsMin = int(o.nightsMin)
  if (int(o.nightsMax) !== undefined) f.nightsMax = int(o.nightsMax)
  const regions = strings(o.regions, 12, 30)
  if (regions.length > 0) f.regions = regions
  if (typeof o.warm === 'boolean') f.warm = o.warm
  if (int(o.maxTender) !== undefined) f.maxTender = int(o.maxTender)
  if (int(o.maxPerNightCents) !== undefined) f.maxPerNightCents = int(o.maxPerNightCents)
  return f
}

export function normalizeInterview(raw: unknown): Interview {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const chips = Array.isArray(o.chips)
    ? o.chips.flatMap((c): DiscoverChip[] => {
      const x = c as Record<string, unknown> | null
      return x && typeof x.key === 'string' && typeof x.label === 'string' ? [{ key: x.key.slice(0, 20), label: x.label.slice(0, 120), assumed: x.assumed === true }] : []
    })
    : []
  return { filters: normalizeFilters(o.filters), chips, assumptions: strings(o.assumptions, 12, 200), understood: o.understood === true }
}

/** Takes one chip's part out of the filters, so the guest can say "not that" and search again. */
export function withoutChip(filters: DiscoverFilters, key: string): DiscoverFilters {
  const f = { ...filters }
  if (key === 'months') delete f.months
  else if (key === 'nights') { delete f.nightsMin; delete f.nightsMax }
  else if (key === 'regions') delete f.regions
  else if (key === 'warm') delete f.warm
  else if (key === 'tender') delete f.maxTender
  else if (key === 'budget') delete f.maxPerNightCents
  return f
}

export function chipsLeft(chips: readonly DiscoverChip[], removed: readonly string[]): DiscoverChip[] {
  return chips.filter((c) => !removed.includes(c.key))
}

export function normalizeDirections(raw: unknown): Directions {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const directions = Array.isArray(o.directions)
    ? o.directions.flatMap((d): Direction[] => {
      const x = d as Record<string, unknown> | null
      if (!x || typeof x.sailingId !== 'string' || !x.sailingId || typeof x.title !== 'string') return []
      return [{
        kind: str(x.kind, 20), label: str(x.label, 60), sailingId: x.sailingId.slice(0, 40), title: x.title.slice(0, 120), departure: str(x.departure, 10), nights: int(x.nights) ?? 0,
        perNightCents: int(x.perNightCents) ?? null, met: strings(x.met, 8, 80), missed: strings(x.missed, 8, 80), noData: strings(x.noData, 8, 80), tradeOffs: strings(x.tradeOffs, 6, 200),
      }]
    })
    : []
  return { directions, considered: int(o.considered) ?? 0, note: o.note === 'none' || o.note === 'onlyOne' ? o.note : null }
}

/** Weights clamped to 0 to 5; anything missing or odd becomes the default of 3. */
export function normalizeWeights(raw: unknown): Weights {
  const w = defaultWeights()
  if (!raw || typeof raw !== 'object') return w
  const o = raw as Record<string, unknown>
  for (const c of CRITERIA) { const v = o[c]; if (typeof v === 'number' && Number.isInteger(v)) w[c] = Math.min(WEIGHT_MAX, Math.max(0, v)) }
  return w
}

export function normalizeComparison(raw: unknown): Comparison | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.rows)) return null
  const rows = o.rows.flatMap((r): CompareRow[] => {
    const x = r as Record<string, unknown> | null
    if (!x || typeof x.sailingId !== 'string' || typeof x.title !== 'string') return []
    const cells = Array.isArray(x.cells)
      ? x.cells.flatMap((c): CompareCell[] => { const y = c as Record<string, unknown> | null; return y && typeof y.key === 'string' && typeof y.text === 'string' ? [{ key: y.key, text: y.text.slice(0, 60), known: y.known === true }] : [] })
      : []
    return [{ sailingId: x.sailingId.slice(0, 40), title: x.title.slice(0, 120), score: int(x.score) ?? null, cells, missing: strings(x.missing, 6, 40), portNotes: strings(x.portNotes, 30, 120) }]
  })
  const choices = Array.isArray(o.ifYouValue)
    ? o.ifYouValue.flatMap((c): CompareChoice[] => { const y = c as Record<string, unknown> | null; return y && typeof y.criterion === 'string' && typeof y.label === 'string' ? [{ criterion: y.criterion, label: y.label.slice(0, 80), sailingIds: strings(y.sailingIds, 4, 40) }] : [] })
    : []
  return { rows, weights: normalizeWeights(o.weights), ifYouValue: choices, priceBasis: str(o.priceBasis, 300), note: str(o.note, 300) }
}

export function normalizeBrief(raw: unknown): { brief: Brief; updatedAt: number | null } {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const b = o.brief && typeof o.brief === 'object' ? (o.brief as Record<string, unknown>) : {}
  const at = typeof o.updatedAt === 'string' ? Date.parse(o.updatedAt) : NaN
  return {
    brief: { text: str(b.text, TEXT_MAX), filters: normalizeFilters(b.filters), shortlist: strings(b.shortlist, SHORTLIST_MAX, 40), weights: normalizeWeights(b.weights), needs: strings(b.needs, 6, 60), title: str(b.title, 60) },
    updatedAt: Number.isFinite(at) ? at : null,
  }
}

/** Adds or removes a sailing on the short list, which holds at most five. */
export function toggleShortlist(list: readonly string[], id: string): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id)
  return list.length >= SHORTLIST_MAX ? [...list] : [...list, id]
}

export interface BookingFlag { field: string; code: string; text: string }

export function normalizeBookingFlags(raw: unknown): BookingFlag[] {
  const flags = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).flags : null
  return Array.isArray(flags)
    ? flags.flatMap((f): BookingFlag[] => { const x = f as Record<string, unknown> | null; return x && typeof x.field === 'string' && typeof x.code === 'string' && typeof x.text === 'string' ? [{ field: x.field, code: x.code, text: x.text.slice(0, 200) }] : [] })
    : []
}
