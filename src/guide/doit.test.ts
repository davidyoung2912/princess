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
    expect(GUIDE_DO_IT).toEqual(['checkin_prefill', 'customs_draft', 'excursion_plan', 'reserve_dinner'])
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

describe('Do it for me: excursion plan', () => {
  const rules = server('Domain/ExcursionRules.cs')
  const pick = rules.slice(rules.indexOf('RankForToday('), rules.indexOf('public static TourRefund Refund('))
  const plan = server('Services/PlanService.cs')
  const effects = server('Services/StanleyActions.cs')

  it('picks only a tour that runs today, fits all aboard and has a place, and never stacks a second tour on a planned day', () => {
    expect(pick).toContain('o.DaysToTour == 0')
    expect(pick).toContain('o.Timing is null')
    expect(pick).toContain('o.Spots >= 1')
    expect(pick).toContain('heldIds.Contains(o.Item.Id))) return []')
    expect(pick).toContain('BudgetCents')
  })

  it('offers the plan only to an adult guest who can book, and never books or charges', () => {
    const fn = plan.slice(plan.indexOf('ExcursionPlanAsync('), plan.indexOf('private async Task CheckTourAsync('))
    expect(fn).toContain('view.CanBook')
    expect(fn).not.toMatch(/CheckoutAsync|ChargeAsync/)
  })

  it('puts the tour in the cart for the guest alone, through the cart service, and undoes it by removing it', () => {
    const apply = effects.slice(effects.indexOf('case StanleyActionKinds.ExcursionPlan:\n            {\n                var scope'))
    expect(apply.slice(0, 1000)).toContain('AddToCartAsync(')
    expect(apply.slice(0, 1000)).toContain('WhoFor(user, booking, scope, "me")')
    expect(apply.slice(0, 1000)).toContain('Conflict("nothing")')
    expect(effects).toMatch(/case StanleyActionKinds\.AddExcursion:\s*case StanleyActionKinds\.ExcursionPlan:\s*await planService\.RemoveFromCartAsync/)
    expect(effects).not.toMatch(/ExcursionPlan:[^]{0,2500}CheckoutAsync/)
  })

  it('is a confirmed server action offered on the port excursion task only when there is something to plan', () => {
    expect(server('Domain/StanleyActions.cs')).toContain('ExcursionPlan = "excursion_plan"')
    expect(server('Domain/StanleyActions.cs')).not.toMatch(/OnDevice = \[[^\]]*ExcursionPlan/)
    expect(server('Domain/GuideRules.cs')).toMatch(/"port\.excursion"[^\n]*Agent: false, CanPlanExcursion: true/)
    expect('action.go.excursions' in en).toBe(true)
  })

  it('offers a tour for a port day still to come in Prebook, never two on one day, through the same action', () => {
    const rules = server('Domain/ExcursionRules.cs')
    const ahead = rules.slice(rules.indexOf('List<Excursion> RankAhead('), rules.indexOf('PickForToday'))
    expect(ahead).toContain('o.DaysToTour >= 0')
    expect(ahead).toContain('busyDays')
    expect(ahead).toContain('o.Timing is null')
    expect(ahead).toContain('o.Spots >= 1')
    expect(server('Domain/GuideRules.cs')).toMatch(/"prebook\.tours"[^\n]*Agent: false, CanPlanTours: true[^\n]*"excursion_plan"/)
    expect(server('Domain/StanleyActions.cs')).toContain('args["ahead"] = "1"')
    expect(effects).toContain('intent.Arg("ahead") == "1"')
  })

  describe('tonight\'s dinner (reserve_dinner on sea.dinner)', () => {
    it('is offered on the sea dinner task only when the server found a table for tonight, never for an agent booking', () => {
      expect(server('Domain/GuideRules.cs')).toMatch(/"sea\.dinner"[^\n]*Agent: false, CanBookDinner: true[^\n]*"reserve_dinner"/)
      const guideService = server('Services/GuideService.cs')
      expect(guideService).toContain('DinnerTonightAsync(')
      expect(guideService).toMatch(/view\.Kind == "linked" \|\| stage != StageRules\.Sea/)
    })
    it('picks the free time nearest the usual dinner time, books through the dining service, and undoes by cancelling the table', () => {
      const plan = server('Services/PlanService.cs')
      const pick = plan.slice(plan.indexOf('DinnerTonightAsync('))
      expect(pick.slice(0, 2500)).toContain('DiningRules.PickNearest(')
      expect(pick.slice(0, 2500)).toContain('TableClash(')
      expect(pick.slice(0, 2500)).toContain('CountTablesAsync(')
      expect(pick.slice(0, 2500)).toContain('view.Plan != "anytime"')
      const effects = server('Services/StanleyActions.cs')
      expect(effects).toContain('ReserveAsync(')
      expect(effects).toMatch(/case StanleyActionKinds\.ReserveDinner:\s*await planService\.CancelTableAsync/)
      expect(effects).not.toMatch(/tonight[^]{0,600}CheckoutAsync/)
    })
    it('the server resolves the night and time, so the stored preview carries them for confirm and undo', () => {
      expect(server('Services/StanleyActions.cs')).toContain('["time"] = time, ["guests"]')
      expect(server('Domain/StanleyActions.cs')).toContain('S("tonight") == "1"')
    })
  })
})
