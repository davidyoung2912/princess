import { inQuietHours, type Category, type Channel, type NotificationPrefs } from './notifications'
import { marketingLeft, sendMarketing, type OfferState } from './offers'
import type { Consents } from './privacy'

/** NOT-01 and MNG-14: what happens to a message before it reaches the sender. The sender itself is a stub (nothing leaves the device or server). */
export interface DeliveryMessage {
  id: string
  category: Category
  channel: Channel
  subject: string
  body: string
}

export type DeliveryOutcome = 'sent' | 'held' | 'skipped'
export type DeliveryReason = 'preference' | 'noConsent' | 'weeklyCap' | 'quietHours'

export interface DeliveryDecision { outcome: DeliveryOutcome; reason?: DeliveryReason }

export interface OutboxEntry { message: DeliveryMessage; outcome: DeliveryOutcome; reason?: DeliveryReason; at: number }

/** Marketing needs a recorded opt-in for the channel. Push is covered by the device permission, which the guest gives separately. */
export function marketingConsentFor(channel: Channel, consents: Consents): boolean {
  if (channel === 'email') return consents.marketingEmail
  if (channel === 'sms') return consents.marketingSms
  return true
}

export interface DeliveryContext {
  prefs: NotificationPrefs
  consents: Consents
  /** Local time of day, "HH:MM". */
  timeOfDay: string
  offers: OfferState
  nowMs: number
}

/**
 * Decides what to do with one message. Critical messages always go. Everything else respects the channel switch and quiet hours;
 * marketing (the `offers` category) also needs consent for the channel and stays under the weekly cap. Quiet hours hold a message
 * for later; the other refusals drop it.
 */
export function decideDelivery(m: Pick<DeliveryMessage, 'category' | 'channel'>, c: DeliveryContext): DeliveryDecision {
  if (m.category === 'critical') return { outcome: 'sent' }
  if (!c.prefs.channels[m.category][m.channel]) return { outcome: 'skipped', reason: 'preference' }
  if (m.category === 'offers') {
    if (!marketingConsentFor(m.channel, c.consents)) return { outcome: 'skipped', reason: 'noConsent' }
    if (marketingLeft(c.offers, c.nowMs) <= 0) return { outcome: 'skipped', reason: 'weeklyCap' }
  }
  if (inQuietHours(c.prefs.quiet, c.timeOfDay, m.category)) return { outcome: 'held', reason: 'quietHours' }
  return { outcome: 'sent' }
}

export const MAX_OUTBOX = 50

/** Runs a message through the rules and records it. A sent marketing message is counted against the weekly cap. */
export function deliver(outbox: readonly OutboxEntry[], offers: OfferState, m: DeliveryMessage, c: DeliveryContext): { outbox: OutboxEntry[]; offers: OfferState; decision: DeliveryDecision } {
  const decision = decideDelivery(m, c)
  let nextOffers = offers
  if (decision.outcome === 'sent' && m.category === 'offers') nextOffers = sendMarketing(offers, c.nowMs).state
  const entry: OutboxEntry = { message: m, outcome: decision.outcome, ...(decision.reason ? { reason: decision.reason } : {}), at: c.nowMs }
  return { outbox: [...outbox, entry].slice(-MAX_OUTBOX), offers: nextOffers, decision }
}

/** Held messages go out once quiet hours end; those still inside them stay held. */
export function releaseHeld(outbox: readonly OutboxEntry[], prefs: NotificationPrefs, timeOfDay: string, nowMs: number): OutboxEntry[] {
  return outbox.map((e) => (e.outcome === 'held' && !inQuietHours(prefs.quiet, timeOfDay, e.message.category) ? { message: e.message, outcome: 'sent' as const, at: nowMs } : e))
}
