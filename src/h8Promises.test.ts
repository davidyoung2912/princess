import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS } from './domain/autopilot'
import { dndNow, splitHeld } from './domain/aboardMore'
import { OFFERS, offersFor, offerModeOf, type OfferContext } from './domain/offers'
import { giftsFor, homeNudges } from './domain/finishMore'
import { assistantMobility, EMPTY_ACCESS, accessNotes } from './domain/bookingPrep'
import { scriptedReply } from './ai/scripted'
import { applyWeek, normalizePlanning, SAFEST, tasteInferences, withoutSurprises } from './domain/planning'
import { REFERENCE_SAILING } from './domain/sailings'
import { en } from './i18n/en'

const read = (f: string): string => readFileSync(f, 'utf8')

/** Promises of H8 slice A (booking and preparation), checked in the source and the text so a later edit cannot quietly break them. */
describe('H8 slice A promises', () => {
  it('keeps booking help on the device: no booking, charge or send call, and no timers beyond the shared clock', () => {
    const text = read('src/ui/plan/PrepScreens.tsx') + read('src/domain/bookingPrep.ts')
    expect(text).not.toMatch(/\.(book|cancel|payBalance|change|email|callback)\(|fetch\(|Notification|setInterval|setTimeout/)
    expect(en['hold.intro']).toMatch(/nothing is held with the cruise line, and nothing is charged/)
    expect(en['shares.intro']).toMatch(/no payment links are made and nothing is collected/)
    expect(en['allergy.sim']).toMatch(/Simulated status/)
    expect(en['pwatch.sim']).toMatch(/not a live fare/)
  })

  it('shows the hold countdown on its own screen only', () => {
    const files = ['src/ui/plan/PrepScreens.tsx', 'src/ui/home/HomeScreen.tsx', 'src/ui/plan/PlanScreen.tsx']
    expect(read(files[0])).toMatch(/leftInWords/)
    expect(read(files[1]) + read(files[2])).not.toMatch(/holdState|leftInWords/)
    expect(en['hold.note']).toMatch(/no countdown anywhere else/)
  })
})
describe('H8 slice A part 2 promises', () => {
  it('keeps pasted plans, the money plan and the story on the device with no booking call', () => {
    const text = read('src/ui/plan/PrepMoreScreens.tsx') + read('src/domain/prepMore.ts')
    expect(text).not.toMatch(/\.(book|cancel|payBalance|email|callback|save)\(|fetch\(|Notification|setInterval|setTimeout/)
    expect(en['paste.intro']).toMatch(/nothing is kept until you tick/)
    expect(en['paste.note']).toMatch(/nothing is booked/)
    expect(en['mplan.note']).toMatch(/not your onboard account/)
  })
  it('makes the weekly companion a budgeted nudge with a one-tap off', () => {
    const card = read('src/ui/home/PrepCards.tsx')
    expect(card).toMatch(/nudgesPerDay === 0/)
    expect(card).toMatch(/companionOff: true/)
    expect(en['carbon.method']).toMatch(/not a measurement/)
    expect(en['guar.sim']).toMatch(/not figures from a real cruise line/)
  })
})

describe('H8 slice B promises', () => {
  it('runs groups on one device and says so, with nothing sent', () => {
    const text = read('src/ui/plan/PlanningScreens.tsx') + read('src/domain/planning.ts')
    expect(text).not.toMatch(/\.(book|cancel|payBalance|email|callback|save)\(|fetch\(|Notification|setInterval|setTimeout/)
    expect(en['poll.single']).toMatch(/one phone only/)
    expect(en['poll.single']).toMatch(/Nothing is sent/)
    expect(en['brief.note']).toMatch(/show this screen/i)
  })
  it('keeps surprises and medical details out of anything shared', () => {
    expect(withoutSurprises([{ id: 'a', title: 'Secret cake' }], [{ id: 'z', text: 'secret cake' }])).toEqual([])
    expect(normalizePlanning({ privacy: { medical: true } }).privacy.medical).toBe(false)
    expect(SAFEST).toEqual({ plans: false, spending: false, photos: false, medical: false })
  })
  it('lets the guest remove every guess or switch them all off', () => {
    const input = { fit: ['kids' as const], pasted: [], pace: 'packed' as const, rhythm: null }
    expect(tasteInferences(input, true, [])).toEqual([])
    expect(tasteInferences(input, false, tasteInferences(input, false, []).map((i) => i.id))).toEqual([])
  })
  it('applies a week only through accepted, undoable changes', () => {
    const r = applyWeek(REFERENCE_SAILING, { ...DEFAULT_PREFS, pace: 'relaxed' }, [], 5)
    expect(r.changes.every((c) => c.status === 'accepted' && c.undoUntil > 5)).toBe(true)
  })
})

describe('H8 slice C promises', () => {
  it('sends nothing: reminders and checks live on the screen, with no timers or network', () => {
    const text = read('src/ui/onboard/AboardMoreScreens.tsx') + read('src/domain/aboardMore.ts')
    expect(text).not.toMatch(/\.(book|cancel|payBalance|email|callback|save)\(|fetch\(|Notification|setInterval|setTimeout|sendBeacon/)
    expect(en['ok.nothingSent']).toMatch(/Nothing is sent to anyone/)
    expect(en['solo.nothingSent']).toMatch(/Nothing is sent to anyone/)
    expect(en['teen.nothingSent']).toMatch(/Nothing is sent to anyone/)
  })
  it('labels simulated boards and lists as simulated', () => {
    expect(en['lounge.sim']).toMatch(/simulated/i)
    expect(en['kreport.sim']).toMatch(/simulated/i)
    expect(en['lost.sim']).toMatch(/example/i)
    expect(en['sight.sim']).toMatch(/simulated/i)
  })
  it('keeps critical notices through do not disturb and puts the report behind parent consent', () => {
    expect(dndNow([{ id: 'a', from: '00:00', to: '23:59', on: true }], '12:00', 'critical')).toBe(false)
    expect(read('src/ui/onboard/AboardMoreScreens.tsx')).toMatch(/!a\.kidsConsent \? <Nothing/)
    expect(en['dnd.critical']).toMatch(/always come through/)
  })
})

describe('H8 slice D promises', () => {
  it('sends nothing: notes and lists live on the screen, with no timers or network', () => {
    const text = (read('src/ui/onboard/FinishMoreScreens.tsx') + read('src/domain/finishMore.ts')).replace(/synth\.cancel\(\)/g, '')
    expect(text).not.toMatch(/\.(book|cancel|payBalance|email|callback|save)\(|fetch\(|Notification|setInterval|setTimeout|sendBeacon/)
    expect(en['follow.nothingSent']).toMatch(/Nothing is sent to anyone/)
    expect(en['sweep.note']).toMatch(/Nothing is sent to anyone/)
    expect(en['bags.note']).toMatch(/Nothing is sent to anyone/)
    expect(en['ride.note']).toMatch(/does not collect money/)
  })
  it('labels simulated and authored content as such', () => {
    expect(en['chain.sim']).toMatch(/Simulated/)
    expect(en['fare.sim']).toMatch(/not a live fare/)
    expect(en['ashore.verify']).toMatch(/official travel advice/)
  })
  it('never guesses and keeps gifts away from task screens', () => {
    expect(en['askShip.unknown']).toMatch(/do not have an answer/)
    expect(read('src/ui/home/HomeScreen.tsx') + read('src/ui/finish/DisembarkScreen.tsx')).not.toMatch(/giftsFor|GiftsScreen/)
  })
  it('keeps the budget and the safety exception on Home, and the confirm rule on voice and item requests', () => {
    expect(homeNudges({ budget: 0, quiet: true, backAboardMin: 30, storm: 'higher', stormPhase: 'near', proposals: 3, briefing: true }).map((n) => n.id)).toEqual(['backAboard'])
    const ask = read('src/ui/home/AskScreen.tsx')
    expect(ask).toMatch(/onClick=\{\(\) => void confirmItem\(\)\}/)
    expect(ask).not.toMatch(/r\.onresult[^\n]*(submit|confirm)/)
    expect(en['ask.speakNote']).toMatch(/nothing happens until you confirm/)
  })
})

describe('H8 wire-through promises', () => {
  const ctx: OfferContext = { stage: 'aboard', tier: 'none', package: 'none', dismissed: [] }
  it('low-stress shows no offers and gentle wording drops celebration offers', () => {
    expect(offerModeOf({ easy: true, gentle: true })).toBe('easy')
    expect(offersFor({ ...ctx, mode: 'easy' })).toEqual([])
    const gentle = offersFor({ ...ctx, mode: 'gentle' })
    expect(gentle.length).toBeGreaterThan(0)
    expect(gentle.every((o) => !o.celebration)).toBe(true)
    expect(offersFor(ctx).length).toBeGreaterThan(gentle.length)
    expect(OFFERS.some((o) => o.celebration)).toBe(true)
  })
  it('do not disturb holds back non-critical notices but loses none and never holds critical ones', () => {
    const list = [{ id: 'a', from: '22:00', to: '07:00', on: true }]
    const ns = [{ category: 'critical' }, { category: 'payments' }, { category: 'checkin' }] as const
    const night = splitHeld(ns, list, '23:00')
    expect(night.shown.map((n) => n.category)).toEqual(['critical'])
    expect(night.held).toHaveLength(2)
    expect(splitHeld(ns, list, '12:00').held).toEqual([])
    expect(splitHeld(ns, [], '23:00').held).toEqual([])
  })
  it('says so on screen', () => {
    expect(en['notices.heldBody']).toMatch(/not lost/)
    expect(en['offer.mode.gentle']).toMatch(/celebration/)
  })
  it('gentle wording drops celebration gifts', () => {
    expect(giftsFor(null, 'anniversary', [], false).some((g) => g.id === 'champagne')).toBe(true)
    expect(giftsFor(null, 'anniversary', [], false, true).some((g) => g.id === 'champagne')).toBe(false)
  })
  it('the accessibility profile sets the day planner default and asks something of each area', () => {
    expect(assistantMobility(EMPTY_ACCESS)).toBe('any')
    expect(assistantMobility({ ...EMPTY_ACCESS, device: 'scooter' })).toBe('wheelchair')
    expect(assistantMobility({ ...EMPTY_ACCESS, mobility: true })).toBe('easy')
    expect(accessNotes({ ...EMPTY_ACCESS, vision: true }).dining).toContain('readMenu')
  })
  it('the assistant shows what taste guesses it used', () => {
    const base = { sailingId: REFERENCE_SAILING.id, personaId: 'daniel', now: Date.UTC(2027, 0, 5, 12) }
    const r = scriptedReply('plan my day 2', { ...base, likes: ['You like a relaxed pace'] })
    expect(r.text).toMatch(/Based on what you told us: you like a relaxed pace/)
  })
  it('the privacy default is on every group screen that shows plans or spending, and is the safest by default', () => {
    expect(SAFEST).toEqual({ plans: false, spending: false, photos: false, medical: false })
    for (const f of ['src/ui/party/PartyScreen.tsx', 'src/ui/plan/PrepScreens.tsx']) expect(read(f)).toMatch(/<SharingNote field=/)
    expect(read('src/ui/plan/PlanningScreens.tsx')).toMatch(/<SharingNote field="plans"/)
    expect(read('src/ui/SharingNote.tsx')).not.toMatch(/medical'?\)/)
  })
})
