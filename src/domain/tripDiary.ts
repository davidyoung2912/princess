/**
 * The Trip Diary (docs/experience-extension-ideas.md 4.6, X7): a private, dated timeline of the trip, made from what happens and from what the guest adds.
 * Text only. It lives in the memory document, so it follows the guest to every device. Framework-free, so it is tested in node.
 * Nothing here books, sends or sells anything.
 */

export const DIARY_KINDS = ['booked', 'docs', 'checkedIn', 'pass', 'boarded', 'port', 'meal', 'tour', 'note'] as const
export type DiaryKind = (typeof DIARY_KINDS)[number]
export const isDiaryKind = (v: unknown): v is DiaryKind => DIARY_KINDS.includes(v as DiaryKind)

export const MOODS = ['great', 'good', 'ok', 'tired'] as const
export type Mood = (typeof MOODS)[number]
export const isMood = (v: unknown): v is Mood => MOODS.includes(v as Mood)

export const ENTRY_MAX = 280
export const ENTRIES_MAX = 300

export interface TripEntry {
  id: string
  /** The sailing it belongs to, so a second trip starts a clean diary. */
  sailingId: string
  /** Trip day 1..n, or 0 for before the ship (booking, documents, check-in). */
  day: number
  /** When it was written or happened, ms. Sorts the day. */
  at: number
  kind: DiaryKind
  text: string
  mood: Mood | null
  /** True when the app wrote it from something that happened; the guest can still edit or remove it. */
  auto: boolean
  /** An auto entry's identity, so the same event is written once (for example `port:3`). Empty for the guest's own lines. */
  key: string
}

export interface DiaryState {
  entries: TripEntry[]
  /** `sailingId:key` of auto lines the guest removed, so the app does not write them again. */
  skipped: string[]
}
export const EMPTY_DIARY: DiaryState = { entries: [], skipped: [] }

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim().slice(0, max) : '')
const rec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {})

const byTime = (a: TripEntry, b: TripEntry): number => a.day - b.day || a.at - b.at || a.id.localeCompare(b.id)

export function normalizeDiary(raw: unknown): DiaryState {
  const list = rec(raw).entries
  if (!Array.isArray(list)) return EMPTY_DIARY
  const skipped = (Array.isArray(rec(raw).skipped) ? (rec(raw).skipped as unknown[]) : []).filter((k): k is string => typeof k === 'string').map((k) => k.slice(0, 90)).slice(-ENTRIES_MAX)
  const seen = new Set<string>()
  const entries = list.flatMap((x): TripEntry[] => {
    const o = rec(x)
    const text = clean(o.text, ENTRY_MAX)
    if (typeof o.id !== 'string' || o.id === '' || seen.has(o.id) || !text || !isDiaryKind(o.kind)) return []
    seen.add(o.id)
    const day = typeof o.day === 'number' && Number.isInteger(o.day) ? Math.max(0, Math.min(60, o.day)) : 0
    return [{ id: o.id.slice(0, 40), sailingId: clean(o.sailingId, 40), day, at: typeof o.at === 'number' && Number.isFinite(o.at) ? o.at : 0, kind: o.kind, text, mood: isMood(o.mood) ? o.mood : null, auto: o.auto === true, key: clean(o.key, 40) }]
  })
  return { entries: entries.sort(byTime).slice(-ENTRIES_MAX), skipped }
}

/** The guest's own line (a note, optionally with a mood). Returns the same list when the line is empty or the diary is full. */
export function addNote(d: DiaryState, e: { id: string; sailingId: string; day: number; at: number; text: string; mood?: Mood | null }): DiaryState {
  const text = clean(e.text, ENTRY_MAX)
  if (!text || d.entries.length >= ENTRIES_MAX || d.entries.some((x) => x.id === e.id)) return d
  const entry: TripEntry = { id: e.id, sailingId: e.sailingId, day: Math.max(0, Math.round(e.day)), at: e.at, kind: 'note', text, mood: e.mood ?? null, auto: false, key: '' }
  return { ...d, entries: [...d.entries, entry].sort(byTime) }
}

/** A line the app wrote because something happened. The same `key` on the same sailing is written once, and a line the guest removed stays removed. */
export function addAuto(d: DiaryState, e: { id: string; sailingId: string; day: number; at: number; kind: DiaryKind; text: string; key: string }): DiaryState {
  const text = clean(e.text, ENTRY_MAX)
  const key = clean(e.key, 40)
  if (!text || !key || d.entries.length >= ENTRIES_MAX) return d
  if (d.entries.some((x) => x.sailingId === e.sailingId && x.key === key) || d.skipped.includes(`${e.sailingId}:${key}`)) return d
  const entry: TripEntry = { id: e.id, sailingId: e.sailingId, day: Math.max(0, Math.round(e.day)), at: e.at, kind: e.kind, text, mood: null, auto: true, key }
  return { ...d, entries: [...d.entries, entry].sort(byTime) }
}

export function editEntry(d: DiaryState, id: string, text: string, mood?: Mood | null): DiaryState {
  const t = clean(text, ENTRY_MAX)
  if (!t) return d
  return { ...d, entries: d.entries.map((x) => (x.id === id ? { ...x, text: t, mood: mood === undefined ? x.mood : mood, auto: false } : x)) }
}

/** Removes a line. An auto line is remembered as skipped, so it does not come back. */
export function removeEntry(d: DiaryState, id: string): DiaryState {
  const gone = d.entries.find((x) => x.id === id)
  if (!gone) return d
  const skipped = gone.auto && gone.key ? [...d.skipped, `${gone.sailingId}:${gone.key}`].slice(-ENTRIES_MAX) : d.skipped
  return { entries: d.entries.filter((x) => x.id !== id), skipped }
}

/** The entries of one sailing, oldest first. */
export const entriesFor = (d: DiaryState, sailingId: string): TripEntry[] => d.entries.filter((x) => x.sailingId === sailingId)

export interface DiaryDay { day: number; entries: TripEntry[] }

/** Entries grouped by day, in day order: "before the ship" (day 0) first. */
export function groupByDay(entries: readonly TripEntry[]): DiaryDay[] {
  const days = new Map<number, TripEntry[]>()
  for (const e of [...entries].sort(byTime)) days.set(e.day, [...(days.get(e.day) ?? []), e])
  return [...days.entries()].sort((a, b) => a[0] - b[0]).map(([day, list]) => ({ day, entries: list }))
}

/** Entries that contain every word typed (case and accents ignored). An empty search finds everything. */
export function searchEntries(entries: readonly TripEntry[], query: string): TripEntry[] {
  const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...entries]
  return entries.filter((e) => { const hay = fold(e.text); return words.every((w) => hay.includes(w)) })
}

/** The trip day for a moment in time: day 1 is the first itinerary date, and anything before it is day 0 (before the ship). */
export function dayFor(dates: readonly string[], at: number): number {
  const first = dates[0]
  if (!first) return 0
  const iso = new Date(at).toISOString().slice(0, 10)
  if (iso < first) return 0
  const index = dates.findIndex((d) => d === iso)
  return index >= 0 ? index + 1 : iso > (dates[dates.length - 1] ?? first) ? dates.length : 0
}
