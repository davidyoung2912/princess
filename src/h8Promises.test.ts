import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS } from './domain/autopilot'
import { dndNow, splitHeld } from './domain/aboardMore'
import { OFFERS, offersFor, offerModeOf, type OfferContext } from './domain/offers'
import { giftsFor, homeNudges, parseExcursionRequest } from './domain/finishMore'
import { cabinsFor, hasAccessibleCabins } from './domain/cabins'
import { assistantMobility, needsStepFree, EMPTY_ACCESS, accessNotes } from './domain/bookingPrep'
import { applyWeek, normalizePlanning, SAFEST, tasteInferences, withoutSurprises } from './domain/planning'
import { itinerary, REFERENCE_SAILING, sailingNights } from './domain/sailings'
import { styleFor, STYLES } from './domain/prepMore'
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
  it('the privacy default is on every group screen that shows plans or spending, and is the safest by default', () => {
    expect(SAFEST).toEqual({ plans: false, spending: false, photos: false, medical: false })
    for (const f of ['src/ui/party/PartyScreen.tsx', 'src/ui/plan/PrepScreens.tsx']) expect(read(f)).toMatch(/<SharingNote field=/)
    expect(read('src/ui/plan/PlanningScreens.tsx')).toMatch(/<SharingNote field="plans"/)
    expect(read('src/ui/SharingNote.tsx')).not.toMatch(/medical'?\)/)
  })
  it('the excursion catalogue flags what could be hard for the profile and can hide those tours', () => {
    const src = read('src/ui/plan/ExcursionsScreen.tsx')
    expect(src).toMatch(/difficultyConcerns\(x, mem\.access\)\.length === 0/)
    expect(src).toMatch(/concerns=\{difficultyConcerns\(o\.item, mem\.access\)\}/)
    expect(en['exc.concerns']).toMatch(/profile/)
  })
  it('room types say whether they have accessible staterooms, and the cabin list starts step-free for those who need it', () => {
    expect(hasAccessibleCabins('balcony')).toBe(true)
    expect(hasAccessibleCabins('signatureSuite')).toBe(false)
    expect(needsStepFree(EMPTY_ACCESS)).toBe(false)
    expect(needsStepFree({ ...EMPTY_ACCESS, device: 'cane' })).toBe(true)
    expect(cabinsFor('x', 'sanctuaryMiniSuite').some((c) => c.accessible)).toBe(false)
    expect(cabinsFor('x', 'balcony').some((c) => c.accessible)).toBe(true)
    expect(read('src/ui/book/RoomStep.tsx')).toMatch(/useState\(stepFreeNeeded\)/)
  })
  it('carbon uses the sailing length, and the money plan is kept and can become the trip budget', () => {
    expect(sailingNights(REFERENCE_SAILING)).toBe(itinerary(REFERENCE_SAILING).length - 1)
    expect(read('src/ui/plan/PrepMoreScreens.tsx')).toMatch(/carbonRange\(nights,/)
    expect(normalizePlanning({ moneyDaily: { sea: 5000, port: 8000 } }).moneyDaily).toEqual({ sea: 5000, port: 8000 })
    expect(normalizePlanning({ moneyDaily: { sea: -1, port: 'x' } }).moneyDaily).toBeNull()
    expect(read('src/ui/plan/PrepMoreScreens.tsx')).toMatch(/budget: plan\.total/)
  })
  it('the cabin route offers the booked cabin and the Home continue card names the step', () => {
    expect(read('src/ui/onboard/AboardMoreScreens.tsx')).toMatch(/api\.booking\.get\(tripNo\)/)
    expect(read('src/ui/home/PrepCards.tsx')).toMatch(/continue\.at/)
    expect(en['continue.at']).toMatch(/as far as/)
  })
  it('kept pasted lines show on their own day, day stories start from the persona, and the kids report reads club check-in', () => {
    expect(read('src/ui/PastedLines.tsx')).toMatch(/l\.day === day/)
    expect(read('src/ui/home/BriefingScreen.tsx') + read('src/ui/plan/AutopilotScreen.tsx')).toMatch(/<PastedLines day=\{day\}/)
    expect(en['paste.todayNote']).toMatch(/not bookings/)
    expect(styleFor('ethan')).toBe('active')
    expect(styleFor('maya')).toBe('family')
    expect(styleFor('nobody')).toBe('relaxed')
    expect(STYLES).toContain(styleFor('alexander'))
    expect(read('src/ui/onboard/AboardMoreScreens.tsx')).toMatch(/api\.family\.view\(\)/)
  })
  it('the assistant adds a named excursion to the cart only after a confirm tap, and never guesses', () => {
    expect(parseExcursionRequest('add the San Gervasio ruins to my cart')?.id).toBe('coz-ruins')
    expect(parseExcursionRequest('add the reef snorkel to my cart')).toBeNull() // two tours match: ask, do not guess
    expect(parseExcursionRequest('please add an excursion')).toBeNull()
    expect(parseExcursionRequest('what is the reef snorkel like')).toBeNull()
    const ask = read('src/ui/home/AskScreen.tsx')
    expect(ask).toMatch(/onClick=\{\(\) => void confirmExcursion\(\)\}/)
    expect(ask).not.toMatch(/excursions\.(checkout|pay)/)
    expect(en['ask.excNote']).toMatch(/Nothing is booked or charged/)
  })
  it('a higher storm chance shows a Home card aboard that points to route changes, but never after the cruise', () => {
    const base = { budget: 3 as const, quiet: false, backAboardMin: null, storm: 'higher' as const, proposals: 0, briefing: false }
    expect(homeNudges({ ...base, stormPhase: 'sailing' }).map((n) => n.id)).toEqual(['stormAboard'])
    expect(homeNudges({ ...base, stormPhase: 'sailing' })[0].path).toBe('/home/disruption')
    expect(homeNudges({ ...base, stormPhase: 'sailing', quiet: true })).toEqual([])
  })
})
