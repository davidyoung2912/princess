/**
 * Resetting a forgotten account PIN (ACC-03). The guest asks in the app, shows ID at Guest Services, and once the desk has checked it the
 * guest can set a new PIN without the old one. The request is good for a day. The demo clock stands in for the desk.
 */
export const PIN_DESK_MIN = 30
export const PIN_RESET_VALID_MIN = 24 * 60

const MIN = 60_000

export type PinResetStage = 'waiting' | 'ready' | 'expired'

export interface PinReset { askedAt: number; readyAt: number; expiresAt: number; stage: PinResetStage }

/** Where a reset request stands at `now`. */
export function pinReset(askedAt: number, now: number): PinReset {
  const readyAt = askedAt + PIN_DESK_MIN * MIN
  const expiresAt = readyAt + PIN_RESET_VALID_MIN * MIN
  return { askedAt, readyAt, expiresAt, stage: now < readyAt ? 'waiting' : now < expiresAt ? 'ready' : 'expired' }
}

/** Whether a new PIN may be set without the current one. */
export const canResetPin = (askedAt: number | null | undefined, now: number): boolean => typeof askedAt === 'number' && pinReset(askedAt, now).stage === 'ready'
