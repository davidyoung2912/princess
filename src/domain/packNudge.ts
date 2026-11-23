import type { PackResult } from '../data/cruisePack'

const DAY = 86_400_000
/** Copies of the programme stop being used after three days, so a download older than this is worth doing again close to sailing. */
export const STALE_AFTER_DAYS = 3

/** The stages in which the guest is close to sailing and should have the cruise on the phone. */
export const NUDGE_STAGES: readonly string[] = ['prebook', 'getToShip']

export type PackNudge = 'none' | 'first' | 'again' | 'finish'

/**
 * Whether Home should say "download your cruise" (research 4, D.1): never before the booking is close, once when nothing has been downloaded, again when the last
 * download is old or partial. After a complete, recent download it says nothing.
 */
export function packNudge(stage: string, last: Pick<PackResult, 'at' | 'failed' | 'total'> | null, now: number): PackNudge {
  if (!NUDGE_STAGES.includes(stage)) return 'none'
  if (!last || last.total === 0) return 'first'
  if (now - last.at > STALE_AFTER_DAYS * DAY) return 'again'
  return last.failed.length > 0 ? 'finish' : 'none'
}
