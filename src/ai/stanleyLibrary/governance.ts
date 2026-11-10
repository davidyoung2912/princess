import type { JourneyStage } from '../../routes/hubs'
import { LIBRARY, PAGE_QA } from '.'
import type { LibraryEntry } from './types'

/**
 * Content governance for the authored library (docs/stanley-gap-analysis-and-plan.md, phase 2; STN-DRM-03). Every entry has an owner, a review date, an expiry date,
 * a risk level, a scope and a fallback. An entry past its expiry is not shown as an answer, and a test fails until someone reviews it and moves the date on.
 * The data sits here, beside the entries and not in the locale files, because none of it is shown to a guest.
 */
export type Risk = 'low' | 'medium' | 'high'
/** What Stanley does when an entry is not usable: `server` asks the gateway, `screen` points to the page, `person` says "check with a person" and shows the contact route. */
export type Fallback = 'server' | 'screen' | 'person'
/** Whose facts the entry is: the whole fleet, one ship (Sun Princess), or one sailing's ports and times. */
export type Scope = 'fleet' | 'ship' | 'sailing'

export interface LibraryMeta { owner: string; reviewedOn: string; expiresOn: string; risk: Risk; scope: Scope; fallback: Fallback }

/** The day the whole library was last read through. Move it forward, and the expiry dates with it, when the review is done. */
export const REVIEWED_ON = '2026-11-09'
/** Months an entry stays usable after its review, by risk: the riskier the fact, the sooner someone looks again. */
export const SHELF_MONTHS: Record<Risk, number> = { low: 12, medium: 9, high: 6 }

const STAGE_OWNER: Record<JourneyStage, string> = {
  dream: 'Sales content', discover: 'Sales content', book: 'Booking operations', manage: 'Guest documents', prebook: 'Onboard revenue', getToShip: 'Port operations',
  embark: 'Hotel operations', sea: 'Hotel operations', port: 'Shore excursions', disembark: 'Port operations', remember: 'Guest relations',
}
const STAGE_SCOPE: Record<JourneyStage, Scope> = {
  dream: 'fleet', discover: 'fleet', book: 'fleet', manage: 'fleet', prebook: 'fleet', getToShip: 'fleet', embark: 'ship', sea: 'ship', port: 'sailing', disembark: 'fleet', remember: 'fleet',
}

/** Entries about a deadline, tender, payment, access, entry rules or safety (strategy 5.6): the ones that must never be stale. */
export const HIGH_RISK_IDS: ReadonlySet<string> = new Set([
  'embark.muster', 'sea.rough', 'port.allAboard', 'port.tender', 'port.missed', 'port.walkBack', 'port.heat', 'port.children',
  'book.deposit', 'book.finalPayment', 'book.cancel', 'book.payWays', 'book.insurance', 'book.passport', 'book.child', 'book.split',
  'manage.balanceDue', 'manage.documents', 'manage.passportExpiry', 'manage.fixName', 'manage.contract', 'manage.access', 'manage.allergy',
  'getToShip.checkinOpens', 'getToShip.papers', 'getToShip.late', 'getToShip.medallion', 'getToShip.terminalCheckin',
  'discover.tender', 'discover.allAboard', 'discover.documents', 'discover.guarantee', 'discover.taxes', 'sea.clocks',
  'disembark.customs', 'disembark.bagsOut', 'disembark.whenOff', 'disembark.earlyFlight', 'disembark.bill', 'prebook.health', 'prebook.notAllowed',
])
/** Questions about money, bookings and plans that are not a deadline or a safety fact. */
const MEDIUM_PREFIX = ['book.', 'manage.', 'prebook.', 'getToShip.', 'disembark.', 'port.', 'sea.bill', 'sea.order', 'embark.']

const addMonths = (iso: string, months: number): string => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

const stageOf = (e: LibraryEntry): JourneyStage | null => e.stages[0] ?? null

export function riskOf(e: LibraryEntry): Risk {
  if (HIGH_RISK_IDS.has(e.id)) return 'high'
  return MEDIUM_PREFIX.some((p) => e.id.startsWith(p)) ? 'medium' : 'low'
}

/** The metadata of an entry in the general library or a page question. Page questions explain a screen, so they are low risk, owned by the product team and kept for a year. */
export function metaOf(e: LibraryEntry): LibraryMeta {
  const page = e.id.startsWith('pg.')
  const stage = page ? null : stageOf(e)
  const risk = page ? 'low' : riskOf(e)
  return {
    owner: page ? 'Product' : stage ? STAGE_OWNER[stage] : 'Product',
    reviewedOn: REVIEWED_ON,
    expiresOn: addMonths(REVIEWED_ON, SHELF_MONTHS[risk]),
    risk,
    scope: page ? 'fleet' : stage ? STAGE_SCOPE[stage] : 'fleet',
    fallback: risk === 'high' ? 'person' : e.link || page ? 'screen' : 'server',
  }
}

/**
 * Words that mark a question about a deadline, tender, payment, access, entry rules or safety. A written answer for one of these must come from a high-risk entry, which
 * is written and reviewed for it; a lower-risk entry that only shares a word ("today", "time") must not answer, so the question goes on to the server.
 */
export const RISK_TOPICS = /\b(tender\w*|all aboard|deadline|due|owe|owed|payment|paid|refund\w*|visa|passport|wheelchair|accessib\w*|muster|safe|safety|allerg\w*)\b/i
export const mentionsRiskTopic = (text: string): boolean => RISK_TOPICS.test(text)

/** The question is about the guest's own booking or about now (my, today, running, yet), so a general written answer cannot settle it and the server's data must. */
export const isLiveOrPersonal = (text: string): boolean => /\b(my|our|mine|today|tonight|tomorrow|now|yet|still|running|status|done|late|clos\w*|cut-?off)\b/i.test(text)

/** The entry is within its expiry date at `now` (epoch milliseconds). The whole of the expiry day still counts. */
export const isLive = (e: LibraryEntry, now: number): boolean => now < Date.parse(`${metaOf(e).expiresOn}T00:00:00Z`) + 86_400_000

/** The general entries a typed question may be matched against now. An expired one drops out, and the question goes to the server instead. */
export const liveLibrary = (now: number): readonly LibraryEntry[] => LIBRARY.filter((e) => isLive(e, now))

const ISO = /^\d{4}-\d{2}-\d{2}$/
const complete = (m: LibraryMeta): boolean =>
  m.owner.trim().length > 0 && ISO.test(m.reviewedOn) && ISO.test(m.expiresOn) && m.expiresOn > m.reviewedOn && ['low', 'medium', 'high'].includes(m.risk) && ['fleet', 'ship', 'sailing'].includes(m.scope) && ['server', 'screen', 'person'].includes(m.fallback)

export interface LibraryCoverage { entries: number; missing: string[]; expired: string[]; byRisk: Record<Risk, number> }

/** The coverage report: how many entries there are, which have incomplete metadata, which are past expiry, and how they divide by risk. */
export function libraryCoverage(now: number): LibraryCoverage {
  const all = [...LIBRARY, ...PAGE_QA]
  const byRisk: Record<Risk, number> = { low: 0, medium: 0, high: 0 }
  for (const e of all) byRisk[metaOf(e).risk]++
  return { entries: all.length, missing: all.filter((e) => !complete(metaOf(e))).map((e) => e.id), expired: all.filter((e) => !isLive(e, now)).map((e) => e.id), byRisk }
}
