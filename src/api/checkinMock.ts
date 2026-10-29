import { BRAND_NAMES, validateCard, type Profile } from '../domain/account'
import {
  AFTERNOON, assignmentFor, boardingGroup, CARRY_ON, COMPANION, currentCompanion, departureEpoch, EMBARK, encodePass, isCarryOn, isCompanion, laneFor, luggageStatus, passName, seqOf, terminalFor, trafficFor, WAIT_MINUTES, windowFor,
  type CarryOnId, type CompanionId,
} from '../domain/boarding'
import {
  CLOSE_TIME, CONTRACT, checkinProgress, checkinWindow, guestProgress, judgePhoto, normalizeGuestCheckin, OPEN_DAYS_BEFORE, validateDocument, validateEmergency, validateHealth, normalizePassportNumber,
  type BookingCheckin, type GuestCheckin, type GuestStepId,
} from '../domain/checkin'
import { computeEntitlements } from '../domain/entitlements'
import { DECLINED_LAST4 } from '../domain/fares'
import { PERSONAS, personaById, type PersonaId } from '../domain/personas'
import type { Sailing } from '../domain/sailings'
import { addDays, zonedToEpoch } from '../domain/timezones'
import { arrivalWindows, isWindow, normalizePlan, suggestedWindow } from '../domain/travel'
import { bookingNumber, normalizeBookingNumber } from '../domain/trip'
import type { BookingDeps } from './bookingMock'
import { ApiError } from './errors'
import type { Api, BoardingView, CheckinGuestView, CheckinSave, CheckinStatus, CheckinView, DocumentsView, EmbarkView, GuestPass, ReceiptItem, ReceiptView } from './types'

const HOME_ZONE = 'America/New_York'

/** Online check-in opens at midnight three days before sailing and closes at 10:00 on sailing day. */
export const checkinOpensAt = (s: Sailing): number => zonedToEpoch(addDays(s.departure, -OPEN_DAYS_BEFORE), '00:00', HOME_ZONE)
export const checkinClosesAt = (s: Sailing): number => zonedToEpoch(s.departure, CLOSE_TIME, HOME_ZONE)

export interface CheckinDeps extends Pick<BookingDeps, 'store' | 'channel' | 'actor' | 'adult' | 'now' | 'save' | 'log' | 'cardsOf' | 'profileOf' | 'run'> {
  sailing: () => Sailing
  documents: () => Promise<DocumentsView>
  /** Whether operations have moved the terminal (the demo scenario). */
  terminalMoved: () => boolean
}

interface EmbarkRecord { companion: string[]; carry: string[]; bagsAt: number | null }

const guestsOf = (booker: PersonaId) => PERSONAS.filter((p) => p.booker === booker)
const full = (p: Profile) => `${p.firstName} ${p.lastName}`.trim()
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** The check-in and boarding part of the mock: answers per guest, per booking, the passes, and embarkation day. */
export function createCheckinApi(d: CheckinDeps): Pick<Api, 'checkin' | 'boarding'> {
  const booker = () => d.actor().booker
  const read = async <T>(kind: string, owner: PersonaId, id: string): Promise<T | null> => ((await d.store.get(kind, owner, id))?.data as T | undefined) ?? null
  const write = (kind: string, owner: PersonaId, id: string, data: unknown) => d.save(kind, owner, id, data)

  const priority = (owner: PersonaId): boolean => {
    const p = personaById(owner)!
    return computeEntitlements({ tier: p.tier, package: p.package, sanctuary: p.sanctuary }).perks.includes('priorityEmbarkation')
  }
  const travelOf = async (owner: PersonaId) => normalizePlan(await read('travel', owner, 'plan'), priority(owner))

  const statusOf = async (owner: PersonaId): Promise<CheckinStatus & { finishedAt: number | null }> => {
    const s = d.sailing()
    const done = await read<{ at?: number }>('checkin', owner, 'status')
    const opensAt = checkinOpensAt(s)
    const closesAt = checkinClosesAt(s)
    return { state: done ? 'done' : checkinWindow(d.now(), opensAt, closesAt), opensAt, closesAt, finishedAt: done ? (done.at ?? 0) : null }
  }
  const guestRecord = async (owner: PersonaId, id: PersonaId): Promise<GuestCheckin> => normalizeGuestCheckin(await read('ci-guest', owner, id))
  const bookingRecord = async (owner: PersonaId): Promise<BookingCheckin> => {
    const p = (await read<{ payment?: { cardId?: unknown; label?: unknown; at?: unknown } }>('ci-booking', owner, 'main'))?.payment
    return p && typeof p.cardId === 'string' && typeof p.label === 'string' && typeof p.at === 'number' ? { payment: { cardId: p.cardId, label: p.label, at: p.at } } : {}
  }

  // ---- The check-in view ----

  const view = async (): Promise<CheckinView> => {
    const owner = booker()
    const [status, plan, booking, docs, cards] = [await statusOf(owner), await travelOf(owner), await bookingRecord(owner), await d.documents(), await d.cardsOf()]
    const ownerProfile = await d.profileOf(owner)
    const guests: CheckinGuestView[] = await Promise.all(
      guestsOf(owner).map(async (g) => {
        const [profile, record] = [await d.profileOf(g.id), await guestRecord(owner, g.id)]
        const held = docs.guests.find((x) => x.id === g.id)?.held ?? {}
        const own = profile.emergency.name.trim() ? profile.emergency : ownerProfile.emergency
        return {
          id: g.id, name: full(profile), first: profile.firstName, age: g.age, child: g.child, citizenship: profile.citizenship, record, progress: guestProgress(record),
          defaults: { emergency: own, documentKind: profile.citizenship === 'us' && !held.passport && held.birthCertificate ? ('birthCertificate' as const) : ('passport' as const), passportExpires: held.passport?.expires ?? '' },
        }
      }),
    )
    const progress = checkinProgress(guests, { payment: !!booking.payment, arrival: plan.window !== null })
    const p = priority(owner)
    return {
      status, guests, payment: booking.payment ?? null, arrival: plan.window, cards, windows: arrivalWindows(p), priority: p, suggested: suggestedWindow(p), progress, returnDate: docs.returnDate,
      canEdit: !d.actor().child && status.state !== 'closed', finishedAt: status.finishedAt,
    }
  }

  const open = async () => {
    d.adult()
    const s = await statusOf(booker())
    if (s.state === 'notOpen') throw new ApiError('conflict', 'notOpen')
    if (s.state === 'closed') throw new ApiError('conflict', 'closed')
  }
  const inBooking = (id: unknown): id is PersonaId => guestsOf(booker()).some((g) => g.id === id)
  const pick = (raw: readonly unknown[]): PersonaId[] => {
    const list = [...new Set(raw)]
    if (list.length === 0 || !list.every(inBooking)) throw new ApiError('invalid', 'guests')
    return list as PersonaId[]
  }
  const patch = async (owner: PersonaId, ids: readonly PersonaId[], step: GuestStepId, value: unknown) => {
    for (const id of ids) {
      const rec = await guestRecord(owner, id)
      await write('ci-guest', owner, id, { ...rec, [step]: value })
    }
  }
  const nameOf = async (id: PersonaId) => (await d.profileOf(id)).firstName

  const save = async (input: CheckinSave): Promise<CheckinView> => {
    await open()
    const owner = booker()
    const at = d.now()
    switch (input.step) {
      case 'confirm': {
        const ids = pick(input.guests)
        await patch(owner, ids, 'confirm', { at })
        await d.log('checkin', `Details confirmed for ${(await Promise.all(ids.map(nameOf))).join(', ')}`)
        break
      }
      case 'document': {
        const [id] = pick([input.guest])
        const profile = await d.profileOf(id)
        const problem = validateDocument(input, profile.citizenship, (await d.documents()).returnDate)
        if (problem) throw new ApiError('invalid', `document:${problem}`)
        const passport = input.kind === 'passport'
        await patch(owner, [id], 'document', { kind: input.kind, country: passport ? input.country.trim() : 'United States', last4: passport ? normalizePassportNumber(input.number).slice(-4) : '', expires: passport ? input.expires : '', at })
        await d.log('checkin', `${passport ? 'Passport' : 'Birth certificate'} for ${profile.firstName}`)
        break
      }
      case 'photo': {
        const [id] = pick([input.guest])
        const problems = judgePhoto(input.metrics ?? ({} as never))
        if (problems.length > 0) throw new ApiError('invalid', `photo:${problems.join(',')}`)
        await patch(owner, [id], 'photo', { at })
        await d.log('checkin', `Security photo for ${await nameOf(id)}`)
        break
      }
      case 'emergency': {
        const ids = pick(input.guests)
        const contact = { name: String(input.name ?? '').trim().slice(0, 80), phone: String(input.phone ?? '').trim().slice(0, 30), relationship: String(input.relationship ?? '').trim().slice(0, 40) }
        const problem = validateEmergency(contact, await Promise.all(guestsOf(owner).map(async (g) => full(await d.profileOf(g.id)))))
        if (problem) throw new ApiError('invalid', `emergency:${problem}`)
        await patch(owner, ids, 'emergency', { ...contact, at })
        await d.log('checkin', 'Emergency contact')
        break
      }
      case 'contract': {
        const ids = pick(input.guests)
        await patch(owner, ids, 'contract', { version: CONTRACT.version, at, by: d.actor().id })
        await d.log('checkin', `Contract accepted for ${(await Promise.all(ids.map(nameOf))).join(', ')}`)
        break
      }
      case 'health': {
        const [id] = pick([input.guest])
        const v = validateHealth(input.answers)
        if (!v) throw new ApiError('invalid', 'health:answers')
        await patch(owner, [id], 'health', { ...v, at })
        await d.log('checkin', `Health questions for ${await nameOf(id)}`)
        break
      }
      case 'payment': {
        const card = (await d.cardsOf()).find((c) => c.id === input.cardId)
        if (!card || validateCard(card.last4, card.expiry, new Date(at).toISOString().slice(0, 10))) throw new ApiError('invalid', 'payment:card')
        const label = `${BRAND_NAMES[card.brand]} ending ${card.last4}`
        if (card.last4 === DECLINED_LAST4) throw new ApiError('declined', label)
        await write('ci-booking', owner, 'main', { payment: { cardId: card.id, label, at } })
        await d.log('checkin', `Onboard account card ${label}`)
        break
      }
      case 'arrival': {
        if (!isWindow(input.window, priority(owner))) throw new ApiError('invalid', 'arrival:window')
        await write('travel', owner, 'plan', { ...(await travelOf(owner)), window: input.window })
        await d.log('travel', `Arrive ${input.window}`)
        break
      }
      default:
        throw new ApiError('invalid', 'step')
    }
    return view()
  }

  const submit = async (): Promise<CheckinStatus> => {
    d.adult()
    const owner = booker()
    const before = await statusOf(owner)
    if (before.state === 'done') return before
    if (before.state === 'notOpen') throw new ApiError('conflict', 'notOpen')
    if (before.state === 'closed') throw new ApiError('conflict', 'closed')
    if (!(await view()).progress.complete) throw new ApiError('conflict', 'incomplete')
    await write('checkin', owner, 'status', { done: true, at: d.now() })
    await d.log('checkin', 'Online check-in finished')
    const after = await statusOf(owner)
    return { state: after.state, opensAt: after.opensAt, closesAt: after.closesAt }
  }

  // ---- The receipt: what we have on file (CHK-13) ----

  const receipt = async (): Promise<ReceiptView> => {
    const v = await view()
    const item = (step: ReceiptItem['step'], savedAt: number | null | undefined, detail: string | null): ReceiptItem => ({ step, savedAt: savedAt ?? null, detail: savedAt ? detail : null })
    const guests = v.guests.map((g) => {
      const r = g.record
      const doc = r.document
      return {
        id: g.id, name: g.name,
        items: [
          item('confirm', r.confirm?.at, null),
          item('document', doc?.at, doc ? (doc.kind === 'passport' ? `Passport ending ${doc.last4}, ${doc.country}` : 'Birth certificate (certified copy)') : null),
          item('photo', r.photo?.at, 'Photo accepted'),
          item('emergency', r.emergency?.at, r.emergency ? `${r.emergency.name}, ${r.emergency.phone}` : null),
          item('contract', r.contract?.at, r.contract ? `Version ${r.contract.version}` : null),
          item('health', r.health?.at, r.health?.flagged ? 'Answered; a nurse will talk with you at the terminal' : 'Answered'),
        ],
      }
    })
    const booking = [item('payment', v.payment?.at, v.payment?.label ?? null), item('arrival', v.arrival ? (await bookingArrivalAt(booker())) : null, v.arrival ? `Arrive ${v.arrival}` : null)]
    return { number: bookingNumber(booker()), guests, booking, complete: v.progress.complete, finishedAt: v.finishedAt }
  }
  /** The arrival window lives in the travel plan, which keeps no time of its own; use the record's save time. */
  const bookingArrivalAt = async (owner: PersonaId): Promise<number> => (await d.store.get('travel', owner, 'plan'))?.updatedAt ?? 0

  // ---- Boarding pass ----

  const boardingOf = async (owner: PersonaId): Promise<BoardingView> => {
    const s = d.sailing()
    const status = await statusOf(owner)
    const plan = await travelOf(owner)
    const p = priority(owner)
    const needsStepFree = (await d.profileOf(owner)).needs.includes('mobility')
    const place = assignmentFor(owner, s.id, needsStepFree)
    const group = boardingGroup(p, plan.window)
    const done = status.state === 'done'
    const number = bookingNumber(owner)
    const passes: GuestPass[] = await Promise.all(
      guestsOf(owner).map(async (g) => {
        const profile = await d.profileOf(g.id)
        const seq = seqOf(owner, g.id)
        const printed = passName(profile.firstName, profile.lastName)
        return { id: g.id, name: full(profile), printed, seq, ready: done, code: done ? encodePass({ v: 1, booking: number, seq, name: printed, departure: s.departure, cabin: place.number, group }) : '', cabin: place.number, deck: place.deck, muster: place.muster, group }
      }),
    )
    const window = windowFor(plan.window, p)
    const wallet = await read<{ at?: number }>('wallet', owner, 'main')
    return { number, departure: s.departure, checkinDone: done, lane: laneFor(done), terminal: terminalFor(d.terminalMoved()), arrival: window, waitMinutes: window ? WAIT_MINUTES[window.crowd] : null, passes, inWallet: !!wallet, issuedAt: d.now() }
  }

  // ---- Embarkation day ----

  const embarkRecord = async (owner: PersonaId): Promise<EmbarkRecord> => {
    const o = await read<Record<string, unknown>>('embark', owner, 'main')
    return { companion: strings(o?.companion).filter(isCompanion), carry: strings(o?.carry).filter(isCarryOn), bagsAt: typeof o?.bagsAt === 'number' ? o.bagsAt : null }
  }
  const embark = async (): Promise<EmbarkView> => {
    const owner = booker()
    const s = d.sailing()
    const rec = await embarkRecord(owner)
    const boarding = await boardingOf(owner)
    const readyAt = departureEpoch(s.departure, EMBARK.staterooms)
    const docs = await d.documents()
    const nurse = await Promise.all(guestsOf(owner).map(async (g) => ((await guestRecord(owner, g.id)).health?.flagged ? full(await d.profileOf(g.id)) : null)))
    const now = d.now()
    return {
      boarding,
      opensAt: departureEpoch(s.departure, priority(owner) ? EMBARK.priorityOpens : EMBARK.terminalOpens),
      gangwayClosesAt: departureEpoch(s.departure, EMBARK.gangwayCloses),
      stateroomReadyAt: readyAt,
      stateroomReady: now >= readyAt,
      traffic: boarding.arrival ? trafficFor(boarding.arrival.crowd) : null,
      luggage: { status: luggageStatus(rec.bagsAt, now, readyAt), droppedAt: rec.bagsAt },
      carryOn: CARRY_ON.map((id) => ({ id, done: rec.carry.includes(id) })),
      companion: COMPANION.map((id) => ({ id, done: rec.companion.includes(id) })),
      current: currentCompanion(rec.companion),
      documents: docs.guests.map((g) => ({ id: g.id, name: g.name, ready: g.blocking === 0 })),
      afternoon: AFTERNOON.map((a) => ({ id: a.id, at: departureEpoch(s.departure, a.time) })),
      nurseCheck: nurse.filter((n): n is string => !!n),
      canEdit: !d.actor().child,
    }
  }
  const editEmbark = async (change: (r: EmbarkRecord) => EmbarkRecord): Promise<EmbarkView> => {
    d.adult()
    const owner = booker()
    await write('embark', owner, 'main', change(await embarkRecord(owner)))
    return embark()
  }
  const toggle = (list: readonly string[], id: string, on: boolean) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id))

  return {
    checkin: {
      status: () => d.run('checkin.status', async () => {
        const { state, opensAt, closesAt } = await statusOf(booker())
        return { state, opensAt, closesAt }
      }),
      submit: () => d.run('checkin.submit', submit),
      view: () => d.run('checkin.view', view),
      save: (input) => d.run('checkin.save', () => save(input)),
      receipt: () => d.run('checkin.receipt', receipt),
    },
    boarding: {
      pass: () => d.run('boarding.pass', () => boardingOf(booker())),
      lookup: (number, lastName) => d.run('boarding.lookup', async () => {
        const n = normalizeBookingNumber(number)
        const last = lastName.trim().toLowerCase()
        const owner = n && last ? PERSONAS.find((p) => p.booker === p.id && bookingNumber(p.id) === n) : undefined
        if (!owner) throw new ApiError('notFound')
        const names = await Promise.all(guestsOf(owner.id).map(async (g) => [(await d.profileOf(g.id)).lastName, g.name.split(' ').slice(1).join(' ')]))
        if (!names.flat().some((x) => x.trim().toLowerCase() === last)) throw new ApiError('notFound')
        return boardingOf(owner.id)
      }),
      addToWallet: () => d.run('boarding.addToWallet', async () => {
        d.adult()
        const owner = booker()
        if ((await statusOf(owner)).state !== 'done') throw new ApiError('conflict', 'notDone')
        await write('wallet', owner, 'main', { at: d.now() })
        return boardingOf(owner)
      }),
      embark: () => d.run('boarding.embark', embark),
      setCompanion: (step: CompanionId, done) => d.run('boarding.setCompanion', () => {
        if (!isCompanion(step)) throw new ApiError('invalid', 'step')
        return editEmbark((r) => ({ ...r, companion: toggle(r.companion, step, done) }))
      }),
      setCarryOn: (item: CarryOnId, done) => d.run('boarding.setCarryOn', () => {
        if (!isCarryOn(item)) throw new ApiError('invalid', 'item')
        return editEmbark((r) => ({ ...r, carry: toggle(r.carry, item, done) }))
      }),
      setBags: (dropped) => d.run('boarding.setBags', () => editEmbark((r) => ({ ...r, bagsAt: dropped ? d.now() : null }))),
    },
  }
}
