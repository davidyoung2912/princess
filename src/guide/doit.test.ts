import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GUIDE_DO_IT } from '../api/guideTypes'
import { en } from '../i18n/locales/en'

const server = (p: string) => readFileSync(new URL(`../../server/Princess.Api/${p}`, import.meta.url), 'utf8')

/** G8, "Do it for me": what Stanley may fill in for a guest is closed, small and read here from the server's own rules. */
describe('Do it for me: check-in', () => {
  const rules = server('Domain/CheckinRules.cs')
  const plan = rules.slice(rules.indexOf('PrefillPlan('))
  const steps = [...plan.matchAll(/new PrefillItem\("(\w+)"/g)].map((m) => m[1])

  it('fills in only the confirmation and the emergency contact', () => {
    expect([...new Set(steps)].sort()).toEqual(['confirm', 'emergency'])
  })

  it('checks the emergency contact the way typing one is checked, and never the passport, photo, contract, health or card', () => {
    expect(plan).toContain('ValidateEmergency(')
    for (const never of ['"document"', '"photo"', '"contract"', '"health"', '"payment"', '"arrival"']) expect(plan).not.toContain(never)
  })

  it('saves through the same service path as the screen, never the store directly, and never submits', () => {
    const svc = server('Services/CheckinService.cs')
    const apply = svc.slice(svc.indexOf('PrefillApplyAsync('), svc.indexOf('PrefillUndoAsync('))
    expect(apply).toContain('SaveAsync(')
    expect(apply).not.toMatch(/SubmitAsync|FinishAsync|store\./)
  })

  it('is only offered once check-in is open, for a booking that is not an agent\'s', () => {
    expect(server('Domain/GuideRules.cs')).toMatch(/DoIt: state == "open" && t is \{ Agent: false, CanPrefill: true \}/)
  })

  it('is a confirmed action with an undo, and the client knows it', () => {
    const kinds = server('Domain/StanleyActions.cs')
    expect(kinds).toContain('CheckinPrefill = "checkin_prefill"')
    expect(kinds).not.toMatch(/OnDevice = \[[^\]]*CheckinPrefill/)
    expect(GUIDE_DO_IT).toEqual(['checkin_prefill', 'customs_draft'])
    for (const k of ['guide.doIt', 'guide.doIt.aria', 'guide.doIt.failed', 'action.go.checkin', 'action.reason.nothing']) expect(k in en, k).toBe(true)
  })
})

describe('Do it for me: customs draft', () => {
  const rules = server('Domain/DisembarkRules.cs')
  const draft = rules.slice(rules.indexOf('CustomsDraftFrom('), rules.indexOf('// ---- Onward travel'))
  const svc = server('Services/DisembarkService.cs')

  it('drafts from shop purchases only, leaves food and cash to the guest, and never files', () => {
    expect(draft).toContain('l.Category == "shops"')
    for (const other of ['"drinks"', '"spa"', '"photos"', '"tips"']) expect(draft).not.toContain(other)
    expect(draft).toContain('new CustomsDeclaration(false, false,')
    expect(draft).toContain('l.State != FolioStates.Refunded')
  })

  it('saves through the screen\'s own save, only for an adult guest aboard with nothing saved yet', () => {
    const plan = svc.slice(svc.indexOf('CustomsDraftPlanAsync('), svc.indexOf('CustomsDraftApplyAsync('))
    expect(plan).toContain('Shipboard.IsAboard(c)')
    expect(plan).toContain('IsSupervised')
    expect(plan).toContain('GetCustomsAsync(')
    const apply = svc.slice(svc.indexOf('CustomsDraftApplyAsync('), svc.indexOf('CustomsDraftUndoAsync('))
    expect(apply).toContain('SaveCustomsAsync(')
    expect(apply).not.toMatch(/store\./)
  })

  it('undoes only a draft the guest has not changed', () => {
    const undo = svc.slice(svc.indexOf('CustomsDraftUndoAsync('), svc.indexOf('// ---- Onward travel'))
    expect(undo).toContain('Conflict("changed")')
    expect(undo).toContain('DeleteCustomsAsync(')
  })

  it('is a confirmed server action offered on the customs task only when there is something to draft', () => {
    expect(server('Domain/StanleyActions.cs')).toContain('CustomsDraft = "customs_draft"')
    expect(server('Domain/StanleyActions.cs')).not.toMatch(/OnDevice = \[[^\]]*CustomsDraft/)
    expect(server('Domain/GuideRules.cs')).toMatch(/"disembark\.customs"[^\n]*Agent: false, CanDraftCustoms: true/)
    expect('action.go.customs' in en).toBe(true)
  })
})
