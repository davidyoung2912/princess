/**
 * What an alert's link carries (MOB-07, COM-06): the trip it was about (`trip`, a booking number), for a ship change which one (`update`), and for the other
 * kinds of alert the dining reservation (`reservation`), the case (`case`, its number) or the port day (`port` and `date`). The screen reads these to say so
 * when the alert is about something that is no longer there or no longer current. Framework-free.
 */
export interface DeepLink { trip: string | null; update: string | null; reservation: string | null; caseNumber: string | null; port: string | null; date: string | null }

const SAFE = /^[A-Za-z0-9_-]{1,40}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

export function parseDeepLink(search: string): DeepLink {
  const p = new URLSearchParams(search)
  const pick = (k: string): string | null => { const v = p.get(k); return v && SAFE.test(v) ? v : null }
  const date = p.get('date')
  return { trip: pick('trip'), update: pick('update'), reservation: pick('reservation'), caseNumber: pick('case'), port: pick('port'), date: date && DATE.test(date) ? date : null }
}

export type DeepLinkNote = 'otherTrip' | 'updateEnded' | 'reservationGone' | 'caseClosed' | 'portPassed'

/** What is current now. Each list or value is null until known, and nothing is said until it is. */
export interface DeepLinkNow {
  currentTrip: string | null
  activeUpdates: readonly string[] | null
  /** Ids of the dining reservations the guest still has. */
  reservations?: readonly string[] | null
  /** Case numbers still open (not resolved or withdrawn). */
  openCases?: readonly string[] | null
  /** Today's date on board or at home, "YYYY-MM-DD". */
  today?: string | null
}

export function deepLinkNotes(link: Pick<DeepLink, 'trip' | 'update'> & Partial<DeepLink>, now: DeepLinkNow): DeepLinkNote[] {
  const notes: DeepLinkNote[] = []
  if (link.trip && now.currentTrip && link.trip !== now.currentTrip) notes.push('otherTrip')
  if (link.update && now.activeUpdates && !now.activeUpdates.includes(link.update)) notes.push('updateEnded')
  if (link.reservation && now.reservations && !now.reservations.includes(link.reservation)) notes.push('reservationGone')
  if (link.caseNumber && now.openCases && !now.openCases.includes(link.caseNumber)) notes.push('caseClosed')
  if (link.port && link.date && now.today && link.date < now.today) notes.push('portPassed')
  return notes
}
