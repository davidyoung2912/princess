/** What disagrees in a check-in view, so the guest is told instead of left to guess (research 5.8). */
export type CheckinConflict = 'finishedButOpen' | 'finishedNoTime'

/** The input needed: the status word, the steps still open and when it was finished. Kept small so any view fits. */
export interface CheckinFacts { state: string; stepsLeft: number; finishedAt: number | null }

/**
 * A view that says check-in is finished while steps are still open, or finished with no time recorded, is contradicting itself. The screen shows both
 * facts, the open steps first, and a way to reach a person; it never quietly picks one. Returns null when the view is consistent.
 */
export function checkinConflict(f: CheckinFacts): CheckinConflict | null {
  if (f.state !== 'done') return null
  if (f.stepsLeft > 0) return 'finishedButOpen'
  if (f.finishedAt === null) return 'finishedNoTime'
  return null
}
