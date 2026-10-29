import { maskEmail } from '../domain/booking'
import { assignmentFor, passName } from '../domain/boarding'
import { BRAND_NAMES } from '../domain/account'
import {
  NIGHT_ITEMS, TIP_KEEP, blankCustoms, choiceProblem, customsProblem, customsSummary, disembarkTimes, gratuityCharged, groupFor, isNightItem, nightEntries, offAt, onwardCheck, onwardMode, onwardProblem, tagLabel, tipCredit,
  WALKOFF_IDS, type CustomsDeclaration, type OnwardPlan, type ReceiptId, type WalkOffId,
} from '../domain/disembark'
import { computeEntitlements } from '../domain/entitlements'
import type { FolioLine } from '../domain/folio'
import { partyOf, type PersonaId } from '../domain/personas'
import { FUTURE_DEPARTURES, quote, type Cents } from '../domain/pricing'
import {
  AREAS, BOOKING_CREDIT, CREW, DESK, FEEDBACK_EDIT_DAYS, LEVEL_CREDIT, REFERRAL_CREDIT, REFERRALS, caseProblem, caseNumber, caseStatus, caseWithdrawable, deskTimes, earliestRebook, fccBefore, feedbackProblem, holdDeposit, holdExpiry, loyaltyStatus, needsRecovery, referralCode, referralEarned,
  type CaseKind, type Feedback,
} from '../domain/postcruise'
import { stewardFor } from '../domain/room'
import { itinerary, SAILINGS, shipZoneOnDate, STAGE_IDS, stageAt, type Sailing } from '../domain/sailings'
import { categoryById, type CategoryId } from '../domain/ship'
import { addDays, zonedToEpoch } from '../domain/timezones'
import { bookingTotal, categoryOfStateroom, pastTrips } from '../domain/trip'
import { REDOWNLOAD_DAYS } from '../domain/photos'
import type { DemoState } from '../demo/state'
import type { BookingDeps } from './bookingMock'
import { ApiError } from './errors'
import type { PlanReads } from './planMock'
import { ABOARD_STAGES, cruiseDay } from './onboardMock'
import type {
  CasesApi, CasesView, CaseView, CustomsView, DisembarkApi, DisembarkView, FeedbackView, FinalBillView, HistoryTrip, HistoryView, HoldView, LoyaltyView, NightView, OnwardView, PostApi, RebookView,
} from './finishTypes'

export interface FinishDeps extends Pick<BookingDeps, 'store' | 'channel' | 'who' | 'actor' | 'adult' | 'now' | 'save' | 'newId' | 'run' | 'profileOf' | 'cardsOf'> {
  sailing: () => Sailing
  demo: () => DemoState
  reads: PlanReads
}

export interface FinishApi {
  disembark: DisembarkApi
  cases: CasesApi
  post: PostApi
  /** Credits these services have put on the account, for the folio. */
  folioLines: () => Promise<FolioLine[]>
}

interface StoredChoice { option: WalkOffId; bags: Record<string, number>; tagsOn: boolean; chosenAt: number }
interface StoredCase { kind: CaseKind; number: string; summary: string; place: string; lineId: string; cents: Cents; openedAt: number; withdrawnAt?: number; by: PersonaId; fromFeedback: boolean }
interface StoredFeedback extends Feedback { at: number; caseId?: string }
interface StoredHold { departure: string; category: CategoryId; guests: number; total: Cents; deposit: Cents; credit: Cents; fccApplied: Cents; onboard: boolean; placedAt: number }

const HOUR = 3_600_000
const HOME = 'America/New_York'
const MAX_OPEN_CASES = 10
const MAX_HOLDS = 3

export function createFinishApi(d: FinishDeps): FinishApi {
  const booker = () => d.actor().booker
  const party = () => partyOf(d.who())
  const stage = () => stageAt(d.sailing(), d.now())
  const stageIndex = () => STAGE_IDS.indexOf(stage())
  const aboard = () => (ABOARD_STAGES as readonly string[]).includes(stage())
  const sailed = () => stage() === 'disembark' || stage() === 'postCruise'
  const needAboard = () => { if (!aboard()) throw new ApiError('conflict', 'closed') }
  const needSailed = () => { if (!sailed()) throw new ApiError('conflict', 'closed') }
  const dayAt = (at: number) => Math.min(8, Math.max(1, cruiseDay(d.sailing(), at)))
  const rows = async <T>(kind: string, owner: string = booker()): Promise<{ id: string; at: number; data: T }[]> => (await d.store.list(kind, owner)).map((r) => ({ id: r.id, at: r.updatedAt, data: r.data as T }))
  const one = async <T>(kind: string, id: string, owner: string = booker()): Promise<T | null> => ((await d.store.get(kind, owner, id))?.data as T | undefined) ?? null
  const put = (kind: string, id: string, data: unknown, owner: string = booker()) => d.save(kind, owner, id, data)
  const drop = async (kind: string, id: string, owner: string = booker()) => { await d.store.delete(kind, owner, id); d.channel?.post({ type: 'records', kind, owner }) }

  const priority = async () => (await d.reads.entitlementsOf(booker())).entitlements.perks.includes('priorityDisembarkation')
  const group = async () => groupFor(`${booker()}|${d.sailing().id}`, await priority())
  const needsHelp = async () => (await d.profileOf(booker())).needs.some((n) => n === 'mobility' || n === 'hearing' || n === 'vision')
  const place = async () => assignmentFor(booker(), d.sailing().id, (await d.profileOf(booker())).needs.includes('mobility'))
  const choiceOf = () => one<StoredChoice>('disembarkChoice', 'choice')
  const customsOf = () => one<{ declaration: CustomsDeclaration; at: number }>('customs', 'declaration')
  const onwardOf = () => one<OnwardPlan>('onward', 'plan')
  const offTimes = async () => {
    const g = await group()
    const s = d.sailing()
    return { tagged: offAt(s, 'tagged', g), selfAssist: offAt(s, 'selfAssist', g), earlyWalkOff: offAt(s, 'earlyWalkOff', g) } satisfies Record<WalkOffId, number>
  }

  // ---- Disembarkation (DEB-01, DEB-02) ----
  const disembarkView = async (): Promise<DisembarkView> => {
    const s = d.sailing()
    const times = disembarkTimes(s)
    const choice = await choiceOf()
    const g = await group()
    const cabin = (await place()).number
    const guests = await Promise.all(party().map(async (p) => {
      const profile = await d.profileOf(p.id)
      const bags = choice?.bags[p.id] ?? 0
      const printed = passName(profile.firstName, profile.lastName)
      return { id: p.id, name: p.name, printed, bags, cabin, label: choice?.option === 'tagged' && bags > 0 ? tagLabel(g, printed, cabin) : null }
    }))
    const closed = d.now() >= times.bagsOutAt
    return {
      option: choice?.option ?? null, group: g, priority: await priority(), guests, tagsOn: choice?.tagsOn ?? false,
      times: { arrivalAt: times.arrivalAt, bagsOutAt: times.bagsOutAt, vacateAt: times.vacateAt, tipBy: times.tipBy },
      offAt: await offTimes(), canChoose: aboard() && !d.actor().child && !closed, closed, needsHelp: await needsHelp(),
      customsDone: !!(await customsOf()), onwardSaved: !!(await onwardOf()),
      photosUntil: zonedToEpoch(addDays(itinerary(s)[7].date, REDOWNLOAD_DAYS), '23:59', HOME),
    }
  }

  // ---- Customs (DEB-04) ----
  const customsView = async (): Promise<CustomsView> => {
    const stored = await customsOf()
    const people = party().length
    const summary = customsSummary(stored?.declaration ?? blankCustoms(), people)
    return { declaration: stored?.declaration ?? null, submittedAt: stored?.at ?? null, people, allowanceUsd: summary.allowanceUsd, declare: summary.declare, overUsd: summary.overUsd, canEdit: aboard() && !d.actor().child }
  }

  // ---- Onward travel (DEB-05) ----
  const onwardOffFrom = async (): Promise<number> => {
    const choice = await choiceOf()
    return (await offTimes())[choice?.option ?? 'tagged']
  }
  const onwardView = async (): Promise<OnwardView> => {
    const plan = await onwardOf()
    const offFrom = await onwardOffFrom()
    return { plan, check: plan ? onwardCheck(d.sailing(), plan, offFrom) : null, offFrom, people: party().length, canEdit: !d.actor().child }
  }

  // ---- The final night (DEB-07) ----
  const nightView = async (): Promise<NightView> => {
    const choice = await choiceOf()
    const ticks = (await one<{ ids: string[] }>('nightTicks', 'ticks'))?.ids ?? []
    return { option: choice?.option ?? null, entries: nightEntries({ sailing: d.sailing(), now: d.now(), option: choice?.option ?? null, customsDone: !!(await customsOf()), tagsOn: choice?.tagsOn ?? false, ticked: ticks }) }
  }

  // ---- Final bill (DEB-03) ----
  const gratuityGuests = async () =>
    Promise.all(party().map(async (p) => ({ suite: categoryById(categoryOfStateroom(p.stateroom))?.suite ?? false, included: (await d.reads.entitlementsOf(p.id)).entitlements.gratuitiesIncluded })))
  const tipOf = () => one<{ keep: number; at: number }>('tipKeep', 'tip')

  // ---- Cases (DEB-06, POS-07, POS-11) ----
  const statusOf = (c: StoredCase) => caseStatus({ kind: c.kind, number: c.number, openedAt: c.openedAt, cents: c.cents, withdrawnAt: c.withdrawnAt }, d.now())
  const caseViews = async (): Promise<CaseView[]> => {
    return (await rows<StoredCase>('case')).map((r) => {
      const c = r.data
      const status = statusOf(c)
      return { id: r.id, kind: c.kind, number: c.number, summary: c.summary, place: c.place, cents: c.cents, openedAt: c.openedAt, dueAt: status.dueAt, stage: status.stage, outcome: status.outcome, refund: status.refund, canWithdraw: caseWithdrawable(status), fromFeedback: c.fromFeedback }
    }).sort((a, b) => b.openedAt - a.openedAt || b.number.localeCompare(a.number))
  }
  const casesView = async (): Promise<CasesView> => ({ cases: await caseViews(), canOpen: stageIndex() >= STAGE_IDS.indexOf('embarkation') && !d.actor().child })
  const openCase = async (c: Omit<StoredCase, 'number' | 'openedAt' | 'by'>): Promise<string> => {
    const existing = await rows<StoredCase>('case')
    const id = d.newId('case')
    await put('case', id, { ...c, number: caseNumber(c.kind, booker(), existing.length), openedAt: d.now(), by: d.who() } satisfies StoredCase)
    return id
  }

  const cases: CasesApi = {
    list: () => d.run('cases.list', casesView),
    open: (input) => d.run('cases.open', async () => {
      d.adult()
      if (stageIndex() < STAGE_IDS.indexOf('embarkation')) throw new ApiError('conflict', 'closed')
      const problem = caseProblem(input)
      if (problem) throw new ApiError('invalid', problem)
      const open = (await rows<StoredCase>('case')).filter((r) => caseWithdrawable(statusOf(r.data)))
      if (open.length >= MAX_OPEN_CASES) throw new ApiError('conflict', 'tooManyCases')
      if (input.kind === 'billing' && open.some((r) => r.data.kind === 'billing' && r.data.lineId === input.lineId)) throw new ApiError('conflict', 'alreadyQueried')
      await openCase({ kind: input.kind, summary: input.summary.trim(), place: input.place.trim(), lineId: input.kind === 'billing' ? input.lineId : '', cents: input.kind === 'billing' || input.kind === 'claim' ? input.cents : 0, fromFeedback: false })
      return casesView()
    }),
    withdraw: (id) => d.run('cases.withdraw', async () => {
      d.adult()
      const c = await one<StoredCase>('case', id)
      if (!c) throw new ApiError('notFound')
      const view = (await caseViews()).find((v) => v.id === id)!
      if (!view.canWithdraw) throw new ApiError('conflict', 'tooLate')
      await put('case', id, { ...c, withdrawnAt: d.now() })
      return casesView()
    }),
  }

  const finalBill = async (): Promise<FinalBillView> => {
    const times = disembarkTimes(d.sailing())
    const charged = gratuityCharged(await gratuityGuests())
    const tip = await tipOf()
    const keep = tip?.keep ?? 100
    const cards = await d.cardsOf()
    const card = cards[0] ? `${BRAND_NAMES[cards[0].brand]} ending ${cards[0].last4}` : null
    const email = await one<{ at: number; to: string }>('receiptEmail', 'last')
    const open = stageIndex() >= STAGE_IDS.indexOf('farewell')
    const queries = (await rows<StoredCase>('case')).filter((r) => r.data.kind === 'billing').map((r) => {
      return { id: r.id, lineId: r.data.lineId, number: r.data.number, stage: statusOf(r.data).stage, cents: r.data.cents }
    })
    const receipts: { id: ReceiptId; available: boolean }[] = [{ id: 'folio', available: open }, { id: 'gratuities', available: open }, { id: 'fare', available: true }]
    return {
      card, tip: { charged, keepPercent: keep, credit: tipCredit(charged, keep), by: times.tipBy, canAdjust: aboard() && !d.actor().child && d.now() < times.tipBy && charged > 0 },
      receipts, emailedAt: email?.at ?? null, emailedTo: email?.to ?? null, queries,
      settled: open && !queries.some((q) => q.stage === 'received' || q.stage === 'inReview'),
    }
  }

  const disembark: DisembarkApi = {
    view: () => d.run('disembark.view', disembarkView),
    choose: (input) => d.run('disembark.choose', async () => {
      d.adult()
      needAboard()
      if (d.now() >= disembarkTimes(d.sailing()).bagsOutAt) throw new ApiError('conflict', 'deadline')
      if (!WALKOFF_IDS.includes(input?.option)) throw new ApiError('invalid', 'badOption')
      const guests = party().map((p) => p.id)
      if (Object.keys(input.bags ?? {}).some((id) => !guests.includes(id as PersonaId))) throw new ApiError('invalid', 'badBags')
      const bags: Record<string, number> = {}
      for (const id of guests) bags[id] = input.bags?.[id] ?? 0
      const problem = choiceProblem({ option: input.option, bags, guests })
      if (problem) throw new ApiError('invalid', problem)
      const before = await choiceOf()
      await put('disembarkChoice', 'choice', { option: input.option, bags, tagsOn: input.option === 'tagged' ? before?.tagsOn ?? false : false, chosenAt: d.now() } satisfies StoredChoice)
      return disembarkView()
    }),
    setTagsOn: (on) => d.run('disembark.setTagsOn', async () => {
      d.adult()
      needAboard()
      const choice = await choiceOf()
      if (choice?.option !== 'tagged') throw new ApiError('conflict', 'notTagged')
      await put('disembarkChoice', 'choice', { ...choice, tagsOn: !!on })
      return disembarkView()
    }),
    customs: () => d.run('disembark.customs', customsView),
    saveCustoms: (declaration) => d.run('disembark.saveCustoms', async () => {
      d.adult()
      needAboard()
      const problem = customsProblem(declaration)
      if (problem) throw new ApiError('invalid', problem)
      await put('customs', 'declaration', { declaration: { ...declaration, note: declaration.note.trim() }, at: d.now() })
      return customsView()
    }),
    onward: () => d.run('disembark.onward', onwardView),
    saveOnward: (plan) => d.run('disembark.saveOnward', async () => {
      d.adult()
      const problem = onwardProblem(plan)
      if (problem) throw new ApiError('invalid', problem)
      await put('onward', 'plan', { mode: onwardMode(plan.mode)!.id, flightAt: plan.flightAt, flight: plan.flight.trim().toUpperCase(), note: plan.note.trim() } satisfies OnwardPlan)
      return onwardView()
    }),
    night: () => d.run('disembark.night', nightView),
    tick: (id, done) => d.run('disembark.tick', async () => {
      d.adult()
      needAboard()
      if (!isNightItem(id)) throw new ApiError('invalid', 'badItem')
      if (NIGHT_ITEMS.find((i) => i.id === id)?.auto) throw new ApiError('invalid', 'automatic')
      const ids = new Set((await one<{ ids: string[] }>('nightTicks', 'ticks'))?.ids ?? [])
      if (done) ids.add(id); else ids.delete(id)
      await put('nightTicks', 'ticks', { ids: [...ids] })
      return nightView()
    }),
    finalBill: () => d.run('disembark.finalBill', finalBill),
    adjustTip: (keep) => d.run('disembark.adjustTip', async () => {
      d.adult()
      needAboard()
      if (!TIP_KEEP.includes(keep)) throw new ApiError('invalid', 'badTip')
      if (d.now() >= disembarkTimes(d.sailing()).tipBy) throw new ApiError('conflict', 'deadline')
      await put('tipKeep', 'tip', { keep, at: d.now() })
      return finalBill()
    }),
    emailReceipt: () => d.run('disembark.emailReceipt', async () => {
      d.adult()
      if (stageIndex() < STAGE_IDS.indexOf('farewell')) throw new ApiError('conflict', 'closed')
      const email = (await d.profileOf(d.who())).email
      if (!email) throw new ApiError('invalid', 'noEmail')
      await put('receiptEmail', 'last', { at: d.now(), to: maskEmail(email) })
      return finalBill()
    }),
  }

  // ---- After the cruise (POS-01 to POS-08, POS-11, POS-14) ----
  const editUntil = () => zonedToEpoch(addDays(itinerary(d.sailing())[7].date, FEEDBACK_EDIT_DAYS), '23:59', HOME)
  const feedbackView = async (): Promise<FeedbackView> => {
    const stored = await one<StoredFeedback>('feedback', 'cruise', d.who())
    let recovery: FeedbackView['recovery'] = null
    if (stored?.caseId) {
      const c = (await caseViews()).find((v) => v.id === stored.caseId)
      if (c) recovery = { number: c.number, dueAt: c.dueAt, stage: c.stage }
    }
    const { at, caseId: _caseId, ...feedback } = stored ?? ({} as StoredFeedback)
    return {
      open: sailed() && !d.actor().child && d.now() <= editUntil(), feedback: stored ? (feedback as Feedback) : null, submittedAt: stored ? at : null, editUntil: editUntil(),
      crew: CREW.map((c) => ({ id: c.id, name: c.name, role: c.role })), steward: stewardFor((await place()).number), recovery,
    }
  }

  const category = (): CategoryId => categoryOfStateroom(d.actor().stateroom)
  const guestCount = () => Math.min(4, party().length)
  const fccConverted = async () => (await rows<{ cents: Cents }>('fccConvert')).reduce((n, r) => n + r.data.cents, 0)
  const holdsOf = async () => (await rows<StoredHold>('hold')).sort((a, b) => a.data.placedAt - b.data.placedAt)
  const holdView = (r: { id: string; data: StoredHold }): HoldView => {
    const h = r.data
    const departure = FUTURE_DEPARTURES.find((f) => f.id === h.departure)?.departure ?? SAILINGS.find((x) => x.id === h.departure)?.departure ?? h.departure
    return { id: r.id, departure, category: h.category, guests: h.guests, total: h.total, deposit: h.deposit, credit: h.credit, fccApplied: h.fccApplied, onboard: h.onboard, placedAt: h.placedAt, expiresAt: holdExpiry(h.placedAt), expired: d.now() > holdExpiry(h.placedAt), bookable: SAILINGS.some((x) => x.id === h.departure) }
  }
  const optionsFor = (onboard: boolean) => {
    const guests = guestCount()
    const cat = category()
    const from = earliestRebook(itinerary(d.sailing())[7].date)
    const credit = onboard ? BOOKING_CREDIT + LEVEL_CREDIT[d.actor().tier] : 0
    const all = [...SAILINGS.map((x) => ({ id: x.id, departure: x.departure, bookable: true })), ...FUTURE_DEPARTURES.map((f) => ({ ...f, bookable: false }))]
    return all.filter((x) => x.departure >= from).flatMap((x) => {
      const q = quote(x.id, cat, guests)
      return q ? [{ id: x.id, departure: x.departure, bookable: x.bookable, total: q.total, deposit: holdDeposit(q.total, guests, onboard), credit }] : []
    })
  }
  const deskSlots = () => {
    const s = d.sailing()
    const days = itinerary(s)
    const out: { at: number; day: number }[] = []
    for (const n of DESK.days) {
      const date = days[n - 1].date
      for (const time of deskTimes()) {
        const at = zonedToEpoch(date, time, shipZoneOnDate(s, date))
        if (at - d.now() >= HOUR) out.push({ at, day: n })
      }
    }
    return out.slice(0, 12)
  }
  const rebookView = async (): Promise<RebookView> => {
    const holds = (await holdsOf()).map(holdView)
    const converted = await fccConverted()
    const applied = holds.filter((h) => !h.expired).reduce((n, h) => n + h.fccApplied, 0)
    const appt = await one<{ at: number }>('deskSlot', 'slot')
    const onboard = aboard()
    return {
      category: category(), guests: guestCount(), tier: d.actor().tier, onboardOffer: onboard, options: optionsFor(onboard), holds,
      fccLeft: Math.max(0, fccBefore(booker()) - converted - applied), fccConverted: converted, appointment: appt && appt.at + 30 * 60_000 > d.now() ? { at: appt.at } : null,
      slots: onboard ? deskSlots() : [], canHold: (onboard || sailed()) && !d.actor().child,
    }
  }

  const history = async (): Promise<HistoryView> => {
    const s = d.sailing()
    const done = sailed()
    const past: HistoryTrip[] = pastTrips(d.who()).map((p) => ({ id: p.id, title: p.title, ship: p.ship, departure: p.departure, nights: p.nights, current: false, cancelled: !!p.cancelled, fareCents: null, documents: p.cancelled ? [] : [{ id: 'fareReceipt', ready: true }, { id: 'taxSummary', ready: true }] }))
    const current: HistoryTrip[] = done ? [{
      id: `current-${s.id}`, title: 'Western Caribbean with Mexico', ship: 'Sun Princess', departure: s.departure, nights: 7, current: true, cancelled: false,
      fareCents: bookingTotal(s.id, category(), guestCount()),
      documents: [{ id: 'fareReceipt', ready: true }, { id: 'folioStatement', ready: true }, { id: 'gratuityStatement', ready: true }, { id: 'taxSummary', ready: true }],
    }] : []
    return { trips: [...current, ...past], sailed: done, photosUntil: done ? zonedToEpoch(addDays(itinerary(s)[7].date, REDOWNLOAD_DAYS), '23:59', HOME) : null }
  }

  const post: PostApi = {
    history: () => d.run('post.history', history),
    feedback: () => d.run('post.feedback', feedbackView),
    saveFeedback: (input) => d.run('post.saveFeedback', async () => {
      d.adult()
      needSailed()
      if (d.now() > editUntil()) throw new ApiError('conflict', 'expired')
      const problem = feedbackProblem(input)
      if (problem) throw new ApiError('invalid', problem)
      const areas: Feedback['areas'] = {}
      for (const a of AREAS) if (input.areas[a] !== undefined) areas[a] = input.areas[a]
      const crew = [...new Set(input.crew.map((n) => n.trim()))]
      const clean: Feedback = { overall: input.overall, areas, comment: input.comment.trim(), crew, allowContact: input.allowContact, shareName: input.shareName }
      const before = await one<StoredFeedback>('feedback', 'cruise', d.who())
      let caseId = before?.caseId
      if (needsRecovery(clean) && clean.allowContact && !caseId) {
        const summary = clean.comment.length >= 5 ? clean.comment : 'Low rating in the cruise feedback.'
        caseId = await openCase({ kind: 'recovery', summary, place: '', lineId: '', cents: 0, fromFeedback: true })
      }
      await put('feedback', 'cruise', { ...clean, at: d.now(), ...(caseId ? { caseId } : {}) } satisfies StoredFeedback, d.who())
      return feedbackView()
    }),
    loyalty: () => d.run('post.loyalty', async () => {
      const counted = sailed()
      const status = loyaltyStatus(d.who(), 7, counted)
      const ent = computeEntitlements({ tier: status.after, package: 'none', sanctuary: false })
      const friends = [...(REFERRALS[d.who()] ?? [])]
      return { status, counted, perks: ent.perks, wifiDevices: ent.wifiDevices, referral: { code: referralCode(d.who()), credit: REFERRAL_CREDIT, earned: referralEarned(d.who()), friends } } satisfies LoyaltyView
    }),
    rebook: () => d.run('post.rebook', rebookView),
    hold: (departureId) => d.run('post.hold', async () => {
      d.adult()
      if (!(aboard() || sailed())) throw new ApiError('conflict', 'closed')
      const view = await rebookView()
      const option = view.options.find((o) => o.id === departureId)
      if (!option) throw new ApiError('invalid', 'badDeparture')
      const live = view.holds.filter((h) => !h.expired)
      if (live.some((h) => h.departure === option.departure)) throw new ApiError('conflict', 'alreadyHeld')
      if (live.length >= MAX_HOLDS) throw new ApiError('conflict', 'tooManyHolds')
      const fccApplied = Math.min(view.fccLeft, option.deposit)
      await put('hold', d.newId('hold'), { departure: option.id, category: view.category, guests: view.guests, total: option.total, deposit: option.deposit, credit: option.credit, fccApplied, onboard: view.onboardOffer, placedAt: d.now() } satisfies StoredHold)
      return rebookView()
    }),
    releaseHold: (id) => d.run('post.releaseHold', async () => {
      d.adult()
      if (!(await one('hold', id))) throw new ApiError('notFound')
      await drop('hold', id)
      return rebookView()
    }),
    convertFcc: () => d.run('post.convertFcc', async () => {
      d.adult()
      needAboard()
      const left = (await rebookView()).fccLeft
      if (left <= 0) throw new ApiError('invalid', 'noCredit')
      await put('fccConvert', d.newId('fcc'), { cents: left, at: d.now() })
      return rebookView()
    }),
    bookSlot: (at) => d.run('post.bookSlot', async () => {
      d.adult()
      needAboard()
      if (!deskSlots().some((s) => s.at === at)) throw new ApiError('invalid', 'badSlot')
      await put('deskSlot', 'slot', { at, placedAt: d.now() })
      return rebookView()
    }),
    cancelSlot: () => d.run('post.cancelSlot', async () => {
      d.adult()
      await drop('deskSlot', 'slot')
      return rebookView()
    }),
  }

  // ---- What these services have put on the bill ----
  const folioLines = async (): Promise<FolioLine[]> => {
    const lines: FolioLine[] = []
    const tip = await tipOf()
    if (tip && tip.keep < 100) {
      const credit = tipCredit(gratuityCharged(await gratuityGuests()), tip.keep)
      if (credit > 0) lines.push({ id: 'tip-adjust', day: 7, at: tip.at, category: 'credit', description: `Gratuity adjustment (keeping ${tip.keep}%)`, guest: booker(), cents: -credit })
    }
    for (const r of await rows<{ cents: Cents; at: number }>('fccConvert')) lines.push({ id: `fcc-${r.id}`, day: dayAt(r.data.at), at: r.data.at, category: 'credit', description: 'Future cruise credit changed to onboard credit', guest: booker(), cents: -r.data.cents })
    for (const r of await holdsOf()) if (r.data.onboard && r.data.credit > 0) lines.push({ id: `hold-${r.id}`, day: dayAt(r.data.placedAt), at: r.data.placedAt, category: 'credit', description: 'Onboard credit for holding a future cruise', guest: booker(), cents: -r.data.credit })
    return lines
  }

  return { disembark, cases, post, folioLines }
}
