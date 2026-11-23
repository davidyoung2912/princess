/**
 * What an address can pre-set on an Explorer's list, so a suggestion from Stanley can arrive already narrowed: `?q=` (words to search), `?type=` (a kind of venue, or a tour interest),
 * `?diet=` (a way the ship marks a dish: vegan, vegetarian or nas) and `?age=` (the youngest guest's age, for tours). They are only start values; the guest can change or clear them. Framework-free.
 */
export const MAX_Q = 60
export const DIET_MARKS = ['vegan', 'vegetarian', 'nas'] as const
export type UrlDiet = (typeof DIET_MARKS)[number]
/** The oldest age a tour filter takes; anything outside 0 to this is ignored. */
export const MAX_AGE = 17

export interface UrlFilter { q: string; type: string | null; diet: UrlDiet | null; age: number | null }

export function readUrlFilter(params: Pick<URLSearchParams, 'get'>): UrlFilter {
  const q = (params.get('q') ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_Q)
  const type = (params.get('type') ?? '').trim().slice(0, 30)
  const diet = (params.get('diet') ?? '').trim().toLowerCase()
  const ageText = (params.get('age') ?? '').trim()
  const age = /^\d{1,2}$/.test(ageText) && Number(ageText) <= MAX_AGE ? Number(ageText) : null
  return { q, type: type === '' ? null : type, diet: (DIET_MARKS as readonly string[]).includes(diet) ? (diet as UrlDiet) : null, age }
}
