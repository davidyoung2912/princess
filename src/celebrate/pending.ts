/** A one-shot note that something just got finished, so the next screen can celebrate it once (not on every later visit or reload). Lives in memory only. */
export type Milestone = 'checkedIn'

let pending: Milestone | null = null

export const queueCelebration = (m: Milestone): void => { pending = m }
export const peekCelebration = (): Milestone | null => pending
export const clearCelebration = (): void => { pending = null }
