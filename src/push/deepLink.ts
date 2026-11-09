/**
 * What an alert's link carries (MOB-07, COM-06): the trip it was about (`trip`, a booking number) and, for a ship change, which one (`update`).
 * The screen reads these to say so when the alert is about something other than what is current now. Framework-free.
 */
export interface DeepLink { trip: string | null; update: string | null }

const SAFE = /^[A-Za-z0-9_-]{1,40}$/

export function parseDeepLink(search: string): DeepLink {
  const p = new URLSearchParams(search)
  const pick = (k: string): string | null => { const v = p.get(k); return v && SAFE.test(v) ? v : null }
  return { trip: pick('trip'), update: pick('update') }
}

export type DeepLinkNote = 'otherTrip' | 'updateEnded'

/** What to tell the guest. `currentTrip` and `activeUpdates` are null until known, and nothing is said until they are. */
export function deepLinkNotes(link: DeepLink, now: { currentTrip: string | null; activeUpdates: readonly string[] | null }): DeepLinkNote[] {
  const notes: DeepLinkNote[] = []
  if (link.trip && now.currentTrip && link.trip !== now.currentTrip) notes.push('otherTrip')
  if (link.update && now.activeUpdates && !now.activeUpdates.includes(link.update)) notes.push('updateEnded')
  return notes
}
