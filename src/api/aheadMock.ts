import {
  ADVISORS, ADVISOR_CALLBACK_HOURS, BID_DECIDED_DAYS, advisorProblem, advisorReply, assistProblem, assistStage, bagStage, bidProblem, bidWins, clubForAge, clubProblem,
  compassionTerms, consentCode, consentState, contactProblem, doubleOptInFor, isConsentRegion, isMarketingChannel, loyaltyNumberOf, medallionStatus, tagProblem, upgradeOffers,
  type AdvisorWay, type AssistKind, type ClubRegistration, type ConsentRecord, type TagWay,
} from '../domain/ahead'
import { assignmentFor, passName } from '../domain/boarding'
import { maskEmail, maskPhone } from '../domain/booking'
import { fccBefore } from '../domain/postcruise'
import { isFixId, fixReference, fixStage, prepItem, type FixId } from '../domain/readiness'
import { partyOf, personaById } from '../domain/personas'
import { quote, type Cents } from '../domain/pricing'
import { stageAt, type Sailing } from '../domain/sailings'
import type { CategoryId } from '../domain/ship'
import { addDays, zonedToEpoch } from '../domain/timezones'
import { bookingNumber, bookingTotal, categoryOfStateroom, finalPaymentDays } from '../domain/trip'
import type { BookingDeps } from './bookingMock'
import { ApiError } from './errors'
import type { AheadApi, AssistRow, FixRow, MarketingChoice, UpgradeBid } from './aheadTypes'

export interface AheadDeps extends Pick<BookingDeps, 'store' | 'channel' | 'who' | 'actor' | 'adult' | 'now' | 'save' | 'newId' | 'run' | 'cardsOf' | 'profileOf'> {
  sailing: () => Sailing
}

interface StoredBid { category: CategoryId; cents: Cents; buyNow: boolean; withdrawnAt?: number }
interface StoredAssist { askedAt: number; kind: AssistKind; phone: string; note: string; bookingNumber: string | null; choice?: 'refund' | 'credit' }

const HOUR = 3_600_000
const DAY = 24 * HOUR
const HOME = 'America/New_York'
const NOT_BOARDED: readonly string[] = ['booked', 'preCruise', 'checkIn']

export function createAheadApi(d: AheadDeps): AheadApi {
  const booker = () => d.actor().booker
  const party = () => partyOf(d.who())
  const rows = async <T>(kind: string, owner: string = booker()) => (await d.store.list(kind, owner)).map((r) => ({ id: r.id, at: r.updatedAt, data: r.data as T }))
  const one = async <T>(kind: string, id: string, owner: string = booker()): Promise<T | null> => ((await d.store.get(kind, owner, id))?.data as T | undefined) ?? null
  const put = (kind: string, id: string, data: unknown, owner: string = booker()) => d.save(kind, owner, id, data)
  const drop = async (kind: string, id: string, owner: string = booker()) => { await d.store.delete(kind, owner, id); d.channel?.post({ type: 'records', kind, owner }) }
  const departureAt = () => zonedToEpoch(d.sailing().departure, '12:00', HOME)
  const daysToDeparture = () => Math.ceil((departureAt() - d.now()) / DAY)
  const bookedAt = () => zonedToEpoch(addDays(d.sailing().departure, -(finalPaymentDays(booker()) + 60)), '12:00', HOME)
  const beforeSailing = () => NOT_BOARDED.includes(stageAt(d.sailing(), d.now()))
  const notOver = () => { if (['disembark', 'postCruise'].includes(stageAt(d.sailing(), d.now()))) throw new ApiError('conflict', 'closed') }
  const canEdit = () => !d.actor().child

  // ---- Travel advisors (DIS-15) ----
  const advisorRows = async () =>
    (await rows<{ advisorId: string; way: AdvisorWay; question: string }>('advisorAsk', d.who())).map((r) => {
      const advisor = ADVISORS.find((a) => a.id === r.data.advisorId)!
      return { id: r.id, advisorId: r.data.advisorId, advisor: advisor.name, way: r.data.way, question: r.data.question, at: r.at, reply: r.data.way === 'chat' ? advisorReply(advisor.name, r.data.question) : null, callbackBy: r.data.way === 'callback' ? r.at + ADVISOR_CALLBACK_HOURS * HOUR : null }
    }).sort((a, b) => b.at - a.at)
  const advisors: AheadApi['advisors'] = {
    list: () => d.run('ahead.advisors.list', advisorRows),
    ask: (input) => d.run('ahead.advisors.ask', async () => {
      d.adult()
      const problem = advisorProblem(input?.advisorId, input?.way, input?.phone, input?.question)
      if (problem) throw new ApiError('invalid', problem)
      await put('advisorAsk', d.newId('adv'), { advisorId: input.advisorId, way: input.way, question: input.question.trim().slice(0, 500) }, d.who())
      if (input.way === 'callback') await d.save('ticket', d.who(), d.newId('ticket'), { kind: 'callback', detail: input.phone.trim().slice(0, 30) })
      return advisorRows()
    }),
  }

  // ---- Marketing consent (DIS-16) ----
  const marketingView = async () => {
    const now = d.now()
    const choices: MarketingChoice[] = []
    for (const channel of ['email', 'sms'] as const) {
      const r = await one<ConsentRecord>('mkt', channel, d.who())
      if (!r) { choices.push({ channel, contact: '', region: 'us', state: 'none', askedAt: null, confirmedAt: null, needsCode: false, demoCode: null }); continue }
      const state = consentState(r, now)
      choices.push({ channel, contact: channel === 'email' ? maskEmail(r.contact) : maskPhone(r.contact), region: r.region, state, askedAt: r.askedAt, confirmedAt: r.confirmedAt, needsCode: state === 'pending', demoCode: state === 'pending' ? consentCode(r.contact) : null })
    }
    return { choices, canEdit: canEdit() }
  }
  const marketing: AheadApi['marketing'] = {
    view: () => d.run('ahead.marketing.view', marketingView),
    subscribe: (channel, contact, region) => d.run('ahead.marketing.subscribe', async () => {
      d.adult()
      if (!isMarketingChannel(channel)) throw new ApiError('invalid', 'badChannel')
      const problem = contactProblem(channel, contact)
      if (problem) throw new ApiError('invalid', problem)
      if (!isConsentRegion(region)) throw new ApiError('invalid', 'badRegion')
      const at = d.now()
      await put('mkt', channel, { channel, contact: contact.trim(), region, askedAt: at, confirmedAt: doubleOptInFor(region) ? null : at } satisfies ConsentRecord, d.who())
      return marketingView()
    }),
    confirm: (channel, code) => d.run('ahead.marketing.confirm', async () => {
      d.adult()
      const r = isMarketingChannel(channel) ? await one<ConsentRecord>('mkt', channel, d.who()) : null
      if (!r || r.confirmedAt !== null) throw new ApiError('conflict', 'nothingPending')
      if (consentState(r, d.now()) === 'expired') throw new ApiError('conflict', 'expired')
      if (String(code).trim() !== consentCode(r.contact)) throw new ApiError('invalid', 'wrongCode')
      await put('mkt', channel, { ...r, confirmedAt: d.now() }, d.who())
      return marketingView()
    }),
    withdraw: (channel) => d.run('ahead.marketing.withdraw', async () => {
      d.adult()
      if (!isMarketingChannel(channel)) throw new ApiError('invalid', 'badChannel')
      await drop('mkt', channel, d.who())
      return marketingView()
    }),
  }

  // ---- Captain's Circle number and credit (BOK-11, BOK-12) ----
  const perks: AheadApi['perks'] = {
    mine: () => d.run('ahead.perks.mine', async () => {
      const used = (await one<{ cents: number }>('fccUsed', 'used', d.who()))?.cents ?? 0
      return { number: loyaltyNumberOf(d.who()), tier: personaById(d.who())!.tier, creditLeft: Math.max(0, fccBefore(d.who()) - used) }
    }),
  }

  // ---- Upgrade bids (MNG-06) ----
  const currentCategory = (): CategoryId => categoryOfStateroom(personaById(booker())!.stateroom)
  const decidedAt = () => departureAt() - BID_DECIDED_DAYS * DAY
  const offers = () => {
    const guests = Math.min(4, party().length)
    const base = quote(d.sailing().id, currentCategory(), guests)?.total ?? 0
    return upgradeOffers(currentCategory(), (c) => { const q = quote(d.sailing().id, c, guests); return q ? q.total - base : null })
  }
  const bidStatus = (r: { id: string; data: StoredBid }): UpgradeBid['status'] => {
    if (r.data.withdrawnAt !== undefined) return 'withdrawn'
    if (r.data.buyNow) return 'accepted'
    if (d.now() < decidedAt()) return 'open'
    const offer = offers().find((o) => o.category === r.data.category)
    return offer && bidWins(offer, r.data.cents, `${booker()}|${r.data.category}`) ? 'accepted' : 'declined'
  }
  const upgradesView = async () => {
    const bids = (await rows<StoredBid>('upgradeBid')).map((r): UpgradeBid => ({ id: r.id, category: r.data.category, cents: r.data.cents, at: r.at, status: bidStatus(r), buyNow: r.data.buyNow })).sort((a, b) => b.at - a.at)
    return { current: currentCategory(), offers: offers(), bids, decidedAt: decidedAt(), open: d.now() < decidedAt() && beforeSailing(), canEdit: canEdit() }
  }
  const upgrades: AheadApi['upgrades'] = {
    view: () => d.run('ahead.upgrades.view', upgradesView),
    bid: (category, cents) => d.run('ahead.upgrades.bid', async () => {
      d.adult()
      const offer = offers().find((o) => o.category === category)
      const problem = bidProblem(offer, cents)
      if (problem) throw new ApiError('invalid', problem)
      if (!((await upgradesView()).open)) throw new ApiError('conflict', 'closed')
      if ((await d.cardsOf()).length === 0) throw new ApiError('conflict', 'noCard')
      const existing = (await rows<StoredBid>('upgradeBid')).find((r) => r.data.category === category && bidStatus(r) !== 'withdrawn' && bidStatus(r) !== 'declined')
      if (existing) throw new ApiError('conflict', 'duplicate')
      await put('upgradeBid', d.newId('bid'), { category, cents, buyNow: cents >= offer!.buyNow } satisfies StoredBid)
      return upgradesView()
    }),
    withdraw: (id) => d.run('ahead.upgrades.withdraw', async () => {
      d.adult()
      const r = (await rows<StoredBid>('upgradeBid')).find((x) => x.id === id)
      if (!r) throw new ApiError('notFound')
      if (bidStatus(r) !== 'open') throw new ApiError('conflict', 'closed')
      await put('upgradeBid', id, { ...r.data, withdrawnAt: d.now() })
      return upgradesView()
    }),
  }

  // ---- Kids' and teens' clubs (PRE-08), health data held under the booker only (SEC-07, SEC-08) ----
  const clubsView = async () => {
    const saved = new Map((await rows<ClubRegistration>('clubReg')).map((r) => [r.id, r.data]))
    const children = party().filter((p) => p.age < 18).map((p) => ({ id: p.id, name: p.name, age: p.age, club: clubForAge(p.age)?.id ?? null, registered: saved.has(p.id), registration: d.actor().child ? null : (saved.get(p.id) ?? null) }))
    return { children, canEdit: canEdit(), open: !['disembark', 'postCruise'].includes(stageAt(d.sailing(), d.now())) }
  }
  const clubs: AheadApi['clubs'] = {
    view: () => d.run('ahead.clubs.view', clubsView),
    save: (reg) => d.run('ahead.clubs.save', async () => {
      d.adult()
      notOver()
      const child = party().find((p) => p.id === reg?.childId && p.age < 18)
      if (!child) throw new ApiError('invalid', 'noClub')
      const clean: ClubRegistration = {
        childId: child.id, allergies: String(reg.allergies ?? ''), medical: String(reg.medical ?? ''), medication: String(reg.medication ?? ''), photoConsent: reg.photoConsent === true,
        pickups: Array.isArray(reg.pickups) ? reg.pickups.map((p) => ({ name: String(p?.name ?? ''), relation: String(p?.relation ?? ''), phone: String(p?.phone ?? '') })) : [],
        selfSignOut: reg.selfSignOut === true, emergencyPhone: String(reg.emergencyPhone ?? ''), confirmed: reg.confirmed === true,
      }
      const problem = clubProblem(clean, child.age)
      if (problem) throw new ApiError('invalid', problem)
      await put('clubReg', child.id, clean)
      return clubsView()
    }),
    withdraw: (childId) => d.run('ahead.clubs.withdraw', async () => {
      d.adult()
      if (!(await one('clubReg', childId))) throw new ApiError('notFound')
      await drop('clubReg', childId)
      return clubsView()
    }),
  }

  // ---- Medallion (CHK-06) ----
  const medallionView = async () => {
    const m = await one<{ activatedAt: number | null; lostAt: number | null }>('medallion', 'me')
    const s = medallionStatus(departureAt(), bookedAt(), d.now(), m?.activatedAt ?? null, m?.lostAt ?? null)
    const h = Math.imul(departureAt() % 100_000, 31) + booker().length
    return { ...s, guests: party().map((p) => ({ id: p.id, name: p.name })), address: 'The address on your booking', trackingNumber: `1Z${String(Math.abs(h) % 1_000_000_000).padStart(9, '0')}`, canEdit: canEdit() }
  }
  const medallion: AheadApi['medallion'] = {
    view: () => d.run('ahead.medallion.view', medallionView),
    activate: () => d.run('ahead.medallion.activate', async () => {
      d.adult()
      const v = await medallionView()
      if (v.lostAt !== null) throw new ApiError('conflict', 'lost')
      if (v.activatedAt !== null) throw new ApiError('conflict', 'already')
      if (!v.canActivate) throw new ApiError('conflict', 'notDelivered')
      await put('medallion', 'me', { activatedAt: d.now(), lostAt: null })
      return medallionView()
    }),
    lost: () => d.run('ahead.medallion.lost', async () => {
      d.adult()
      const m = await one<{ activatedAt: number | null; lostAt: number | null }>('medallion', 'me')
      if (m?.lostAt) throw new ApiError('conflict', 'already')
      await put('medallion', 'me', { activatedAt: null, lostAt: d.now() })
      return medallionView()
    }),
  }

  // ---- Luggage tags (CHK-09) ----
  const tagsView = async () => {
    const t = await one<{ way: TagWay | null; orderedAt: number | null; handedOverAt: number | null }>('tags', 'me')
    const stage = t?.way ? bagStage(t.handedOverAt ?? null, d.now()) : 'none'
    const guests = await Promise.all(party().map(async (p) => {
      const profile = await d.profileOf(p.id)
      const a = assignmentFor(booker(), d.sailing().id, (await d.profileOf(booker())).needs.includes('mobility'))
      return { id: p.id, name: p.name, printed: passName(profile.firstName, profile.lastName), cabin: a.number, deck: a.deck }
    }))
    return { way: t?.way ?? null, guests, orderedAt: t?.orderedAt ?? null, daysToDeparture: daysToDeparture(), handedOverAt: t?.handedOverAt ?? null, stage, canEdit: canEdit() }
  }
  const tags: AheadApi['tags'] = {
    view: () => d.run('ahead.tags.view', tagsView),
    choose: (way) => d.run('ahead.tags.choose', async () => {
      d.adult()
      const problem = tagProblem(way, daysToDeparture())
      if (problem) throw new ApiError(problem === 'badWay' ? 'invalid' : 'conflict', problem)
      if (!beforeSailing() && stageAt(d.sailing(), d.now()) !== 'embarkation') throw new ApiError('conflict', 'closed')
      const t = await one<{ handedOverAt: number | null }>('tags', 'me')
      await put('tags', 'me', { way, orderedAt: way === 'order' ? d.now() : null, handedOverAt: t?.handedOverAt ?? null })
      return tagsView()
    }),
    handedOver: (on) => d.run('ahead.tags.handedOver', async () => {
      d.adult()
      const t = await one<{ way: TagWay | null; orderedAt: number | null }>('tags', 'me')
      if (!t?.way) throw new ApiError('conflict', 'noTags')
      if (stageAt(d.sailing(), d.now()) !== 'embarkation') throw new ApiError('conflict', 'notYet')
      await put('tags', 'me', { ...t, handedOverAt: on ? d.now() : null })
      return tagsView()
    }),
  }

  // ---- Fix-it flows (MNG-18) ----
  const fixRows = async (): Promise<FixRow[]> =>
    (await rows<{ flow: FixId; note: string; ref: string }>('fix')).map((r) => ({ id: r.id, flow: r.data.flow, note: r.data.note, at: r.at, reference: r.data.ref, stage: fixStage(r.at, d.now()), contactBy: r.at + 24 * HOUR })).sort((a, b) => b.at - a.at)
  const fix: AheadApi['fix'] = {
    list: () => d.run('ahead.fix.list', fixRows),
    escalate: (flow, note) => d.run('ahead.fix.escalate', async () => {
      d.adult()
      if (!isFixId(flow)) throw new ApiError('invalid', 'badFlow')
      if (typeof note !== 'string' || note.trim().length < 5 || note.length > 600) throw new ApiError('invalid', 'noNote')
      const have = await fixRows()
      if (have.some((r) => r.flow === flow && r.stage === 'received')) throw new ApiError('conflict', 'duplicate')
      await put('fix', d.newId('fix'), { flow, note: note.trim(), ref: fixReference(have.length + 1) })
      return fixRows()
    }),
  }

  // ---- Assisted booking, bereavement and medical cancellation (SUP-07) ----
  const assistRows = async (): Promise<AssistRow[]> =>
    (await rows<StoredAssist>('assist')).map((r) => {
      const asked = r.data.askedAt ?? r.at
      const stage = assistStage(asked, d.now())
      const total = bookingTotal(d.sailing().id, categoryOfStateroom(personaById(booker())!.stateroom), Math.min(4, party().length))
      return { id: r.id, kind: r.data.kind, note: r.data.note, phone: maskPhone(r.data.phone), at: asked, stage, reference: `SC-${String(10_000 + (asked % 90_000))}`, bookingNumber: r.data.bookingNumber, terms: r.data.kind !== 'assistedBooking' && stage === 'decided' ? compassionTerms(total) : null, choice: r.data.choice ?? null }
    }).sort((a, b) => b.at - a.at)
  const assist: AheadApi['assist'] = {
    list: () => d.run('ahead.assist.list', assistRows),
    ask: (input) => d.run('ahead.assist.ask', async () => {
      d.adult()
      const problem = assistProblem(input?.kind, input?.phone, input?.note, true)
      if (problem) throw new ApiError('invalid', problem)
      await put('assist', d.newId('assist'), { askedAt: d.now(), kind: input.kind, phone: input.phone.trim().slice(0, 30), note: input.note.trim(), bookingNumber: input.kind === 'assistedBooking' ? null : bookingNumber(booker()) } satisfies StoredAssist)
      return assistRows()
    }),
    choose: (id, choice) => d.run('ahead.assist.choose', async () => {
      d.adult()
      if (choice !== 'refund' && choice !== 'credit') throw new ApiError('invalid', 'badChoice')
      const r = (await rows<StoredAssist>('assist')).find((x) => x.id === id)
      if (!r) throw new ApiError('notFound')
      if (r.data.kind === 'assistedBooking' || assistStage(r.data.askedAt, d.now()) !== 'decided') throw new ApiError('conflict', 'notDecided')
      if (r.data.choice) throw new ApiError('conflict', 'already')
      await put('assist', id, { ...r.data, choice })
      return assistRows()
    }),
  }

  // ---- Health and comfort checklist (MNG-19) and saved items (PRE-11) ----
  const prepDone = async () => (await one<{ ids: string[] }>('prep', 'done', d.who()))?.ids ?? []
  const prep: AheadApi['prep'] = {
    get: () => d.run('ahead.prep.get', prepDone),
    set: (id, on) => d.run('ahead.prep.set', async () => {
      if (!prepItem(id)) throw new ApiError('invalid', 'badItem')
      const ids = new Set(await prepDone())
      if (on) ids.add(id)
      else ids.delete(id)
      await put('prep', 'done', { ids: [...ids] }, d.who())
      return [...ids]
    }),
  }

  const SAVED_KEY = /^(item|excursion|venue|addon):[a-z0-9-]{1,40}$/
  const savedKeys = async () => (await one<{ keys: string[] }>('saved', 'list', d.who()))?.keys ?? []
  const saved: AheadApi['saved'] = {
    list: () => d.run('ahead.saved.list', savedKeys),
    toggle: (key) => d.run('ahead.saved.toggle', async () => {
      if (typeof key !== 'string' || !SAVED_KEY.test(key)) throw new ApiError('invalid', 'badKey')
      const keys = await savedKeys()
      const next = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
      if (next.length > 50) throw new ApiError('conflict', 'full')
      await put('saved', 'list', { keys: next }, d.who())
      return next
    }),
  }

  return { advisors, marketing, perks, upgrades, clubs, medallion, tags, fix, assist, prep, saved }
}
