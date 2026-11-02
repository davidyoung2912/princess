import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS } from './domain/autopilot'
import { dndNow } from './domain/aboardMore'
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
