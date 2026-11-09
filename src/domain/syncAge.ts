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

/** What the sync chip says (MNG-03): live copy, saved copy, changes waiting to send, a lookup that failed, or no cruise linked. */
export type ChipKind = 'current' | 'stale' | 'pending' | 'unavailable' | 'notLinked'

/** A lookup that failed is "unavailable", never "no cruise"; "not linked" is only for an account that really has none. Changes waiting to send show above the freshness of the copy. */
export function chipKind(input: { state: SyncState; updated: Date; now: Date; pending: number; lookup?: 'unavailable' | 'notLinked' }): ChipKind {
  if (input.lookup === 'notLinked') return 'notLinked'
  if (input.lookup === 'unavailable') return 'unavailable'
  if (input.pending > 0) return 'pending'
  if (input.state === 'offline') return 'stale'
  return 'current'
}
