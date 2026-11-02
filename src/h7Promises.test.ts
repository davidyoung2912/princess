import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { en } from './i18n/locales/en'

const read = (f: string): string => readFileSync(f, 'utf8')

/** The promises of the first backlog phase (S2-01, S2-05, S6-07, XA-04), checked in the source and the text so a later edit cannot quietly break them. */
describe('Phase H7 promises', () => {
  it('only calculates in What happens if: no booking, cancel or payment call', () => {
    expect(read('src/ui/plan/WhatIfScreen.tsx')).not.toMatch(/api\.(booking|trip|book)\b|\.cancel\(|\.payBalance\(|\.change\(/)
    expect(read('src/domain/whatIf.ts')).not.toMatch(/from '\.\.\/api|runtime/)
    expect(en['whatif.intro']).toMatch(/Nothing here cancels or changes your booking/)
    expect(en['whatif.concept']).toMatch(/not Princess’s real terms/)
  })

  it('keeps the sky guide honest about being worked out, and never names a planet', () => {
    expect(en['sky.sim']).toMatch(/can be a few minutes out/)
    expect(en['sky.sim']).toMatch(/Planets are not shown/)
    expect(read('src/domain/sky.ts')).not.toMatch(/'(Venus|Mars|Jupiter|Saturn)/)
  })

  it('makes the briefing only when it is opened: no timer, no effect, no notification', () => {
    const text = read('src/ui/home/BriefingScreen.tsx') + read('src/domain/briefing.ts')
    expect(text).not.toMatch(/useEffect|useLayoutEffect|setInterval|setTimeout|Notification|serviceWorker/)
    expect(en['brief.intro']).toMatch(/never sent to you/)
  })

  it('reads aloud only from a button, and stops from the same button', () => {
    const text = read('src/ui/home/BriefingScreen.tsx')
    expect(text.match(/synth\.speak\(/g)).toHaveLength(1)
    expect(text).toMatch(/synth\.cancel\(\)/)
  })

  it('compares passport names on the device only: no save, no send, no scan', () => {
    const text = read('src/ui/account/PapersCheck.tsx') + read('src/domain/papersCheck.ts')
    expect(text).not.toMatch(/api\.|fetch\(|localStorage|sessionStorage|FileReader|<input[^>]*type="file"/)
    expect(en['papers.intro']).toMatch(/Nothing is scanned or sent/)
  })

  it('keeps the storm watch calm, worked out, and without an alert', () => {
    const text = read('src/ui/plan/StormScreen.tsx') + read('src/domain/storm.ts')
    expect(text).not.toMatch(/Notification|setInterval|setTimeout|useEffect|role="alert"|kind="danger"/)
    expect(en['storm.sim']).toMatch(/not a forecast/)
    expect(en['storm.intro']).toMatch(/not an alert/)
  })

  it('keeps the away-from-home list on the device: no server call, no reminder, nothing scheduled', () => {
    const text = read('src/ui/plan/AwayScreen.tsx') + read('src/domain/awayHome.ts')
    expect(text).not.toMatch(/api\.|fetch\(|Notification|setInterval|setTimeout|useEffect/)
    expect(en['away.intro']).toMatch(/stays on this device/)
    expect(en['away.note']).toMatch(/not advice about your home or insurance/)
  })

  it('keeps the medical card on the device: no server call, nothing sent to the ship', () => {
    const text = read('src/ui/plan/MedicalScreen.tsx') + read('src/domain/medicalCard.ts')
    expect(text).not.toMatch(/api\.|fetch\(|Notification|setInterval|setTimeout|useEffect/)
    expect(en['medical.intro']).toMatch(/nothing is sent to the ship or the cruise line/)
    expect(en['medical.foot']).toMatch(/Not checked by a doctor/)
  })

  it('shows every summary beside its original, made by rules, only when asked', () => {
    const text = read('src/ui/home/SummaryScreen.tsx') + read('src/domain/plainSummary.ts')
    expect(text).not.toMatch(/api\.(support|messages|service)|fetch\(|Notification|setInterval|setTimeout|useEffect/)
    expect(read('src/ui/home/SummaryScreen.tsx')).toMatch(/sum\.original/)
    expect(read('src/ui/home/SummaryScreen.tsx').match(/synth\.speak\(/g)).toHaveLength(1)
    expect(en['sum.made']).toMatch(/Nothing is reworded or added/)
    expect(en['sum.intro']).toMatch(/Nothing is sent or saved/)
  })

  it('sends a handoff only from a button, shows the whole message first, and sends nothing for an emergency', () => {
    const text = read('src/ui/ai/HandoffCard.tsx')
    expect(text).not.toMatch(/useEffect|setTimeout|setInterval/)
    expect(text.match(/send\.run\(/g)).toHaveLength(1)
    expect(text).toMatch(/handoff\.preview/)
    expect(en['handoff.body']).toMatch(/Nothing goes until you press the button/)
    expect(en['handoff.emergency']).toMatch(/Nothing is sent from here/)
  })
})
