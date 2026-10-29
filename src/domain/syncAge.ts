/** Wording for "how old is what I am looking at" (OB-08, PERF-06): every cached view says when it was last updated. */

export type SyncState = 'live' | 'offline'

export interface AgeLabel {
  /** Machine-readable key for the visible words, filled in by the caller's `t`. */
  kind: 'justNow' | 'updatedAt' | 'offlineSince'
  /** The clock time to show ("9:14 am"), when the label has one. */
  time?: string
}

/** Clock time as "9:14 am" in a named time zone (the ship's, when shown on board). */
export function clockTime(at: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone })
    .format(at)
    .replace(/\s?(AM|PM)$/i, (_, ap: string) => ` ${ap.toLowerCase()}`)
}

/** What to say about data last updated at `updated`, given whether the guest is online. A minute or less is "just now". */
export function ageLabel(updated: Date, now: Date, state: SyncState, timeZone?: string): AgeLabel {
  if (state === 'offline') return { kind: 'offlineSince', time: clockTime(updated, timeZone) }
  if (now.getTime() - updated.getTime() <= 60_000) return { kind: 'justNow' }
  return { kind: 'updatedAt', time: clockTime(updated, timeZone) }
}
