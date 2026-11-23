import type { DietMark, DishFlag, ExplorerVenueInfo, MealDish, HoursDay, MealMenu, VenueDay } from '../../../shared/api/explorerTypes'
import { openState } from './presentation'
import type { Window } from './types'

const mins = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))

/** The meal periods of the quick filters (DIN-004). Room service is not a venue, so it is a link, not a period. */
export type MealPeriod = 'breakfast' | 'lunch' | 'dinner' | 'late'
export const MEAL_PERIODS: readonly MealPeriod[] = ['breakfast', 'lunch', 'dinner', 'late']

/** Ship time. A place serves a period when it is open at any point inside it. */
export const PERIOD_WINDOWS: Record<MealPeriod, Window> = { breakfast: ['06:00', '10:30'], lunch: ['11:30', '14:30'], dinner: ['17:00', '22:00'], late: ['22:00', '24:00'] }

/** Whether the day's opening hours overlap a meal period. */
export const servesPeriod = (hours: Pick<HoursDay, 'windows'>, period: MealPeriod): boolean => {
  const [from, to] = PERIOD_WINDOWS[period]
  return hours.windows.some(([a, b]) => mins(a) < mins(to) && mins(from) < mins(b))
}

/** The ready-made prompts (DIN-058). "Near my next activity" is not offered: nothing says where the next activity is. */
export type DiningPrompt = 'quick' | 'family' | 'occasion' | 'included' | 'late'
export const DINING_PROMPTS: readonly DiningPrompt[] = ['quick', 'family', 'occasion', 'included', 'late']

export const isFamilyFriendly = (v: Pick<ExplorerVenueInfo, 'family' | 'kidsMenu' | 'minAge' | 'kind'>): boolean =>
  v.kind !== 'bar' && (v.minAge ?? 0) === 0 && ((v.family?.length ?? 0) > 0 || (v.kidsMenu?.length ?? 0) > 0)

export const hasKidsMenu = (v: Pick<ExplorerVenueInfo, 'kidsMenu'>): boolean => (v.kidsMenu?.length ?? 0) > 0

/** No cover charge, and not a bar: food that is in the fare. */
export const isIncluded = (v: Pick<ExplorerVenueInfo, 'cover' | 'kind'>): boolean => (v.cover ?? 0) === 0 && v.kind !== 'bar'

/** Whether a venue suits a prompt on the day. */
export function matchesPrompt(day: Pick<VenueDay, 'venue' | 'hours'>, prompt: DiningPrompt): boolean {
  const v = day.venue
  switch (prompt) {
    case 'quick': return v.kind === 'casual'
    case 'family': return isFamilyFriendly(v)
    case 'occasion': return v.kind === 'specialty'
    case 'included': return isIncluded(v)
    case 'late': return servesPeriod(day.hours, 'late')
  }
}

export interface DishHit { name: string; meal: MealMenu['meal'] }

/** The dishes on a venue's menus for the day whose name or note holds every word searched for. */
export function dishHits(menus: readonly MealMenu[], query: string): DishHit[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const hits: DishHit[] = []
  for (const m of menus) for (const c of m.courses) for (const d of c.dishes) {
    const text = `${d.name} ${d.note ?? ''}`.toLowerCase()
    if (words.every((w) => text.includes(w)) && !hits.some((h) => h.name === d.name)) hits.push({ name: d.name, meal: m.meal })
  }
  return hits
}

/** The dishes on a venue's menus for the day that the ship marks with a diet (vegan, vegetarian, no added sugar). Only the ship's own marks: this never says a dish is free of an allergen. */
export function markedDishes(menus: readonly MealMenu[], mark: DietMark): DishHit[] {
  const hits: DishHit[] = []
  for (const m of menus) for (const c of m.courses) for (const d of c.dishes) if (d.marks?.includes(mark) && !hits.some((h) => h.name === d.name)) hits.push({ name: d.name, meal: m.meal })
  return hits
}

/** The heads-up flags (alcohol, raw or undercooked, spicy) that at least one dish on these menus carries, in a fixed order, so a legend can name only what the menu uses. */
export function usedFlags(menus: readonly MealMenu[]): DishFlag[] {
  return usedDishFlags(menus.flatMap((m) => m.courses.flatMap((c) => c.dishes)))
}

/** The same, for a plain list of dishes such as a children's menu. */
export function usedDishFlags(dishes: readonly Pick<MealDish, 'flags'>[]): DishFlag[] {
  return (['alcohol', 'raw', 'spicy'] as const).filter((f) => dishes.some((d) => d.flags?.includes(f)))
}

/** The flags on a dish that the guest asked to be told about, in the order the dish lists them. */
export function avoidedFlags(flags: readonly DishFlag[] | undefined, avoid: readonly DishFlag[] | undefined): DishFlag[] {
  return (flags ?? []).filter((f) => avoid?.includes(f))
}

export type DiningSort = 'suggested' | 'open' | 'price'
export const DINING_SORTS: readonly DiningSort[] = ['suggested', 'open', 'price']

export interface DiningFilter {
  kind: string | null
  period: MealPeriod | null
  prompt: DiningPrompt | null
  kidsMenu: boolean
  /** Only places with a dish the ship marks with this diet on the day's menus. */
  diet: DietMark | null
  query: string
}

export const NO_DINING_FILTER: DiningFilter = { kind: null, period: null, prompt: null, kidsMenu: false, diet: null, query: '' }

/** Whether any filter is on, for the "clear" control. */
export const isFiltering = (f: DiningFilter): boolean => f.kind !== null || f.period !== null || f.prompt !== null || f.kidsMenu || f.diet !== null || f.query.trim() !== ''

const matchesWords = (v: Pick<ExplorerVenueInfo, 'title' | 'short' | 'long'>, query: string): boolean => {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const text = `${v.title} ${v.short} ${v.long}`.toLowerCase()
  return words.every((w) => text.includes(w))
}

/** The venues that pass every filter. A word search also finds a venue by a dish on its menu. Order is kept. */
export function filterDining<V extends Pick<VenueDay, 'venue' | 'hours' | 'menus'>>(days: readonly V[], f: DiningFilter): V[] {
  return days.filter((d) =>
    (f.kind === null || d.venue.kind === f.kind) &&
    (f.period === null || servesPeriod(d.hours, f.period)) &&
    (f.prompt === null || matchesPrompt(d, f.prompt)) &&
    (!f.kidsMenu || hasKidsMenu(d.venue)) &&
    (f.diet === null || markedDishes(d.menus, f.diet).length > 0) &&
    (f.query.trim() === '' || matchesWords(d.venue, f.query) || dishHits(d.menus, f.query).length > 0))
}

/**
 * Orders the venues. "suggested" keeps the order given (pins, then authored); "open" puts places open now first (then those opening later, then closed ones),
 * and "price" puts the cheapest first with included places before covered ones. Each keeps the given order among equals.
 */
export function sortDining<V extends Pick<VenueDay, 'venue' | 'hours'>>(days: readonly V[], sort: DiningSort, o: { chosenDay: number; currentDay: number; now: string }): V[] {
  if (sort === 'suggested') return [...days]
  const rank = (d: V): number => {
    if (sort === 'price') return d.venue.cover ?? 0
    const s = openState(d.hours, o.chosenDay, o.currentDay, o.now).kind
    return s === 'openNow' || s === 'openAllDay' ? 0 : s === 'opensAt' ? 1 : 2
  }
  return days.map((d, i) => ({ d, i, r: rank(d) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.d)
}
