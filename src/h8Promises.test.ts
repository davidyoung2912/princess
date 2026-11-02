import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
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
