import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { en } from './i18n/locales/en'

const read = (f: string): string => readFileSync(f, 'utf8')

/** The promises of Phase H5 (S6-02, S4-02, XA-02, XI-05), checked in the source and the text so a later edit cannot quietly break them. */
describe('Phase H5 promises', () => {
  it('never changes the plan, books or accepts anything from an effect: only from a handler the guest triggers', () => {
    for (const f of ['src/ui/plan/AutopilotScreen.tsx', 'src/ui/plan/SlotWatch.tsx', 'src/ui/home/AskScreen.tsx', 'src/ui/ai/StanleyActionCard.tsx', 'src/hooks/useDayPlan.ts']) {
      expect(read(f), f).not.toMatch(/useEffect|useLayoutEffect|setInterval|setTimeout/)
    }
  })

  it('books a watched place only after the confirm-before-charge check', () => {
    const text = read('src/ui/plan/SlotWatch.tsx')
    expect(text).toMatch(/sure\.ask\(w\.priceCents/)
    expect(text.match(/bookWatch\(/g)).toHaveLength(1)
  })

  it('says in plain words that suggestions need the guest to accept, and that watching does not book', () => {
    expect(en['autopilot.promise']).toMatch(/only suggests/i)
    expect(en['autopilot.promise']).toMatch(/until you accept/i)
    expect(en['watch.promise']).toMatch(/never book for you/i)
    expect(en['ask.promise']).toMatch(/only after you confirm/i)
  })

  it('shows the age and the estimate on every Ship Pulse reading', () => {
    const text = read('src/ui/onboard/PulseScreen.tsx')
    expect(text.match(/pulse\.age/g)?.length).toBeGreaterThanOrEqual(2)
    expect(text.match(/pulse\.sim/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('does not blame the guest for a delay or a conflict', () => {
    for (const k of ['autopilot.refused.conflict', 'autopilot.refused.closed', 'watch.err.time', 'action.changed'] as const) expect(en[k], k).not.toMatch(/\byou (failed|forgot|should have|must have|were too)\b|\byour fault\b/i)
  })

  it('keeps the caregiver view to consent and never offers a location', () => {
    expect(en['calm.caregiver.consent']).toMatch(/I agree/)
    expect(read('src/domain/calm.ts')).toMatch(/CAREGIVER_NEVER[^\n]*where the guest is/)
  })
})
