/** A known problem the service has declared (the same rows the status page lists). */
export interface Incident { id: string; area: string; startedAt: number; message: string; resolvedAt: number | null }

/**
 * The problems to put in front of a guest on any screen (research 14.11): the ones not yet resolved and not put away for this visit, oldest first. A feed that could
 * not be read is passed as null and gives nothing, never an "all clear". A guest who put one away sees it again only if it is a different problem.
 */
export function noticesToShow(list: readonly Incident[] | null | undefined, dismissed: ReadonlySet<string>): Incident[] {
  if (!list) return []
  return list.filter((i) => i.resolvedAt === null && !dismissed.has(i.id)).sort((a, b) => a.startedAt - b.startedAt)
}
