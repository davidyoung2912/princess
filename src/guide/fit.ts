/**
 * The guest's answers to "make this plan fit me": a first cruise, travelling alone, keeping offers quiet. One small document on the server (`guideFit`), read by the guide's rules.
 * It never holds anything about health or access. `at` is when the prompt was answered (or dismissed), so it is asked once. Framework-free so it is tested in node.
 */
export interface GuideFit {
  firstCruise?: boolean
  solo?: boolean
  quiet?: boolean
  at?: number
}

export const EMPTY_FIT: GuideFit = {}

const FLAGS = ['firstCruise', 'solo', 'quiet'] as const

/** Reads a stored or server document safely: only the three answers and the time are kept. */
export function normalizeFit(raw: unknown): GuideFit {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out: GuideFit = {}
  for (const k of FLAGS) if (typeof o[k] === 'boolean') out[k] = o[k]
  if (typeof o.at === 'number' && Number.isFinite(o.at)) out.at = o.at
  return Object.keys(out).length === 0 ? EMPTY_FIT : out
}

/** Both devices answered: the more recent answer wins whole. */
export function mergeFit(remote: unknown, local: unknown): GuideFit {
  const a = normalizeFit(remote)
  const b = normalizeFit(local)
  return (b.at ?? 0) >= (a.at ?? 0) ? (b === EMPTY_FIT ? a : b) : a
}

/** The prompt is asked until the guest has answered or dismissed it once. */
export const fitAnswered = (fit: GuideFit): boolean => fit.at !== undefined

/** Records the three answers. */
export const answerFit = (answers: { firstCruise: boolean; solo: boolean; quiet: boolean }, now: number): GuideFit => ({ ...answers, at: now })
