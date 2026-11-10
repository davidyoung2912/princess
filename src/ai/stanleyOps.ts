import { LIBRARY, PAGE_QA } from './stanleyLibrary'
import { metaOf, type Risk } from './stanleyLibrary/governance'
import type { ChangeCard } from './stanleyChanges'
import { freeShare, readAsked, readTiers, repeated, type AskedCounts, type TierCounts } from '../diagnostics/stanleyTiers'

/**
 * Quality gates and operations (docs/stanley-gap-analysis-and-plan.md, phase 14). Everything here reads counts and dates, never a guest's words. Framework-free, so it is tested in node.
 */

const DAY = 86_400_000
/** How many days before its expiry an entry shows as due for review. */
export const DUE_SOON_DAYS = 60

/** Decision 6: at least this share of answers must need no model call, and fewer than this share may reach the large tier. */
export const TARGET_NO_MODEL = 60
export const TARGET_LARGE_BELOW = 10

export type ReviewStatus = 'overdue' | 'due' | 'ok'
export interface ReviewItem { id: string; owner: string; risk: Risk; expiresOn: string; daysLeft: number; status: ReviewStatus }

const dayOf = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) + DAY

/** Every authored entry with its owner, expiry and how many whole days remain (negative once past). The whole expiry day still counts. */
export function reviewItems(now: number): ReviewItem[] {
  return [...LIBRARY, ...PAGE_QA].map((e) => {
    const m = metaOf(e)
    const daysLeft = Math.floor((dayOf(m.expiresOn) - now) / DAY)
    const status: ReviewStatus = daysLeft < 0 ? 'overdue' : daysLeft <= DUE_SOON_DAYS ? 'due' : 'ok'
    return { id: e.id, owner: m.owner, risk: m.risk, expiresOn: m.expiresOn, daysLeft, status }
  })
}

const RISK_ORDER: Record<Risk, number> = { high: 0, medium: 1, low: 2 }

export interface OwnerReview { owner: string; overdue: number; due: number; items: ReviewItem[] }

/** Entries that are overdue or due soon, grouped by owner. The owner with the most urgent work comes first; inside, soonest expiry first, then the riskier entry. */
export function staleReport(now: number): OwnerReview[] {
  const groups = new Map<string, ReviewItem[]>()
  for (const i of reviewItems(now)) if (i.status !== 'ok') groups.set(i.owner, [...(groups.get(i.owner) ?? []), i])
  return [...groups.entries()]
    .map(([owner, items]) => ({
      owner, overdue: items.filter((i) => i.status === 'overdue').length, due: items.filter((i) => i.status === 'due').length,
      items: [...items].sort((a, b) => a.daysLeft - b.daysLeft || RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => b.overdue - a.overdue || b.due - a.due || a.owner.localeCompare(b.owner))
}

export interface DeviceSignals { unansweredShare: number | null; repeats: { id: string; count: number }[]; noModelShare: number | null }

/** The on-device signals for the content console: how often Stanley could not answer, the questions asked again and again, and the share that needed no model. */
export function deviceSignals(tiers: TierCounts, asked: AskedCounts): DeviceSignals {
  const total = tiers.library + tiers.ship + tiers.trip + tiers.before + tiers.model + tiers.handoff + tiers.unanswered
  return { unansweredShare: total === 0 ? null : Math.round((tiers.unanswered / total) * 100), repeats: repeated(asked, 10), noModelShare: freeShare(tiers) }
}

/** One row of `GET /me/stanley/tiers`, read defensively. */
export interface TierRow { tier: string; source: string; stage: string; topic: string; outcome: string; modelTier: string; replies: number; calls: number; inputTokens: number; outputTokens: number }
export interface TierSummary { since: string; replies: number; modelCalls: number; inputTokens: number; outputTokens: number; rows: TierRow[] }

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)
const s = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

export function normalizeTierSummary(raw: unknown): TierSummary | null {
  const o = obj(raw)
  if (!o || !Array.isArray(o.rows)) return null
  const rows = o.rows.slice(0, 500).flatMap((r): TierRow[] => {
    const x = obj(r)
    return x ? [{ tier: s(x.tier, 20), source: s(x.source, 20), stage: s(x.stage, 20), topic: s(x.topic, 30), outcome: s(x.outcome, 20), modelTier: s(x.modelTier, 20), replies: n(x.replies), calls: n(x.calls), inputTokens: n(x.inputTokens), outputTokens: n(x.outputTokens) }] : []
  })
  return { since: s(o.since, 40), replies: n(o.replies), modelCalls: n(o.modelCalls), inputTokens: n(o.inputTokens), outputTokens: n(o.outputTokens), rows }
}

export interface CostDashboard {
  replies: number
  /** Whole percent of replies that made no model call; null with no replies. */
  noModelPercent: number | null
  /** Whole percent of replies whose model call used the large tier; null with no replies. */
  largePercent: number | null
  /** Whole percent of replies passed to a person (the escalation rate); null with no replies. */
  handoffPercent: number | null
  /** Whole percent of replies that gave no answer (limit, off, network and the like). */
  failedPercent: number | null
  /** Model tokens spent for each resolved reply (one that was answered, not blocked, handed off or failed); null when none were resolved. */
  tokensPerResolved: number | null
  meetsNoModel: boolean | null
  meetsLarge: boolean | null
}

const pct = (a: number, b: number): number | null => (b === 0 ? null : Math.round((a / b) * 100))

/** Cost per resolved task and the tier mix, from the server's aggregate rows only (no guest, no text), measured against decision 6. */
export function costDashboard(t: TierSummary): CostDashboard {
  const replies = t.rows.reduce((x, r) => x + r.replies, 0)
  const noModel = t.rows.filter((r) => r.calls === 0).reduce((x, r) => x + r.replies, 0)
  const large = t.rows.filter((r) => r.modelTier === 'large').reduce((x, r) => x + r.replies, 0)
  const handoff = t.rows.filter((r) => r.tier === 'handoff').reduce((x, r) => x + r.replies, 0)
  const resolved = t.rows.filter((r) => r.outcome === 'ok' && r.tier !== 'handoff' && r.tier !== 'blocked').reduce((x, r) => x + r.replies, 0)
  const failed = t.rows.filter((r) => r.outcome !== 'ok' && r.tier !== 'handoff' && r.tier !== 'blocked' && r.tier !== 'offtopic').reduce((x, r) => x + r.replies, 0)
  const tokens = t.rows.reduce((x, r) => x + r.inputTokens + r.outputTokens, 0)
  const noModelPercent = pct(noModel, replies)
  const largePercent = pct(large, replies)
  return {
    replies, noModelPercent, largePercent, handoffPercent: pct(handoff, replies), failedPercent: pct(failed, replies),
    tokensPerResolved: resolved === 0 ? null : Math.round(tokens / resolved),
    meetsNoModel: noModelPercent === null ? null : noModelPercent >= TARGET_NO_MODEL,
    meetsLarge: largePercent === null ? null : largePercent < TARGET_LARGE_BELOW,
  }
}

/** Minutes a suggestion may stay on a screen before it times out, and a quiet tip. An alert (a deadline risk, a lost booking) never times out: it stays until the guest deals with it. */
export const SUGGESTION_MINUTES = 30
export const TIP_MINUTES = 15

/**
 * Stale-tip expiry: a card the guest has been looking at for too long goes away so nothing nags. It goes after its time, and at once when the screen, the sailing or the facts behind it
 * (its fingerprint) are no longer what it was shown for. Alerts are never expired here.
 */
export function cardExpired(card: Pick<ChangeCard, 'critical' | 'tip' | 'fingerprint'>, shownAt: number, now: number, current?: { fingerprint?: string }): boolean {
  if (card.critical) return false
  if (current?.fingerprint !== undefined && current.fingerprint !== card.fingerprint) return true
  return now - shownAt >= (card.tip ? TIP_MINUTES : SUGGESTION_MINUTES) * 60_000
}

/** The milliseconds until a card times out (zero or more), or null for one that never does. */
export function expiresInMs(card: Pick<ChangeCard, 'critical' | 'tip'>, shownAt: number, now: number): number | null {
  if (card.critical) return null
  return Math.max(0, shownAt + (card.tip ? TIP_MINUTES : SUGGESTION_MINUTES) * 60_000 - now)
}

/** The signals from this device's own counts. Safe where there is no storage. */
export function readDeviceSignals(): DeviceSignals {
  let store: Storage | null = null
  try { store = typeof window === 'undefined' ? null : window.localStorage } catch { store = null }
  return deviceSignals(readTiers(store), readAsked(store))
}
