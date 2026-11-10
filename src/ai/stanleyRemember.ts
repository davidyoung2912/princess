import { t, type StringKey } from '../i18n'
import type { Journal } from '../domain/memoryBook'
import type { TripEntry } from '../domain/tripDiary'
import { wantMatches } from '../domain/rememberDelights'
import type { StanleyCase } from './stanleyHandoff'

/**
 * Remember, storyteller and relationship (docs/stanley-gap-analysis-and-plan.md, phase 13). Everything here is built from facts the guest chose to keep (their own diary lines, bookings and ratings) and
 * is written by plain templates, so a draft can never add a fact, a name or a feeling the guest did not give. The guest edits and approves every word; nothing is sent from here, and no photo is looked at
 * (there is no face recognition, and only the guest's own photos are named). Framework-free, so it is tested in node.
 */

import { CHOICE_TEXT_MAX, oneLine, RANK, type StoryChoices, type Tone, type Version } from '../domain/storyChoices'

export * from '../domain/storyChoices'

// ---- the Voyage Story ----

export type MilestoneKind = 'trip' | 'ports' | 'tour' | 'meal' | 'photos' | 'note'

/** One line of the story and where it came from. `audience` is the widest version that may carry it: a note of the guest's is private, a tour or a meal can go to family, ports and nights can be public. */
export interface Milestone { id: string; kind: MilestoneKind; text: string; source: string; audience: Version }

export interface StoryFacts {
  /** The guests' first names, for the private and family titles. */
  party: readonly string[]
  shipName: string
  cruiseName: string
  nights: number
  dates: string
  ports: readonly string[]
  seaDays: number
  tourNames: readonly string[]
  favouriteMeal: { name: string; times: number } | null
  photos: number
}

/** Every line the story could carry, each with its source. Nothing is invented: a line exists only when its source has something. */
export function buildMilestones(f: StoryFacts, journal: Journal): Milestone[] {
  const out: Milestone[] = [{ id: 'trip', kind: 'trip', text: t('rem13.line.trip', { nights: f.nights, ship: f.shipName, dates: f.dates }), source: t('rem13.source.sailing'), audience: 'public' }]
  if (f.ports.length > 0) out.push({ id: 'ports', kind: 'ports', text: t('rem13.line.ports', { ports: f.ports.join(', '), sea: f.seaDays }), source: t('rem13.source.itinerary'), audience: 'public' })
  for (const name of f.tourNames) out.push({ id: `tour:${name}`.slice(0, 80), kind: 'tour', text: t('rem13.line.tour', { name }), source: t('rem13.source.tours'), audience: 'family' })
  if (f.favouriteMeal) out.push({ id: 'meal', kind: 'meal', text: t('rem13.line.meal', { name: f.favouriteMeal.name }), source: t('rem13.source.dinners'), audience: 'family' })
  if (f.photos > 0) out.push({ id: 'photos', kind: 'photos', text: t('rem13.line.photos', { count: f.photos }), source: t('rem13.source.photos'), audience: 'family' })
  for (const [day, text] of Object.entries(journal).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const note = oneLine(text, CHOICE_TEXT_MAX)
    if (note) out.push({ id: `note:${day}`, kind: 'note', text: note, source: t('rem13.source.note', { day }), audience: 'private' })
  }
  return out
}

export interface StoryLine extends Milestone { corrected: boolean }

/** The lines for one version after the guest's removals and corrections. The audience limit applies to the guest's own words too, so a corrected private note is still never exported. */
export function storyLines(ms: readonly Milestone[], choices: StoryChoices, version: Version): StoryLine[] {
  return ms
    .filter((m) => RANK[version] >= RANK[m.audience] && !choices.removed.includes(m.id))
    .map((m) => (m.id in choices.corrected ? { ...m, text: choices.corrected[m.id], source: t('rem13.source.corrected'), corrected: true } : { ...m, corrected: false }))
}

/** Every line the guest has removed that this version could have carried, so each can be put back. */
export const removedLines = (ms: readonly Milestone[], choices: StoryChoices, version: Version): Milestone[] =>
  ms.filter((m) => RANK[version] >= RANK[m.audience] && choices.removed.includes(m.id))

export interface Story { title: string; opening: string; lines: StoryLine[]; closing: string; text: string }

/** The story for a version. Tone changes only the opening and closing words; the sourced lines stay exactly as they are. The public version has no names. */
export function renderStory(f: Pick<StoryFacts, 'party' | 'cruiseName'>, ms: readonly Milestone[], choices: StoryChoices, version: Version): Story {
  const names = f.party.filter(Boolean)
  const title = version === 'public' || names.length === 0 ? t('rem13.title.public', { cruise: f.cruiseName || t('rem13.cruiseFallback') }) : t('rem13.title.named', { names: names.join(' and '), cruise: f.cruiseName || t('rem13.cruiseFallback') })
  const lines = storyLines(ms, choices, version)
  const opening = t(`rem13.tone.${choices.tone}.open` as StringKey)
  const closing = t(`rem13.tone.${choices.tone}.close` as StringKey)
  return { title, opening, lines, closing, text: [title, opening, ...lines.map((l) => l.text), closing].join('\n') }
}

// ---- compliment and feedback drafter (idea 12) ----

export const THANKS = ['kind', 'quick', 'clean', 'fun', 'help', 'food'] as const
export type Thanks = (typeof THANKS)[number]

/** What a draft is made from: only what the guest picked on the form. */
export interface FeedbackFacts {
  /** The crew the guest ticked to thank, by name. */
  crew: readonly string[]
  /** What they were thankful for; empty means a plain thank-you. */
  thanks: readonly Thanks[]
  tone: Tone
  /** The guest's own overall rating (1 to 5) or 0 when unrated; the draft never states a rating the guest did not give. */
  overall: number
  /** Labels of the areas the guest rated 4 or 5, and 1 or 2. */
  liked: readonly string[]
  disliked: readonly string[]
}

const join = (xs: readonly string[]): string => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} ${t('rem13.and')} ${xs[xs.length - 1]}`)

/** A first draft of the comment: thanks to the crew named, what went well and what did not, all from the form. A low rating asks for a person to look; it never exaggerates or accuses. */
export function draftFeedback(f: FeedbackFacts, max: number): string {
  const parts: string[] = [t(`rem13.tone.${f.tone}.thanksOpen` as StringKey)]
  if (f.crew.length > 0) {
    const why = f.thanks.length > 0 ? ` ${t('rem13.thanks.why', { why: join(f.thanks.map((k) => t(`rem13.thanks.${k}` as StringKey))) })}` : ''
    parts.push(`${t('rem13.thanks.crew', { crew: join(f.crew) })}${why}`)
  }
  if (f.liked.length > 0) parts.push(t('rem13.feedback.liked', { areas: join(f.liked) }))
  if (f.disliked.length > 0) parts.push(t('rem13.feedback.disliked', { areas: join(f.disliked) }))
  if (f.overall > 0 && f.overall <= 2) parts.push(t('rem13.feedback.lowAsk'))
  return parts.join(' ').slice(0, max)
}

// ---- photo caption helper (idea 13) ----

/** What a caption is built from: the photo's own day and the diary lines the guest kept for that day. No pixels, no names of other people. */
export interface CaptionFacts { port: string | null; day: number; tone: Tone; diary: readonly Pick<TripEntry, 'kind' | 'text'>[] }
export const CAPTION_MAX = 100

export function draftCaption(f: CaptionFacts): string {
  const line = f.diary.find((e) => e.kind === 'tour')?.text ?? f.diary.find((e) => e.kind === 'meal')?.text ?? f.diary.find((e) => e.kind === 'moment' || e.kind === 'note')?.text ?? null
  const where = f.port ? t('rem13.caption.port', { port: f.port, day: f.day }) : t('rem13.caption.sea', { day: f.day })
  const base = line ? t('rem13.caption.with', { where, line }) : where
  return `${base}${t(`rem13.tone.${f.tone}.caption` as StringKey)}`.slice(0, CAPTION_MAX)
}

// ---- daily recap and port memory ----

export const RECAP_KINDS: readonly TripEntry['kind'][] = ['port', 'meal', 'tour', 'moment', 'note', 'photo']

/** The day's recap: only lines already in the guest's own diary (the guest can remove any), in the order they happened. Empty when there is nothing, and then nothing is claimed. */
export function dailyRecap(entries: readonly TripEntry[], day: number): string[] {
  return entries.filter((e) => e.day === day && RECAP_KINDS.includes(e.kind)).sort((a, b) => a.at - b.at).map((e) => e.text)
}

/** Port memory asks only once a port day has passed with nothing the guest wrote (no moment or note) in the diary. */
export function askPortMemory(entries: readonly TripEntry[], day: number, port: string | null): boolean {
  return port !== null && !entries.some((e) => e.day === day && !e.auto && (e.kind === 'moment' || e.kind === 'note'))
}

// ---- open cases and the rebooking gate (STN-REM-04) ----

/** A case the guest has open with the ship, whichever way it was opened. */
export interface OpenCase { id: string; label: string; serious: boolean }

const SERIOUS_TOPICS = new Set(['missedShip', 'disruption', 'allergy'])
const SERIOUS_KINDS = new Set(['claim', 'complaint', 'recovery'])

/** Open Stanley hand-off cases: anything not fulfilled. Serious when it concerns a missed ship, a disruption or an allergy, or when it is overdue or escalated. */
export function openFromHandoffs(cases: readonly StanleyCase[], now: number): OpenCase[] {
  return cases.filter((c) => c.status !== 'fulfilled').map((c) => ({
    id: `h:${c.id}`, label: t('rem13.case.label', { reference: c.reference, topic: t(`handoff.topic.${c.topic}` as StringKey) }),
    serious: SERIOUS_TOPICS.has(c.topic) || c.escalated || c.overdue || now >= c.nextUpdateAt,
  }))
}

/** Open post-cruise cases (received or in review). A complaint, a claim or a recovery case after a poor rating is serious; a lost item or a billing question is open but not serious. */
export function openFromCases(cases: readonly { id: string; kind: string; number: string; stage: string }[]): OpenCase[] {
  return cases.filter((c) => c.stage === 'received' || c.stage === 'inReview').map((c) => ({ id: `c:${c.id}`, label: t('rem13.case.label', { reference: c.number, topic: t(`rem13.case.kind.${c.kind}` as StringKey) }), serious: SERIOUS_KINDS.has(c.kind) }))
}

/**
 * How Stanley treats prompts to book again. `hold` while any serious case is open: no next-voyage suggestions, no rebooking offer, the case status in their place. `soften` while any other case is open:
 * no suggestions or offers, only the plain link. `normal` otherwise. The guest can still open the booking screen themselves; nothing is hidden from them, only not pushed.
 */
export type RebookMode = 'normal' | 'soften' | 'hold'
export interface RebookGate { mode: RebookMode; cases: OpenCase[] }

export function rebookGate(cases: readonly OpenCase[]): RebookGate {
  const mode: RebookMode = cases.some((c) => c.serious) ? 'hold' : cases.length > 0 ? 'soften' : 'normal'
  return { mode, cases: [...cases] }
}

export const mayPromoteRebooking = (g: RebookGate): boolean => g.mode === 'normal'

// ---- next-voyage ideas (STN-REM-06) ----

/** A sailing the guest could book, with the places it calls at (names, and port ids for the tours) and the total for their party. */
export interface Voyage { id: string; departure: string; places: readonly string[]; portIds?: readonly string[]; totalCents: number | null }

/** A kept interest that can be checked against real shore tours: what the guest told Stanley, and the tour interest it matches. Food has no tour data, so it is never matched. */
export const TOUR_OF_INTEREST: Record<string, { tour?: string; family?: boolean }> = { water: { tour: 'water' }, culture: { tour: 'culture' }, slow: { tour: 'relax' }, challenge: { tour: 'adventure' }, family: { family: true } }

/** The interests Stanley keeps for future trips, once each, in the order kept. Trip-only items and other kinds (pace, mobility, diet) are not used here. */
export function futureInterests(items: readonly { kind: string; value: string; scope: string }[]): string[] {
  return [...new Set(items.filter((i) => i.kind === 'interest' && i.scope === 'future' && i.value in TOUR_OF_INTEREST).map((i) => i.value))]
}

export interface TourFact { port: string; interests: readonly string[]; family: boolean }
export interface InterestHit { interest: string; portId: string; count: number }

/** For each kept interest, the port on the route with the most tours that suit it (and how many). A port with none gives no hit, so nothing is claimed without a tour behind it. */
export function interestMatches(interests: readonly string[], portIds: readonly string[], tours: readonly TourFact[]): InterestHit[] {
  const hits: InterestHit[] = []
  for (const interest of interests) {
    const rule = TOUR_OF_INTEREST[interest]
    if (!rule) continue
    const best = portIds
      .map((portId) => ({ portId, count: tours.filter((x) => x.port === portId && (rule.family ? x.family : rule.tour ? x.interests.includes(rule.tour) : false)).length }))
      .filter((x) => x.count > 0)
      .sort((x, y) => y.count - x.count || x.portId.localeCompare(y.portId))[0]
    if (best) hits.push({ interest, ...best })
  }
  return hits
}

export interface VoyageIdea { id: string; departure: string; because: { want: string; place: string }[]; byInterest: InterestHit[]; totalCents: number | null }

/** Sailings ranked by how many of the guest's kept wants they call at plus how many kept interests have tours on the route. A sailing with neither is not suggested; each idea names the want or the interest behind it, so the guest sees why. */
export function nextVoyageIdeas(wants: readonly string[], voyages: readonly Voyage[], max = 3, interests: readonly string[] = [], tours: readonly TourFact[] = []): VoyageIdea[] {
  return voyages
    .map((v) => ({ id: v.id, departure: v.departure, because: wantMatches(wants, v.places), byInterest: interestMatches(interests, v.portIds ?? [], tours), totalCents: v.totalCents }))
    .filter((v) => v.because.length + v.byInterest.length > 0)
    .sort((a, b) => b.because.length + b.byInterest.length - (a.because.length + a.byInterest.length) || a.departure.localeCompare(b.departure) || a.id.localeCompare(b.id))
    .slice(0, max)
}

/** The lowest and highest total across the ideas (the range to show), or null when none has a price. */
export function costRange(ideas: readonly VoyageIdea[]): { low: number; high: number } | null {
  const prices = ideas.flatMap((i) => (i.totalCents !== null && i.totalCents > 0 ? [i.totalCents] : []))
  return prices.length === 0 ? null : { low: Math.min(...prices), high: Math.max(...prices) }
}

// ---- photo organiser (STN-REM-03) ----

export interface FavouriteGroup { day: number; port: string | null; photoIds: string[]; titles: string[]; caption: string }

/**
 * The guest's favourite photos grouped by the day each was taken, oldest day first, each group with a suggested caption from that day's diary. Only photos the guest favourited are used, they are ordered by their own
 * day and time, and nothing about a picture or the people in it is read: the day and the photo's own title are all there is. Another guest's photos never reach this: the list given is the guest's own.
 */
export function groupFavouritesByDay(
  photos: readonly { id: string; day: number; title: string; time: string }[], favourites: readonly string[], placeOfDay: (day: number) => string | null, diary: readonly TripEntry[], tone: Tone,
): FavouriteGroup[] {
  const chosen = photos.filter((p) => favourites.includes(p.id))
  const days = [...new Set(chosen.map((p) => p.day))].sort((a, b) => a - b)
  return days.map((day) => {
    const mine = chosen.filter((p) => p.day === day).sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id))
    const port = placeOfDay(day)
    return { day, port, photoIds: mine.map((p) => p.id), titles: mine.map((p) => p.title), caption: draftCaption({ port, day, tone, diary: diary.filter((e) => e.day === day) }) }
  })
}
