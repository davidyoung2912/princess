import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { en } from '../shared/i18n/locales/en'
import { EMPTY_MEMORY } from '../features/memory/logic/store'

const read = (f: string): string => readFileSync(f, 'utf8')
const SCREENS = ['src/features/discover/ui/CabinChooserScreen.tsx', 'src/features/discover/ui/DecideScreen.tsx', 'src/features/account/ui/WrappedScreen.tsx', 'src/features/account/ui/MemoryScreen.tsx']

/** The promises of Phase H6 (S1-02, S8-01, S8-05, S8-06, S0-05), checked in the source and the text so a later edit cannot quietly break them. */
describe('Phase H6 promises', () => {
  it('shares only from a button the guest presses: nothing on a timer or an effect', () => {
    for (const f of SCREENS) expect(read(f), f).not.toMatch(/useEffect|useLayoutEffect|setInterval|setTimeout/)
  })

  it('keeps drinks off the wrapped cards and anniversaries off until the guest asks', () => {
    expect(EMPTY_MEMORY.drinks).toBeNull()
    expect(EMPTY_MEMORY.anniversary).toBe(false)
    expect(en['wrapped.drinksBody']).toMatch(/left out unless you choose/i)
  })

  it('makes the next trip a draft that books and holds nothing', () => {
    expect(en['memory.nextNote']).toMatch(/Nothing is booked or held/)
    expect(read('src/features/account/ui/MemoryScreen.tsx')).not.toMatch(/api\.booking|api\.trip|\.hold\(|\.book\(/)
  })

  it('needs consent before anyone is added, and offers remove, block and report', () => {
    const text = read('src/features/account/ui/MemoryScreen.tsx')
    expect(en['memory.contactConsent']).toMatch(/agree/)
    expect(text).toMatch(/memory\.block/)
    expect(text).toMatch(/memory\.remove/)
    expect(text).toMatch(/memory\.report/)
  })

  it('says the cabin sample and the sun are estimates, and what a pretend reply is', () => {
    expect(en['cabins.sample']).toMatch(/sample/i)
    expect(en['cabins.sunSim']).toMatch(/Estimated/)
    expect(en['memory.contactsBody']).toMatch(/pretend/)
    expect(en['decide.inviteNoLink']).toMatch(/only text/)
  })

  it('does not pressure the guest', () => {
    for (const k of ['decide.intro', 'decide.budgetBody', 'memory.nextNote', 'wrapped.never'] as const) expect(en[k], k).not.toMatch(/\b(hurry|last chance|only \d+ left|don’t miss|act now)\b/i)
  })
})
