import { servedAccess } from './accessReference'
import type { AccessProfile } from './bookingPrep'
import { clubFor, type ClubId } from './family'
import { acceptChange, addProposal, type Change, type Edit, type PlanEntry } from './planChange'
import type { Pace, Week, WeekPrefs } from './autopilot'
import { FIT_QUESTIONS, type FitKey } from './dream'
import { excursionById, type ExcursionItem } from './excursions'
import { itinerary, type Sailing } from './sailings'
import type { PlanLine } from './prepMore'
import type { Cents } from './pricing'

/**
 * H8 slice B: planning and groups on one device (S4-03 to S4-10, S0-06, XG-01, XG-02, XG-04, XG-07, S4-02 follow-up).
 * Pure. Authored figures are concept figures. Group features here are run by one person on one phone; nothing is sent anywhere.
 */

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

// ---- S4-03: honest difficulty ----
export type Level = 'low' | 'medium' | 'high'
export interface Difficulty { km: number; steps: boolean; heat: Level; shade: Level; seats: boolean; restrooms: boolean; wet: boolean }
const D = (km: number, steps: boolean, heat: Level, shade: Level, seats: boolean, restrooms: boolean, wet: boolean): Difficulty => ({ km, steps, heat, shade, seats, restrooms, wet })
/** Authored for each excursion in the catalogue: distance on foot, steps, heat, shade, seats, restrooms and wet footing. */
export const DIFFICULTY: Record<string, Difficulty> = {
  'coz-snorkel': D(0.5, true, 'high', 'low', true, true, true),
  'coz-ruins': D(2, true, 'high', 'medium', false, true, false),
  'coz-beach': D(0.3, false, 'medium', 'high', true, true, true),
  'coz-glass': D(0.8, true, 'medium', 'medium', true, true, true),
  'bze-altunha': D(2.5, true, 'high', 'medium', false, true, false),
  'bze-cave': D(3, true, 'medium', 'high', false, false, true),
  'bze-reef': D(0.5, true, 'high', 'low', true, true, true),
  'bze-walk': D(2, false, 'high', 'low', true, true, false),
  'rtb-zip': D(1.5, true, 'high', 'high', false, true, false),
  'rtb-snorkel': D(0.4, false, 'high', 'low', true, true, true),
  'rtb-wildlife': D(1, false, 'medium', 'high', true, true, false),
  'rtb-drive': D(0.3, false, 'medium', 'medium', true, false, false),
}
/** The server's figure when it has sent one, else the authored copy. */
export const difficultyOf = (id: string): Difficulty | null => servedAccess()?.difficulty[id] ?? DIFFICULTY[id] ?? null

export type Concern = 'steps' | 'distance' | 'heat' | 'wet' | 'noSeats' | 'noRestrooms' | 'wheelchair' | 'noShade'
/** What in this excursion could be hard for this person, from the accessibility profile (S2-06). Empty means nothing to flag, not a promise. */
export function difficultyConcerns(x: ExcursionItem, a: AccessProfile): Concern[] {
  const d = difficultyOf(x.id)
  if (!d) return []
  const out: Concern[] = []
  const moves = a.mobility || a.device !== 'none'
  if (a.device === 'wheelchair' || a.device === 'scooter') { if (!x.wheelchair) out.push('wheelchair') }
  if (moves && d.steps) out.push('steps')
  if (moves && d.km >= 1.5) out.push('distance')
  if (moves && !d.seats) out.push('noSeats')
  if (moves && !d.restrooms) out.push('noRestrooms')
  if (moves && d.wet) out.push('wet')
  if (a.sensory && d.heat === 'high' && d.shade === 'low') out.push('noShade')
  if (d.heat === 'high' && d.shade === 'low' && moves) out.push('heat')
  return out
}

// ---- S4-04: independent against ship excursion ----
export interface Way { cost: Cents; ifLate: 'shipWaits' | 'shipLeaves'; flexible: boolean; refund: 'cancel' | 'varies' }
export interface Comparison { ship: Way; independent: Way; saving: Cents }
export const INDEPENDENT_SHARE = 0.65
/** The ship excursion against doing it yourself. The independent figure is an authored estimate, not a quote; the late rule is the real difference. */
export function compareExcursion(x: ExcursionItem): Comparison {
  const ind = Math.round((x.price * INDEPENDENT_SHARE) / 100) * 100
  return {
    ship: { cost: x.price, ifLate: 'shipWaits', flexible: false, refund: 'cancel' },
    independent: { cost: ind, ifLate: 'shipLeaves', flexible: true, refund: 'varies' },
    saving: x.price - ind,
  }
}

// ---- S4-05, S0-06: group poll and dream board on one device ----
export interface PollOption { id: string; label: string }
export interface Poll { id: string; question: string; options: PollOption[]; /** Voter name to option id: one vote each. */ votes: Record<string, string> }
export interface Idea { id: string; text: string; hearts: string[] }
export const POLLS_MAX = 6, OPTIONS_MAX = 6, VOTERS_MAX = 12, IDEAS_MAX = 20

export function newPoll(id: string, question: string, labels: readonly string[]): Poll | null {
  const q = clean(question, 80)
  const opts = [...new Set(labels.map((l) => clean(l, 40)).filter(Boolean))].slice(0, OPTIONS_MAX)
  if (!q || opts.length < 2) return null
  return { id, question: q, options: opts.map((label, i) => ({ id: `o${i + 1}`, label })), votes: {} }
}
/** One vote per name: voting again changes it. */
export function castVote(p: Poll, voter: string, optionId: string): Poll {
  const v = clean(voter, 20)
  if (!v || !p.options.some((o) => o.id === optionId)) return p
  if (!(v in p.votes) && Object.keys(p.votes).length >= VOTERS_MAX) return p
  return { ...p, votes: { ...p.votes, [v]: optionId } }
}
export const tally = (p: Poll): { option: PollOption; votes: number }[] => p.options.map((option) => ({ option, votes: Object.values(p.votes).filter((o) => o === option.id).length }))
/** The winner, or null while nobody has voted or the top is tied. */
export function leader(p: Poll): PollOption | null {
  const t = tally(p).sort((a, b) => b.votes - a.votes)
  return t[0] && t[0].votes > 0 && t[0].votes > (t[1]?.votes ?? 0) ? t[0].option : null
}
export const addIdea = (list: readonly Idea[], id: string, text: string): Idea[] => {
  const x = clean(text, 80)
  return x && list.length < IDEAS_MAX ? [...list, { id, text: x, hearts: [] }] : [...list]
}
export const heartIdea = (list: readonly Idea[], id: string, who: string): Idea[] => {
  const w = clean(who, 20)
  return list.map((i) => (i.id !== id || !w ? i : { ...i, hearts: i.hearts.includes(w) ? i.hearts.filter((h) => h !== w) : [...i.hearts, w].slice(0, VOTERS_MAX) }))
}

// ---- S4-06: surprise mode ----
export interface Surprise { id: string; text: string }
export const SURPRISES_MAX = 10
/** Anything that leaves this device for other people (a shared itinerary, the family page) goes through this first: hidden items are removed by id and by text. */
export function withoutSurprises<T extends { id?: string; text?: string; title?: string }>(items: readonly T[], hidden: readonly Surprise[]): T[] {
  const ids = new Set(hidden.map((h) => h.id)), texts = new Set(hidden.map((h) => h.text.toLowerCase()))
  return items.filter((i) => !(i.id && ids.has(i.id)) && !(i.text && texts.has(i.text.toLowerCase())) && !(i.title && texts.has(i.title.toLowerCase())))
}

// ---- S4-07, XA-07: one explainable taste profile ----
export interface Inference { id: string; source: 'quiz' | 'pasted' | 'pace' | 'rhythm'; text: string }
export interface TasteInput { fit: readonly FitKey[]; pasted: readonly PlanLine[]; pace: Pace; rhythm: Rhythm | null }
const WORDS: [RegExp, string][] = [[/\bsnorkel|reef|beach|swim/i, 'likes the water'], [/\bruins|museum|history|temple/i, 'likes history and culture'], [/\bspa|quiet|relax/i, 'likes to slow down'], [/\bzip|cave|hike/i, 'likes a challenge']]
/** Every guess the app makes about the guest, each with why. The assistant and Autopilot may read only what this returns (global off and removed items respected). */
export function tasteInferences(input: TasteInput, off: boolean, removed: readonly string[]): Inference[] {
  if (off) return []
  const out: Inference[] = []
  for (const q of FIT_QUESTIONS) if (input.fit.includes(q.key)) out.push({ id: `quiz:${q.key}`, source: 'quiz', text: q.question.replace(/^I /, 'You ').replace(/\.$/, '') })
  for (const [re, text] of WORDS) if (input.pasted.some((l) => re.test(l.text))) out.push({ id: `pasted:${text}`, source: 'pasted', text: `You ${text}` })
  out.push({ id: `pace:${input.pace}`, source: 'pace', text: `You like a ${input.pace} pace` })
  if (input.rhythm) out.push({ id: `rhythm:${input.rhythm.wake}`, source: 'rhythm', text: `You wake ${input.rhythm.wake}` })
  return out.filter((i) => !removed.includes(i.id))
}

// ---- S4-08: budget notes at 80 and 100 percent ----
export type BudgetNote = { level: 'ok' | 80 | 100; percent: number; over: Cents }
export function budgetNote(total: Cents, budget: Cents | null): BudgetNote | null {
  if (budget === null || budget <= 0) return null
  const percent = Math.round((total / budget) * 100)
  return { level: total > budget ? 100 : percent >= 80 ? 80 : 'ok', percent, over: Math.max(0, total - budget) }
}

// ---- S4-09: child brief ----
export interface ChildBrief { name: string; age: number | null; allergies: string; comfort: string; bedtime: string; needs: string }
export const EMPTY_BRIEF: ChildBrief = { name: '', age: null, allergies: '', comfort: '', bedtime: '', needs: '' }
export const normalizeBrief = (raw: unknown): ChildBrief => {
  const r = rec(raw)
  return { name: clean(r.name, 30), age: typeof r.age === 'number' && r.age >= 3 && r.age <= 17 ? Math.round(r.age) : null, allergies: clean(r.allergies, 120), comfort: clean(r.comfort, 120), bedtime: clean(r.bedtime, 20), needs: clean(r.needs, 160) }
}
export type BriefField = 'name' | 'allergies' | 'comfort' | 'bedtime' | 'needs'
/** What each club sees. The teens' club does not get comfort or bedtime; allergies and needs always go to every club. Shown to the guest only: nothing is sent. */
const CLUB_FIELDS: Record<ClubId, BriefField[]> = { firefly: ['name', 'allergies', 'comfort', 'bedtime', 'needs'], 'neon-grove': ['name', 'allergies', 'needs', 'bedtime'], underground: ['name', 'allergies', 'needs'] }
export function briefFor(b: ChildBrief): { club: ClubId; fields: { field: BriefField; value: string }[] } | null {
  if (b.age === null) return null
  const club = clubFor(b.age)
  if (!club) return null
  return { club: club.id, fields: CLUB_FIELDS[club.id].map((field) => ({ field, value: b[field] })).filter((f) => f.value !== '') }
}

// ---- S4-10: rhythm profile ----
export interface Rhythm { wake: 'early' | 'mid' | 'late'; nap: boolean; lateMeals: boolean }
export const EMPTY_RHYTHM: Rhythm | null = null
export const normalizeRhythm = (raw: unknown): Rhythm | null => {
  const r = rec(raw)
  return r.wake === 'early' || r.wake === 'mid' || r.wake === 'late' ? { wake: r.wake, nap: r.nap === true, lateMeals: r.lateMeals === true } : null
}
/** The week preferences this rhythm implies: late risers skip early starts, nappers get a lighter pace. */
export function rhythmPrefs(r: Rhythm): Partial<WeekPrefs> {
  return { noEarly: r.wake === 'late' || r.lateMeals, ...(r.nap ? { pace: 'relaxed' as const } : {}) }
}

// ---- XG-02: privacy defaults ----
export const PRIVACY_FIELDS = ['plans', 'spending', 'photos', 'medical'] as const
export type PrivacyField = (typeof PRIVACY_FIELDS)[number]
export type Privacy = Record<PrivacyField, boolean>
/** The safest default: nothing is shared with the group until the person ticks it. */
export const SAFEST: Privacy = { plans: false, spending: false, photos: false, medical: false }
export const normalizePrivacy = (raw: unknown): Privacy => { const r = rec(raw); return { plans: r.plans === true, spending: r.spending === true, photos: r.photos === true, medical: false } }

// ---- XG-04: family traditions ----
export interface Tradition { id: string; text: string; done: boolean }
export const TRADITIONS_MAX = 12
export const addTradition = (list: readonly Tradition[], id: string, text: string): Tradition[] => { const x = clean(text, 80); return x && list.length < TRADITIONS_MAX ? [...list, { id, text: x, done: false }] : [...list] }
/** Next trip starts from the same list with every box clear. */
export const carryOver = (list: readonly Tradition[]): Tradition[] => list.map((t) => ({ ...t, done: false }))

// ---- XG-07: several cabins, one shared day ----
export interface CabinPlan { id: string; name: string; tourIds: string[] }
export const CABINS_MAX = 6
/** What the cabins do the same day (shared, on one line) and what only some do. */
export function sharedDay(cabins: readonly CabinPlan[]): { together: string[]; apart: { id: string; cabin: string; titles: string[] }[] } {
  const count = new Map<string, number>()
  for (const c of cabins) for (const id of new Set(c.tourIds)) count.set(id, (count.get(id) ?? 0) + 1)
  const name = (id: string) => excursionById(id)?.name ?? id
  const together = [...count].filter(([, n]) => n === cabins.length && cabins.length > 1).map(([id]) => name(id))
  return { together, apart: cabins.map((c) => ({ id: c.id, cabin: c.name, titles: c.tourIds.filter((id) => count.get(id) !== cabins.length || cabins.length < 2).map(name) })) }
}

// ---- S4-02 follow-up: apply a week in one tap through the change rule ----
/** Turns the week the server built into one accepted change per day that differs from the current plan. Each stays undoable and shows in the log. */
export function applyWeek(s: Sailing, week: Week, changes: readonly Change[], now: number): { changes: Change[]; applied: number } {
  let next = [...changes]
  let applied = 0
  for (const d of itinerary(s)) {
    const { base, target, items } = week.days[d.day - 1]
    const keep = new Set(items.map((i) => i.id))
    const edits: Edit[] = [
      ...base.filter((b) => !keep.has(b.id)).map((b): Edit => ({ op: 'drop', id: b.id })),
      ...target.filter((e: PlanEntry) => keep.has(e.id) && !base.some((b) => b.id === e.id)).map((entry): Edit => ({ op: 'add', entry })),
    ]
    if (edits.length === 0) continue
    const id = `week:${d.day}:${edits.map((e) => (e.op === 'add' ? e.entry.id : e.op === 'drop' ? e.id : '')).join('+')}`
    if (next.some((c) => c.id === id && (c.status === 'accepted' || c.status === 'proposed'))) continue
    const c: Change = { id, day: d.day, source: 'autopilot', cause: 'You built a week', title: 'Apply your week', why: 'This follows the pace and wishes you chose for the week.', edits, status: 'proposed', proposedAt: now, undoUntil: now + 24 * 3_600_000 }
    const accepted = acceptChange(base, addProposal(next, c), id, now)
    if (accepted.ok) { next = accepted.changes; applied++ }
  }
  return { changes: next, applied }
}

// ---- State kept on the device ----
export interface PlanningState {
  polls: Poll[]; ideas: Idea[]; surprises: Surprise[]
  tasteOff: boolean; tasteRemoved: string[]
  brief: ChildBrief; rhythm: Rhythm | null; privacy: Privacy
  traditions: Tradition[]; cabins: CabinPlan[]
  /** The money plan's per-person daily amounts (S3-12), kept so the plan is the same next time. */
  moneyDaily: { sea: Cents; port: Cents } | null
}
export const EMPTY_PLANNING: PlanningState = { polls: [], ideas: [], surprises: [], tasteOff: false, tasteRemoved: [], brief: EMPTY_BRIEF, rhythm: null, privacy: SAFEST, traditions: [], cabins: [], moneyDaily: null }

const normalizeDaily = (raw: unknown): { sea: Cents; port: Cents } | null => {
  const m = rec(raw)
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 9_999_900
  return ok(m.sea) && ok(m.port) ? { sea: m.sea, port: m.port } : null
}

export function normalizePlanning(raw: unknown): PlanningState {
  const r = rec(raw)
  const polls = arr(r.polls).flatMap((x): Poll[] => {
    const o = rec(x)
    const opts = arr(o.options).flatMap((y): PollOption[] => { const p = rec(y); return typeof p.id === 'string' && clean(p.label, 40) ? [{ id: p.id, label: clean(p.label, 40) }] : [] }).slice(0, OPTIONS_MAX)
    if (typeof o.id !== 'string' || !clean(o.question, 80) || opts.length < 2) return []
    const votes: Record<string, string> = {}
    for (const [k, v] of Object.entries(rec(o.votes))) if (typeof v === 'string' && opts.some((p) => p.id === v) && clean(k, 20) && Object.keys(votes).length < VOTERS_MAX) votes[clean(k, 20)] = v
    return [{ id: o.id, question: clean(o.question, 80), options: opts, votes }]
  }).slice(0, POLLS_MAX)
  const ideas = arr(r.ideas).flatMap((x): Idea[] => { const o = rec(x); return typeof o.id === 'string' && clean(o.text, 80) ? [{ id: o.id, text: clean(o.text, 80), hearts: arr(o.hearts).filter((h): h is string => typeof h === 'string').map((h) => clean(h, 20)).slice(0, VOTERS_MAX) }] : [] }).slice(0, IDEAS_MAX)
  const surprises = arr(r.surprises).flatMap((x): Surprise[] => { const o = rec(x); return typeof o.id === 'string' && clean(o.text, 80) ? [{ id: o.id, text: clean(o.text, 80) }] : [] }).slice(0, SURPRISES_MAX)
  const traditions = arr(r.traditions).flatMap((x): Tradition[] => { const o = rec(x); return typeof o.id === 'string' && clean(o.text, 80) ? [{ id: o.id, text: clean(o.text, 80), done: o.done === true }] : [] }).slice(0, TRADITIONS_MAX)
  const cabins = arr(r.cabins).flatMap((x): CabinPlan[] => { const o = rec(x); return typeof o.id === 'string' && clean(o.name, 30) ? [{ id: o.id, name: clean(o.name, 30), tourIds: arr(o.tourIds).filter((i): i is string => typeof i === 'string' && !!excursionById(i)) }] : [] }).slice(0, CABINS_MAX)
  return {
    polls, ideas, surprises, traditions, cabins,
    moneyDaily: normalizeDaily(r.moneyDaily),
    tasteOff: r.tasteOff === true, tasteRemoved: arr(r.tasteRemoved).filter((i): i is string => typeof i === 'string').map((i) => i.slice(0, 60)).slice(0, 50),
    brief: normalizeBrief(r.brief), rhythm: normalizeRhythm(r.rhythm), privacy: normalizePrivacy(r.privacy),
  }
}

