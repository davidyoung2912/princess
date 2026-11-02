import type { Difficulty, Level } from './planning'

/**
 * Access reference data from the server (multi-device plan Phase 5): excursion difficulty and the room types with accessible staterooms.
 * Until the server's copy arrives (or without a server) the authored copies in `planning.ts` and `cabins.ts` are used. Pure; one module-level copy.
 */
export interface AccessReference { difficulty: Record<string, Difficulty>; accessibleCategories: string[] }

let served: AccessReference | null = null

export const servedAccess = (): AccessReference | null => served
export const setServedAccess = (ref: AccessReference | null): void => { served = ref }

const LEVELS: readonly Level[] = ['low', 'medium', 'high']
const level = (v: unknown): Level | null => (LEVELS as readonly unknown[]).includes(v) ? (v as Level) : null

/** Reads the server's answer; a bad entry is dropped, and an answer with nothing usable gives null so the authored copies stay in use. */
export function normalizeAccessReference(raw: unknown): AccessReference | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { difficulty?: unknown; accessibleCategories?: unknown }
  if (!r.difficulty || typeof r.difficulty !== 'object' || !Array.isArray(r.accessibleCategories)) return null
  const difficulty: Record<string, Difficulty> = {}
  for (const [id, v] of Object.entries(r.difficulty as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue
    const d = v as Record<string, unknown>
    const heat = level(d.heat)
    const shade = level(d.shade)
    if (typeof d.km !== 'number' || !Number.isFinite(d.km) || !heat || !shade) continue
    difficulty[id] = { km: d.km, steps: d.steps === true, heat, shade, seats: d.seats === true, restrooms: d.restrooms === true, wet: d.wet === true }
  }
  if (Object.keys(difficulty).length === 0) return null
  return { difficulty, accessibleCategories: r.accessibleCategories.filter((c): c is string => typeof c === 'string') }
}
