import { aboardState, SAIL_AFTER_MINUTES, type AboardLevel, type PortDay } from './allaboard'
import { DEFAULT_BUFFER, planPortDay } from './portPilot'
import type { Presence } from './portParty'

/**
 * Away From Ship: what a guest needs in hand the moment they step off the ship for a port day. The guest says they are leaving (and later that they are
 * back; in time the ship's own gangway scan will say it); the app keeps a copy of what they will want with no signal and works out the return times
 * that matter. Framework-free. Times are authored concept values (verify before real use).
 */

/** The guest is off the ship: they said they are leaving, or are ashore. */
export const isAway = (presence: Presence | null): boolean => presence === 'ashore' || presence === 'leaving'

/** The window in which "I'm leaving the ship" makes sense: the ship has docked (or anchored) and has not yet sailed. */
export const inPortWindow = (day: Pick<PortDay, 'arriveAt' | 'departAt'>, now: number): boolean => now >= day.arriveAt && now < day.departAt

export type ReturnTimeId = 'landing' | 'lastTender' | 'allAboard' | 'sails'
export interface ReturnTime { id: ReturnTimeId; at: number; /** Whole minutes to go, never below zero. */ minutesLeft: number; passed: boolean }

/** The four moments that matter, in order: be at the pier gate (or tender landing), the last tender (tender ports only), all aboard, and the ship sails. */
export function returnTimes(day: Pick<PortDay, 'allAboardAt' | 'arriveAt' | 'tender'>, now: number): ReturnTime[] {
  const plan = planPortDay({ day, travelMinutes: 0, outingMinutes: null, buffer: DEFAULT_BUFFER, crowd: 'moderate' })
  const raw: { id: ReturnTimeId; at: number }[] = [
    { id: 'landing', at: plan.landingBy },
    ...(plan.lastTenderAt !== null ? [{ id: 'lastTender' as const, at: plan.lastTenderAt }] : []),
    { id: 'allAboard', at: day.allAboardAt },
    { id: 'sails', at: day.allAboardAt + SAIL_AFTER_MINUTES * 60_000 },
  ]
  return raw.sort((a, b) => a.at - b.at).map((r) => ({ ...r, minutesLeft: Math.max(0, Math.ceil((r.at - now) / 60_000)), passed: now >= r.at }))
}

/** The next moment still ahead, or null once the ship has sailed. */
export const nextReturnTime = (times: readonly ReturnTime[]): ReturnTime | null => times.find((x) => !x.passed) ?? null

/** How urgent the way back is: the all-aboard levels, with "now" also covering the time after the guest should have reached the gangway queue. */
export function awayLevel(day: Pick<PortDay, 'allAboardAt' | 'arriveAt' | 'tender'>, now: number): AboardLevel {
  const level = aboardState(day.allAboardAt, now).level
  if (level !== 'plenty' && level !== 'soon') return level
  const landing = returnTimes(day, now).find((x) => x.id === 'landing')
  return landing?.passed ? 'now' : level
}

// ---- The copy kept for use with no signal ----

/** What is copied when the guest leaves: today's state, the port day and its tour codes, the boarding pass, muster and emergency information, and tonight's dining. */
export const AWAY_PACK_KINDS = ['today', 'portDay', 'pass', 'muster', 'emergency', 'dining'] as const
export type AwayPackKind = (typeof AWAY_PACK_KINDS)[number]

export interface AwayPackResult {
  /** When the copy was made (the demo clock). */
  at: number
  /** The port-day date it was made for. */
  date: string
  items: { kind: AwayPackKind; ok: boolean }[]
}

export type AwayPackState = 'none' | 'partial' | 'ready'

export interface AwayPackStatus { state: AwayPackState; saved: number; total: number; missing: AwayPackKind[]; at: number | null }

/** Reads a stored result, ignoring anything that is not one. */
export function normalizeAwayPack(raw: unknown): AwayPackResult | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (typeof o.at !== 'number' || typeof o.date !== 'string' || !Array.isArray(o.items)) return null
  const items = o.items.flatMap((i): AwayPackResult['items'] => {
    const x = i as { kind?: unknown; ok?: unknown }
    const kind = AWAY_PACK_KINDS.find((k) => k === x?.kind)
    return kind && typeof x.ok === 'boolean' ? [{ kind, ok: x.ok }] : []
  })
  return { at: o.at, date: o.date, items }
}

/** How complete the copy is for this port day; a copy made for another day counts as none. */
export function awayPackStatus(r: AwayPackResult | null, date: string): AwayPackStatus {
  const total = AWAY_PACK_KINDS.length
  if (!r || r.date !== date) return { state: 'none', saved: 0, total, missing: [...AWAY_PACK_KINDS], at: null }
  const ok = new Set(r.items.filter((i) => i.ok).map((i) => i.kind))
  const missing = AWAY_PACK_KINDS.filter((k) => !ok.has(k))
  return { state: missing.length === 0 ? 'ready' : ok.size === 0 ? 'none' : 'partial', saved: total - missing.length, total, missing, at: r.at }
}
