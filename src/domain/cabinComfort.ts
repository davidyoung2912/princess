import type { Cabin } from './cabins'
import type { CabinScore } from './cabinScore'

/**
 * DSC-06: the comfort indicators of a cabin, each tagged with how well it is known. Nothing here is "confirmed" unless a source says so: the
 * scores and notes are modelled from the deck, position and side, so they are "typical". Guest reports are not collected yet, so none are
 * shown, and when they are they must be moderated and never worded as a guarantee. Pure: no React.
 */
export type Basis = 'confirmed' | 'typical' | 'guestReported' | 'unknown'
export type IndicatorKey = 'noise' | 'motion' | 'lift' | 'connecting' | 'obstruction'

export interface Indicator { key: IndicatorKey; basis: Basis; text: string }

/** Optional facts a source has confirmed for this cabin; absent means not known. */
export interface ConfirmedFacts { connecting?: boolean; liftDistance?: 'near' | 'far' }

const level = (n: number): string => (n >= 4 ? 'usually good' : n === 3 ? 'average' : 'often poor')

export function comfortIndicators(score: CabinScore, confirmed: ConfirmedFacts = {}): Indicator[] {
  const c: Cabin = score.cabin
  const out: Indicator[] = [
    { key: 'noise', basis: 'typical', text: `Noise: ${level(score.noise)} for this deck and position` },
    { key: 'motion', basis: 'typical', text: `Motion: ${level(score.motion)} for this deck and position` },
  ]
  if (confirmed.liftDistance) out.push({ key: 'lift', basis: 'confirmed', text: confirmed.liftDistance === 'near' ? 'Close to a lift bank' : 'A longer walk to a lift bank' })
  else out.push({ key: 'lift', basis: 'typical', text: c.position === 'midship' ? 'Midship, usually near the lift banks' : `${c.position === 'forward' ? 'Forward' : 'Aft'}, usually further from the main lifts` })
  if (confirmed.connecting !== undefined) out.push({ key: 'connecting', basis: 'confirmed', text: confirmed.connecting ? 'Has a connecting door' : 'No connecting door' })
  else out.push({ key: 'connecting', basis: 'unknown', text: 'Connecting door: not known for this cabin' })
  out.push(c.obstructed
    ? { key: 'obstruction', basis: 'typical', text: 'View likely partly blocked by lifeboats' }
    : { key: 'obstruction', basis: 'unknown', text: 'Obstruction: no blocked view is recorded, which is not a promise of a clear one' })
  return out
}

/** Guest reports are not collected, so there is nothing to show; this is the line that says so rather than leaving a gap. */
export const GUEST_REPORTS_NOTE = 'No guest reports yet. When they exist they are checked before showing and are one guest’s view, not a guarantee.'
