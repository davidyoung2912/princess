import { describe, expect, it } from 'vitest'
import { deliver, decideDelivery, MAX_OUTBOX, releaseHeld, type DeliveryContext, type DeliveryMessage } from './delivery'
import { DEFAULT_PREFS, type NotificationPrefs } from './notifications'
import { EMPTY_OFFER_STATE } from './offers'
import { NO_CONSENTS } from './privacy'

const prefs = (over: (p: NotificationPrefs) => void = () => {}): NotificationPrefs => {
  const p = structuredClone(DEFAULT_PREFS)
  over(p)
  return p
}
const ctx = (over: Partial<DeliveryContext> = {}): DeliveryContext => ({ prefs: DEFAULT_PREFS, consents: NO_CONSENTS, timeOfDay: '12:00', offers: EMPTY_OFFER_STATE, nowMs: 1_000_000, ...over })
const msg = (category: DeliveryMessage['category'], channel: DeliveryMessage['channel'] = 'email', id = 'm1'): DeliveryMessage => ({ id, category, channel, subject: 's', body: 'b' })
const marketingOn = prefs((p) => { p.channels.offers = { push: true, email: true, sms: true } })
const optedIn = { ...NO_CONSENTS, marketingEmail: true, marketingSms: true }

describe('decideDelivery', () => {
  it('always sends critical messages, through quiet hours and switches', () => {
    const quiet = prefs((p) => { p.quiet = { on: true, from: '00:00', to: '23:59' } })
    expect(decideDelivery(msg('critical', 'sms'), ctx({ prefs: quiet }))).toEqual({ outcome: 'sent' })
  })
  it('skips a channel the guest turned off', () => {
    expect(decideDelivery(msg('payments', 'sms'), ctx())).toEqual({ outcome: 'skipped', reason: 'preference' })
    expect(decideDelivery(msg('payments', 'email'), ctx())).toEqual({ outcome: 'sent' })
  })
  it('holds a non-critical message in quiet hours, including across midnight', () => {
    const quiet = prefs((p) => { p.quiet = { on: true, from: '22:00', to: '07:00' } })
    expect(decideDelivery(msg('payments'), ctx({ prefs: quiet, timeOfDay: '23:30' }))).toEqual({ outcome: 'held', reason: 'quietHours' })
    expect(decideDelivery(msg('payments'), ctx({ prefs: quiet, timeOfDay: '06:59' })).outcome).toBe('held')
    expect(decideDelivery(msg('payments'), ctx({ prefs: quiet, timeOfDay: '07:00' })).outcome).toBe('sent')
  })
  it('needs channel consent for marketing, even when the switch is on', () => {
    expect(decideDelivery(msg('offers', 'email'), ctx({ prefs: marketingOn }))).toEqual({ outcome: 'skipped', reason: 'noConsent' })
    expect(decideDelivery(msg('offers', 'sms'), ctx({ prefs: marketingOn, consents: { ...NO_CONSENTS, marketingEmail: true } }))).toEqual({ outcome: 'skipped', reason: 'noConsent' })
    expect(decideDelivery(msg('offers', 'email'), ctx({ prefs: marketingOn, consents: optedIn })).outcome).toBe('sent')
  })
  it('stops marketing at the weekly cap but never other categories', () => {
    const full = { dismissed: {}, sent: [999_000, 999_500] }
    expect(decideDelivery(msg('offers'), ctx({ prefs: marketingOn, consents: optedIn, offers: full }))).toEqual({ outcome: 'skipped', reason: 'weeklyCap' })
    expect(decideDelivery(msg('payments'), ctx({ offers: full })).outcome).toBe('sent')
  })
})

describe('deliver', () => {
  it('counts only sent marketing against the cap, then refuses the third in a week', () => {
    let outbox: ReturnType<typeof deliver>['outbox'] = []
    let offers = EMPTY_OFFER_STATE
    const c = (n: number) => ctx({ prefs: marketingOn, consents: optedIn, offers, nowMs: 1_000_000 + n })
    for (let i = 0; i < 3; i++) {
      const r = deliver(outbox, offers, msg('offers', 'email', `o${i}`), c(i))
      outbox = r.outbox
      offers = r.offers
    }
    expect(outbox.map((e) => e.outcome)).toEqual(['sent', 'sent', 'skipped'])
    expect(offers.sent).toHaveLength(2)
    const pay = deliver(outbox, offers, msg('payments'), c(5))
    expect(pay.offers.sent).toHaveLength(2)
  })
  it('keeps the newest entries only', () => {
    let outbox: ReturnType<typeof deliver>['outbox'] = []
    for (let i = 0; i < MAX_OUTBOX + 5; i++) outbox = deliver(outbox, EMPTY_OFFER_STATE, msg('payments', 'email', `p${i}`), ctx()).outbox
    expect(outbox).toHaveLength(MAX_OUTBOX)
    expect(outbox.at(-1)!.message.id).toBe(`p${MAX_OUTBOX + 4}`)
  })
})

describe('releaseHeld', () => {
  it('sends held messages once quiet hours end', () => {
    const quiet = prefs((p) => { p.quiet = { on: true, from: '22:00', to: '07:00' } })
    const held = deliver([], EMPTY_OFFER_STATE, msg('payments'), ctx({ prefs: quiet, timeOfDay: '23:00' })).outbox
    expect(releaseHeld(held, quiet, '23:30', 5)[0].outcome).toBe('held')
    expect(releaseHeld(held, quiet, '08:00', 5)[0]).toMatchObject({ outcome: 'sent', at: 5 })
  })
})
