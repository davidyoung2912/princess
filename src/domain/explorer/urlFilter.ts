/** What an address can pre-set on an Explorer's list, so a suggestion from Stanley can arrive already narrowed: `?q=` (words to search) and `?type=` (a kind of venue, or a tour interest). Framework-free. */
export const MAX_Q = 60

export interface UrlFilter { q: string; type: string | null }

export function readUrlFilter(params: Pick<URLSearchParams, 'get'>): UrlFilter {
  const q = (params.get('q') ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_Q)
  const type = (params.get('type') ?? '').trim().slice(0, 30)
  return { q, type: type === '' ? null : type }
}
