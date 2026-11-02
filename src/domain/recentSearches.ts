export const MAX_RECENT = 5

export interface Recent { to: string; title: string }

/** The list with a screen put first: no repeats, at most `MAX_RECENT`. */
export function pushRecent(list: readonly Recent[], item: Recent, max = MAX_RECENT): Recent[] {
  return [item, ...list.filter((r) => r.to !== item.to)].slice(0, max)
}

/** A stored list read back safely: anything that is not a list of {to, title} strings is dropped. */
export function parseRecent(raw: string | null): Recent[] {
  if (!raw) return []
  try {
    const v: unknown = JSON.parse(raw)
    if (!Array.isArray(v)) return []
    return v.filter((r): r is Recent => !!r && typeof r === 'object' && typeof (r as Recent).to === 'string' && (r as Recent).to.startsWith('/') && typeof (r as Recent).title === 'string').slice(0, MAX_RECENT)
  } catch {
    return []
  }
}
