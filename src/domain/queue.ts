/** Virtual queues for walk-in places and waitlists for full tables (DIN-02). Positions move with the demo clock, so they are the same every time for the same moment. */
export const QUEUE_STEP_MIN = 6
export const HOLD_MIN = 10
export const WAITLIST_OFFER_AFTER_MIN = 180
export const WAITLIST_OFFER_HOLD_MIN = 120
export const WAITLIST_MIN_LEAD_MIN = 45

const MIN = 60_000

const hash = (text: string): number => {
  let h = 5381
  for (const ch of text) h = (Math.imul(h, 33) + ch.charCodeAt(0)) >>> 0
  return h
}

/** Where a new arrival starts in the queue: 3 to 10 parties ahead. */
export const startingPosition = (venueId: string, joinedAt: number): number => 3 + (hash(`${venueId}|${Math.floor(joinedAt / (30 * MIN))}`) % 8)

export type QueueStage = 'waiting' | 'ready' | 'expired'
export interface QueueState { stage: QueueStage; position: number; waitMinutes: number; readyAt: number; expiresAt: number }

export function queueState(joinedAt: number, start: number, now: number): QueueState {
  const readyAt = joinedAt + start * QUEUE_STEP_MIN * MIN
  const expiresAt = readyAt + HOLD_MIN * MIN
  if (now >= expiresAt) return { stage: 'expired', position: 0, waitMinutes: 0, readyAt, expiresAt }
  if (now >= readyAt) return { stage: 'ready', position: 0, waitMinutes: 0, readyAt, expiresAt }
  const behind = Math.floor((now - joinedAt) / (QUEUE_STEP_MIN * MIN))
  const position = Math.max(1, start - behind)
  return { stage: 'waiting', position, waitMinutes: Math.max(1, Math.ceil((readyAt - now) / MIN)), readyAt, expiresAt }
}

export type WaitlistStage = 'waiting' | 'offered' | 'expired'
export interface WaitlistState { stage: WaitlistStage; position: number; offerAt: number; expiresAt: number }

/** A table is offered after three hours, or sooner when the slot is near (halfway to it), and the offer lasts two hours or until 15 minutes before the slot. */
export function waitlistState(joinedAt: number, slotAt: number, now: number, start = 1 + (joinedAt % 4)): WaitlistState {
  const offerAt = joinedAt + Math.min(WAITLIST_OFFER_AFTER_MIN * MIN, Math.floor((slotAt - joinedAt) / 2))
  const expiresAt = Math.min(offerAt + WAITLIST_OFFER_HOLD_MIN * MIN, slotAt - 15 * MIN)
  if (now >= expiresAt) return { stage: 'expired', position: 0, offerAt, expiresAt }
  if (now >= offerAt) return { stage: 'offered', position: 0, offerAt, expiresAt }
  return { stage: 'waiting', position: start, offerAt, expiresAt }
}

/** Whether a guest may still join a waitlist for a slot. */
export const canJoinWaitlist = (slotAt: number, now: number): boolean => slotAt - now >= WAITLIST_MIN_LEAD_MIN * MIN
