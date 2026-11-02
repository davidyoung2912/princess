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
