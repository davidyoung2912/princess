import type { ExplorerDay, ExplorerEvent, VenueDay } from '../../api/explorerTypes'

/** What a guest has told the Explorers they like, and what they have waved away. Kept on this device with the rest of the guest's display choices. */
export interface TasteProfile {
  /** Interest themes the guest chose (the `interest` of an event, such as "music" or "family"). */
  likes: string[]
  /** Ids of dismissed events and venues; `venue:<id>` for a venue. */
  hidden: string[]
}

export const EMPTY_TASTE: TasteProfile = { likes: [], hidden: [] }

const MAX_LIST = 60

const strings = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 120))].slice(0, MAX_LIST) : [])

export function normalizeTaste(raw: unknown): TasteProfile {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return { likes: strings(o.likes), hidden: strings(o.hidden) }
}

export const toggleLike = (p: TasteProfile, interest: string): TasteProfile => ({ ...p, likes: p.likes.includes(interest) ? p.likes.filter((i) => i !== interest) : [...p.likes, interest].slice(-MAX_LIST) })
export const hide = (p: TasteProfile, id: string): TasteProfile => (p.hidden.includes(id) ? p : { ...p, hidden: [...p.hidden, id].slice(-MAX_LIST) })
export const restoreHidden = (p: TasteProfile): TasteProfile => ({ ...p, hidden: [] })
export const venueHideId = (venueId: string): string => `venue:${venueId}`

/** Why something is suggested, in the order the reasons are preferred. */
export type RecommendWhy = 'liked' | 'similarSaved' | 'pinnedVenue' | 'sameKind'

export interface EventPick {
  event: ExplorerEvent
  venueId: string
  venueTitle: string
  why: RecommendWhy
  /** The interest or venue kind the reason names. */
  about: string
}

export const MAX_PICKS = 4

const band = (start: string): number => {
  const h = Number(start.slice(0, 2))
  return h < 12 ? 0 : h < 17 ? 1 : 2
}

const isPast = (day: ExplorerDay): boolean => day.currentDay !== undefined && day.day < day.currentDay

/**
 * Events worth suggesting on one Explorer's day: those whose interest the guest chose, or matches something already on their plan, or that happen at a venue they pinned.
 * Never cancelled, full, over, already planned or dismissed. Chosen greedily with a penalty for a repeat of an interest, venue or part of the day, so the list is spread
 * across kinds and times and does not simply follow the most popular events (ENT-152). Nothing is suggested without a signal.
 */
export function recommendEvents(day: ExplorerDay, taste: TasteProfile, ctx: { now: number; pinnedVenueIds: readonly string[] }, max = MAX_PICKS): EventPick[] {
  if (isPast(day)) return []
  const mine = new Set(day.mine)
  const planned = day.venues.flatMap((v) => v.events).filter((e) => mine.has(e.id))
  const savedInterests = new Set(planned.map((e) => e.interest))
  const hidden = new Set(taste.hidden)
  const likes = new Set(taste.likes)
  const pinned = new Set(ctx.pinnedVenueIds)
  const cands: { e: ExplorerEvent; v: VenueDay; why: RecommendWhy; about: string; base: number }[] = []
  for (const v of day.venues) {
    if (hidden.has(venueHideId(v.venue.id))) continue
    for (const e of v.events) {
      if (e.status === 'cancelled' || e.left === 0 || e.endAt <= ctx.now || mine.has(e.id) || hidden.has(e.id)) continue
      if (likes.has(e.interest)) cands.push({ e, v, why: 'liked', about: e.interest, base: 3 })
      else if (savedInterests.has(e.interest)) cands.push({ e, v, why: 'similarSaved', about: e.interest, base: 2 })
      else if (pinned.has(v.venue.id)) cands.push({ e, v, why: 'pinnedVenue', about: v.venue.title, base: 1.5 })
    }
  }
  const picks: EventPick[] = []
  const rest = [...cands]
  while (picks.length < max && rest.length > 0) {
    let best = 0
    let bestScore = -Infinity
    rest.forEach((c, i) => {
      const score = c.base - 1.5 * picks.filter((p) => p.event.interest === c.e.interest).length - picks.filter((p) => p.venueId === c.v.venue.id).length - 0.75 * picks.filter((p) => band(p.event.start) === band(c.e.start)).length
      const better = score > bestScore || (score === bestScore && (c.e.startAt < rest[best].e.startAt || (c.e.startAt === rest[best].e.startAt && c.e.id < rest[best].e.id)))
      if (better) { best = i; bestScore = score }
    })
    const [c] = rest.splice(best, 1)
    picks.push({ event: c.e, venueId: c.v.venue.id, venueTitle: c.v.venue.title, why: c.why, about: c.about })
  }
  return picks.sort((a, b) => a.event.startAt - b.event.startAt)
}

export interface VenuePick { venueId: string; why: RecommendWhy; about: string }

/**
 * Places to eat or drink worth a look: those with events in an interest the guest chose, and places of the same kind as one they pinned. Open that day, not pinned (pins already
 * lead), not dismissed. One place per kind first, and at least one without a cover charge when there is one, so the list is not all premium (DIN-261).
 */
export function recommendVenues(day: ExplorerDay, taste: TasteProfile, ctx: { pinnedVenueIds: readonly string[] }, max = MAX_PICKS): VenuePick[] {
  if (isPast(day)) return []
  const hidden = new Set(taste.hidden)
  const likes = new Set(taste.likes)
  const pinned = new Set(ctx.pinnedVenueIds)
  const pinnedKinds = new Set(day.venues.filter((v) => pinned.has(v.venue.id)).map((v) => v.venue.kind))
  const cands: { v: VenueDay; why: RecommendWhy; about: string }[] = []
  for (const v of day.venues) {
    if (pinned.has(v.venue.id) || hidden.has(venueHideId(v.venue.id)) || v.hours.closedBecause !== null || v.hours.windows.length === 0) continue
    const liked = v.events.find((e) => e.status !== 'cancelled' && likes.has(e.interest))
    if (liked) cands.push({ v, why: 'liked', about: liked.interest })
    else if (pinnedKinds.has(v.venue.kind)) cands.push({ v, why: 'sameKind', about: v.venue.kind })
  }
  cands.sort((a, b) => Number(b.why === 'liked') - Number(a.why === 'liked') || a.v.venue.order - b.v.venue.order)
  const chosen: typeof cands = []
  for (const c of cands) if (chosen.length < max && !chosen.some((x) => x.v.venue.kind === c.v.venue.kind)) chosen.push(c)
  for (const c of cands) if (chosen.length < max && !chosen.includes(c)) chosen.push(c)
  if (chosen.length > 1 && chosen.every((c) => (c.v.venue.cover ?? 0) > 0)) {
    const free = cands.find((c) => !chosen.includes(c) && (c.v.venue.cover ?? 0) === 0)
    if (free) chosen[chosen.length - 1] = free
  }
  return chosen.map((c) => ({ venueId: c.v.venue.id, why: c.why, about: c.about }))
}

/** The venues with those suggested moved to the front, otherwise in the order given. Callers pass the list after the pins, and use `unpinned` so a pin never loses its place. */
export function forYouFirst<V extends { venue: { id: string } }>(venues: readonly V[], pickedIds: readonly string[], isPinned: (v: V) => boolean): V[] {
  const picked = new Set(pickedIds)
  const pins = venues.filter(isPinned)
  const rest = venues.filter((v) => !isPinned(v))
  return [...pins, ...rest.filter((v) => picked.has(v.venue.id)), ...rest.filter((v) => !picked.has(v.venue.id))]
}

/** The interest themes present in an Explorer's events, so the guest is only offered themes that exist there. */
export function interestsOf(day: ExplorerDay): string[] {
  return [...new Set(day.venues.flatMap((v) => v.events.map((e) => e.interest)))].sort()
}
