import type { Handoff } from './guard'

/**
 * Human handoff, as the server makes it (docs/stanley-gap-analysis-and-plan.md, phase 6). The guest sees the exact text, agrees, and the server opens a case and answers with a reference.
 * The device says "handed to Guest Services" only from that answer; before it, or when it fails, the wording is "not sent yet". An emergency is never a handoff. Framework-free, so it is tested in node.
 */
export const CASE_TOPICS = ['person', 'cabin', 'lostProperty', 'billing', 'allergy', 'special', 'disruption', 'missedShip'] as const
export type CaseTopic = (typeof CASE_TOPICS)[number]
export type CaseStatus = 'submitted' | 'acknowledged' | 'fulfilled'
export const ISSUE_MAX = 1000

export interface StanleyCase {
  id: string
  topic: CaseTopic
  /** The short reference to quote (GS- and six characters). */
  reference: string
  owner: string
  status: CaseStatus
  openedAt: number
  nextUpdateAt: number
  /** The time for the next update has passed without one. */
  overdue: boolean
  /** The case has gone to a supervisor because it waited too long. */
  escalated: boolean
  issue: string
  outcome: string
}

/** What is sent. Every field is text the guest saw in the preview. */
export interface CaseRequest { topic: CaseTopic; issue: string; outcome: string; reference: string; tried: string; role: 'guest'; consent: true }

const STATUSES: readonly CaseStatus[] = ['submitted', 'acknowledged', 'fulfilled']

/** Reads the server's case; anything that is not the agreed shape (no reference, no known topic) gives null, so a claim is never made from a half answer. */
export function normalizeCase(raw: unknown): StanleyCase | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const topic = CASE_TOPICS.find((k) => k === o.topic)
  const status = STATUSES.find((s) => s === o.status)
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : NaN)
  const openedAt = num(o.openedAt)
  const nextUpdateAt = num(o.nextUpdateAt)
  if (typeof o.id !== 'string' || !o.id || !topic || !status || Number.isNaN(openedAt) || Number.isNaN(nextUpdateAt)) return null
  if (typeof o.reference !== 'string' || !/^GS-[A-Z0-9]{4,10}$/.test(o.reference)) return null
  const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
  return { id: o.id.slice(0, 64), topic, reference: o.reference, owner: text(o.owner, 80) || 'Guest Services', status, openedAt, nextUpdateAt, overdue: o.overdue === true, escalated: o.escalated === true, issue: text(o.issue, ISSUE_MAX), outcome: text(o.outcome, 200) }
}

export function normalizeCases(raw: unknown): StanleyCase[] {
  return Array.isArray(raw) ? raw.map(normalizeCase).filter((c): c is StanleyCase => c !== null).slice(0, 50) : []
}

/** The topic a safety-screen result starts from. An emergency has none: it only shows the numbers. Medical and legal questions go to a person; nothing here treats them as a request that can be fulfilled. */
export const topicForHandoff = (h: Handoff | null | undefined): CaseTopic | null => (h === 'emergency' ? null : 'person')

/** A guess at the topic from the guest's own words, so the chooser opens on the likely one; the guest can change it. */
export function topicFromWords(text: string): CaseTopic {
  const s = text.toLowerCase()
  if (/\b(missed|left behind|miss the ship|ship left|ship has left|ship sailed)\b/.test(s)) return 'missedShip'
  if (/\b(allerg|gluten|celiac|coeliac|dietary|vegan|vegetarian)\b/.test(s)) return 'allergy'
  if (/\b(lost|left behind my|mislaid|missing)\b.*\b(bag|phone|wallet|passport|item|jacket|glasses|camera|keys?)\b/.test(s)) return 'lostProperty'
  if (/\b(bill|charge|charged|folio|refund|overcharg|double.?charged)\b/.test(s)) return 'billing'
  if (/\b(cabin|stateroom|air.?con|toilet|leak|noise|noisy|bed|steward|housekeeping|broken)\b/.test(s)) return 'cabin'
  if (/\b(cancel|delay|delayed|disrupt|diversion|skipped port|missed port|flight)\b/.test(s)) return 'disruption'
  if (/\b(wheelchair|accessib|mobility|anniversary|birthday|special request|celebrat)\b/.test(s)) return 'special'
  return 'person'
}

/** Why a send is refused, from the server's code, as the key of the wording to show. */
export type CaseProblem = 'off' | 'forbidden' | 'tooMany' | 'invalid' | 'other'
export function caseProblemOf(e: unknown): CaseProblem {
  const code = e && typeof e === 'object' ? (e as { code?: unknown; message?: unknown }) : {}
  const message = typeof code.message === 'string' ? code.message : ''
  if (message === 'off') return 'off'
  if (message === 'tooManyCases') return 'tooMany'
  if (code.code === 'forbidden') return 'forbidden'
  if (code.code === 'invalid') return 'invalid'
  return 'other'
}

/**
 * What a case says now, as a stable key and whether it needs the guest's attention. It never claims a case is solved unless the server said `fulfilled`,
 * and an overdue case says so and offers the phone number rather than waiting quietly.
 */
export function caseState(c: StanleyCase, now: number): { key: 'submitted' | 'acknowledged' | 'fulfilled' | 'overdue' | 'escalated'; callNow: boolean } {
  if (c.status === 'fulfilled') return { key: 'fulfilled', callNow: false }
  if (c.escalated) return { key: 'escalated', callNow: true }
  if (c.overdue || now >= c.nextUpdateAt) return { key: 'overdue', callNow: true }
  return { key: c.status, callNow: false }
}
