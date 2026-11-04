import { dressNights } from './prepMore'
import { openAt, type DayType, type DirectoryVenue } from './menus'
import { PLACES, type Place } from './deck'
import type { Occasion } from './planPolish'

/**
 * Small delights, phase DL7 (docs/small-delights.md): sea days. Pure helpers for the tonight dress badge, dish favourites, the drink diary,
 * park-my-spot, a thank-you to a venue, the celebration day message and the night palette. State is kept on this device and travels in the memory
 * document. Dress rules are authored concept samples (the same rule the packing list uses).
 */

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const rec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const MIN = 60_000

// ---------------------------------------------------------------- D6-2: tonight's dress code

export type Dress = 'casual' | 'smart' | 'elegant'

/** Tonight's dress for day `day` of a cruise of `nights` nights: elegant on the formal nights, casual on the first and last nights, smart casual otherwise. */
export function dressTonight(day: number, nights: number): Dress {
  if (dressNights(nights).includes(day)) return 'elegant'
  if (day <= 1 || day >= nights + 1) return 'casual'
  return 'smart'
}

// ---------------------------------------------------------------- D6-4: dish favourites

export const FAVOURITES_MAX = 40
export interface Favourite { venueId: string; dish: string }

const sameFav = (a: Favourite, b: Favourite): boolean => a.venueId === b.venueId && a.dish === b.dish
export const isFavourite = (favs: readonly Favourite[], venueId: string, dish: string): boolean => favs.some((f) => sameFav(f, { venueId, dish }))

/** Hearts or un-hearts a dish; a full list refuses a new heart. */
export function toggleFavourite(favs: readonly Favourite[], venueId: string, dish: string): Favourite[] {
  if (isFavourite(favs, venueId, dish)) return favs.filter((f) => !sameFav(f, { venueId, dish }))
  return favs.length >= FAVOURITES_MAX ? [...favs] : [...favs, { venueId, dish }]
}

const hash = (s: string): number => { let h = 5381; for (const c of s) h = (Math.imul(h, 33) + c.charCodeAt(0)) >>> 0; return h }

/** Counters and cafés keep the same dishes every day; the dining rooms and specialty restaurants rotate. (`americana` is Sun's diner; the ids are harmless on other ships.) */
const FIXED_MENU: readonly string[] = ['eatery', 'americana', 'lido', 'intl-cafe', 'omalleys', 'alfredo']

/**
 * Whether a dish is on the menu on cruise day `cruiseDay`. Rooms with a fixed menu always have all their dishes; the others feature each dish on
 * about two nights in three, the same every time for the same day (an authored concept rotation, not the ship's real menu). Day 0 (not known) counts as on.
 */
export function onTonight(venueId: string, dish: string, cruiseDay: number): boolean {
  if (cruiseDay <= 0 || FIXED_MENU.includes(venueId)) return true
  return hash(`${venueId}|${dish}|${cruiseDay}`) % 3 !== 0
}

/** The hearted dishes that are on tonight's menu in a room that is open for dinner (7 pm) today. */
export function favouritesTonight(favs: readonly Favourite[], venues: readonly DirectoryVenue[], day: DayType, cruiseDay = 0, time = '19:00'): { venue: DirectoryVenue; dish: string }[] {
  return favs.flatMap((f) => {
    const venue = venues.find((v) => v.id === f.venueId)
    return venue && openAt(venue, day, time) && onTonight(venue.id, f.dish, cruiseDay) ? [{ venue, dish: f.dish }] : []
  })
}

// ---------------------------------------------------------------- D6-10: drink diary

export const DIARY_MAX = 60
export const VERDICTS = ['liked', 'ok', 'notAgain'] as const
export type Verdict = (typeof VERDICTS)[number]
export const isVerdict = (v: unknown): v is Verdict => VERDICTS.some((x) => x === v)
export interface DiaryEntry { id: string; name: string; verdict: Verdict; note: string; /** Day of the cruise, 0 when not known. */ day: number }

export function addDiaryEntry(entries: readonly DiaryEntry[], e: DiaryEntry): DiaryEntry[] {
  const name = clean(e.name, 50)
  if (!name || entries.length >= DIARY_MAX || entries.some((x) => x.id === e.id)) return [...entries]
  return [...entries, { id: clean(e.id, 40), name, verdict: isVerdict(e.verdict) ? e.verdict : 'ok', note: clean(e.note, 140), day: Math.max(0, Math.min(14, Math.round(e.day) || 0)) }]
}

/** Drinks to order again: the liked ones, once each (the newest note wins), newest first. */
export function orderAgain(entries: readonly DiaryEntry[]): DiaryEntry[] {
  const seen = new Set<string>()
  const out: DiaryEntry[] = []
  for (const e of [...entries].reverse()) {
    const key = e.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    if (e.verdict === 'liked') out.push(e)
  }
  return out
}

// ---------------------------------------------------------------- D6-5: park my spot

export const SPOT_MINUTES = [30, 45, 60, 90] as const
export const SPOT_DEFAULT_MINUTES = 45
export interface Spot { placeId: string; note: string; /** When it was parked, ms. */ at: number; minutes: number }

/** Places where a guest leaves a lounger or a table: pool decks, bars and dining rooms (a pin is only ever to a named place). */
export const spotPlaces = (): Place[] => PLACES.filter((p) => p.kind === 'pool' || p.kind === 'dining' || p.kind === 'bar' || p.kind === 'show')

export function parkSpot(placeId: string, note: string, now: number, minutes: number = SPOT_DEFAULT_MINUTES): Spot | null {
  if (!PLACES.some((p) => p.id === placeId)) return null
  return { placeId, note: clean(note, 80), at: now, minutes: SPOT_MINUTES.some((m) => m === minutes) ? minutes : SPOT_DEFAULT_MINUTES }
}

/** Whole minutes until the pin is due back (0 once it is due). Fair-use: the guest is reminded, nobody else is told. */
export const spotMinutesLeft = (s: Spot, now: number): number => Math.max(0, s.minutes - Math.floor((now - s.at) / MIN))
export const spotDue = (s: Spot, now: number): boolean => spotMinutesLeft(s, now) === 0

// ---------------------------------------------------------------- D6-7: say thanks

export const THANKS_MAX = 30
export interface Thanks { id: string; to: string; text: string; at: number }

export const THANKS_TARGETS = ['dining', 'cabin', 'bar', 'show', 'kids', 'medical', 'deck'] as const
export type ThanksTarget = (typeof THANKS_TARGETS)[number]

/** A short thank-you. It carries no rating and no tip, and names the team, not a person unless the guest types the name. */
export function thanksText(team: string, name: string, line: string): string {
  const who = clean(name, 40)
  const what = clean(line, 140)
  const opening = who ? `Thank you, ${who}, and the ${clean(team, 40)} team.` : `Thank you to the ${clean(team, 40)} team.`
  return what ? `${opening} ${what}` : opening
}

export function addThanks(list: readonly Thanks[], th: Thanks): Thanks[] {
  const text = clean(th.text, 300)
  if (!text || list.length >= THANKS_MAX) return [...list]
  return [...list, { id: clean(th.id, 40), to: clean(th.to, 40), text, at: th.at }]
}

// ---------------------------------------------------------------- D6-8: celebration day

export const CELEBRATION_MAX = 240
/** The occasion that falls on this date (month and day only), or null. */
export const occasionOn = (occasions: readonly Occasion[], date: string): Occasion | null => occasions.find((o) => o.date.slice(5) === date.slice(5)) ?? null

/** Private messages for an occasion, by occasion id. Only the signed-in guest adds to them here; cabin-mates adding theirs needs the server. */
export type Wishes = Record<string, string[]>
export function addWish(wishes: Wishes, occasionId: string, text: string): Wishes {
  const line = clean(text, CELEBRATION_MAX)
  const id = clean(occasionId, 40)
  const have = wishes[id] ?? []
  if (!line || !id || have.length >= 6) return wishes
  return { ...wishes, [id]: [...have, line] }
}

// ---------------------------------------------------------------- server views (thanks and wishes)

export interface ThanksItem { id: string; team: string; text: string; at: number; mine: boolean }
export interface ThanksView { items: ThanksItem[]; canAdd: boolean }
export interface WishItem { id: string; celebrationId: string; author: string; text: string; at: number; mine: boolean }
export interface WishesView { items: WishItem[]; canAdd: boolean }

/** The messages for one celebration, oldest first. */
export const wishesFor = (items: readonly WishItem[], celebrationId: string): WishItem[] => items.filter((w) => w.celebrationId === celebrationId).sort((a, b) => a.at - b.at)

// ---------------------------------------------------------------- state

export interface SeaState { favourites: Favourite[]; diary: DiaryEntry[]; spot: Spot | null; thanks: Thanks[]; wishes: Wishes }
export const EMPTY_SEA: SeaState = { favourites: [], diary: [], spot: null, thanks: [], wishes: {} }

export function normalizeSea(raw: unknown): SeaState {
  const r = rec(raw)
  const favourites = arr(r.favourites).flatMap((x): Favourite[] => {
    const o = rec(x)
    return typeof o.venueId === 'string' && clean(o.dish, 80) ? [{ venueId: clean(o.venueId, 30), dish: clean(o.dish, 80) }] : []
  }).reduce<Favourite[]>((acc, f) => (isFavourite(acc, f.venueId, f.dish) ? acc : [...acc, f]), []).slice(0, FAVOURITES_MAX)
  const diary = arr(r.diary).reduce<DiaryEntry[]>((acc, x) => {
    const o = rec(x)
    return typeof o.id === 'string' && typeof o.name === 'string'
      ? addDiaryEntry(acc, { id: o.id, name: o.name, verdict: isVerdict(o.verdict) ? o.verdict : 'ok', note: clean(o.note, 140), day: typeof o.day === 'number' ? o.day : 0 })
      : acc
  }, [])
  const s = rec(r.spot)
  const spot = typeof s.placeId === 'string' && typeof s.at === 'number' && Number.isFinite(s.at) ? parkSpot(s.placeId, clean(s.note, 80), s.at, typeof s.minutes === 'number' ? s.minutes : SPOT_DEFAULT_MINUTES) : null
  const thanks = arr(r.thanks).reduce<Thanks[]>((acc, x) => {
    const o = rec(x)
    return typeof o.id === 'string' && typeof o.text === 'string' ? addThanks(acc, { id: o.id, to: clean(o.to, 40), text: o.text, at: typeof o.at === 'number' ? o.at : 0 }) : acc
  }, [])
  const wishes: Wishes = {}
  for (const [k, v] of Object.entries(rec(r.wishes)).slice(0, 20)) {
    const lines = arr(v).map((x) => clean(x, CELEBRATION_MAX)).filter(Boolean).slice(0, 6)
    if (lines.length > 0) wishes[clean(k, 40)] = lines
  }
  return { favourites, diary, spot, thanks, wishes }
}
