import type { StringKey } from '../i18n'
import { allAboardEpoch, isPortStage, itinerary, shipHomeZone, type Sailing, type StageId } from './sailings'
import { zonedToEpoch } from './timezones'

/**
 * "I'm delayed" (S4A-03) and sharing an ETA (S4A-08): one tap tells the line (a mock) and the travel party, shows what to do next,
 * and keeps a record that can go with an insurance claim. Kept on the device; nothing here tracks the guest's position.
 */
export const DELAY_REASONS = ['traffic', 'flight', 'documents', 'other'] as const
export type DelayReason = (typeof DELAY_REASONS)[number]
export const LATE_CHOICES = [15, 30, 60, 120] as const
export const MAX_DELAY_NOTE = 200
export const MAX_DELAY_HISTORY = 10

export type Told = 'line' | 'party'

export interface DelayRecord {
  id: string
  at: number
  reason: DelayReason
  /** How late the guest expects to be, in minutes. */
  lateMinutes: number
  note: string
  told: Told[]
  resolvedAt: number | null
}

export interface DelayState { current: DelayRecord | null; history: DelayRecord[]; /** Whether the party and the family page see the "delayed" flag and the new ETA. */ shareEta: boolean }

export const EMPTY_DELAY: DelayState = { current: null, history: [], shareEta: true }

export interface DelayInput { reason: DelayReason; lateMinutes: number; note: string; tellParty: boolean }

/** Records a delay, replacing one still open. The line is always told; the party only when the guest says so. */
export function reportDelay(state: DelayState, input: DelayInput, at: number, id: string): DelayState {
  const record: DelayRecord = {
    id, at, reason: input.reason, lateMinutes: Math.max(5, Math.min(480, Math.round(input.lateMinutes))), note: input.note.trim().slice(0, MAX_DELAY_NOTE),
    told: input.tellParty ? ['line', 'party'] : ['line'], resolvedAt: null,
  }
  return { ...state, current: record, history: archive(state) }
}

const archive = (s: DelayState) => (s.current ? [s.current, ...s.history].slice(0, MAX_DELAY_HISTORY) : s.history)

/** "I've arrived": the delay is over; the record stays for claims. */
export const resolveDelay = (state: DelayState, at: number): DelayState =>
  state.current ? { ...state, current: null, history: [{ ...state.current, resolvedAt: at }, ...state.history].slice(0, MAX_DELAY_HISTORY) } : state

export const setShareEta = (state: DelayState, on: boolean): DelayState => ({ ...state, shareEta: on })

/** The expected arrival: the planned moment plus the delay. */
export const expectedArrival = (planned: number, record: DelayRecord): number => planned + record.lateMinutes * 60_000

/** Whether the flag ("one of us is delayed") may be shown to others: the guest told the party and has ETA sharing on. */
export const delayVisibleToOthers = (state: DelayState): boolean => !!state.current && state.shareEta && state.current.told.includes('party')

/** What to do next, by where the trip is: before sailing the ship leaves on time; in port the ship waits for no one. */
export function delayNextSteps(stage: StageId): StringKey[] {
  if (stage === 'embarkation' || stage === 'preCruise' || stage === 'checkIn' || stage === 'booked') return ['delay.next.call', 'delay.next.terminal', 'delay.next.catchUp', 'delay.next.keep']
  if (isPortStage(stage)) return ['delay.next.call', 'delay.next.portAgent', 'delay.next.allAboard', 'delay.next.keep']
  return ['delay.next.call', 'delay.next.keep']
}

export interface ClaimLine { label: StringKey; value: string }

/** The facts an insurer will ask for, in order. The caller supplies the readable reason and time. */
export function claimRecord(r: DelayRecord, reasonLabel: string, when: string): ClaimLine[] {
  return [
    { label: 'delay.claim.when', value: when },
    { label: 'delay.claim.reason', value: reasonLabel },
    { label: 'delay.claim.late', value: String(r.lateMinutes) },
    { label: 'delay.claim.note', value: r.note || '-' },
    { label: 'delay.claim.told', value: r.told.join(', ') },
  ]
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

function normalizeRecord(raw: unknown): DelayRecord | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || typeof raw.at !== 'number' || !DELAY_REASONS.includes(raw.reason as DelayReason) || typeof raw.lateMinutes !== 'number') return null
  const told = (Array.isArray(raw.told) ? raw.told : []).filter((x): x is Told => x === 'line' || x === 'party')
  return { id: raw.id, at: raw.at, reason: raw.reason as DelayReason, lateMinutes: raw.lateMinutes, note: typeof raw.note === 'string' ? raw.note.slice(0, MAX_DELAY_NOTE) : '', told, resolvedAt: typeof raw.resolvedAt === 'number' ? raw.resolvedAt : null }
}

export function normalizeDelay(raw: unknown): DelayState {
  if (!isObj(raw)) return EMPTY_DELAY
  return {
    current: normalizeRecord(raw.current),
    history: (Array.isArray(raw.history) ? raw.history : []).flatMap((x) => normalizeRecord(x) ?? []).slice(0, MAX_DELAY_HISTORY),
    shareEta: raw.shareEta !== false,
  }
}

/** The next moment the ship will not wait past: all-aboard 30 minutes before sailing on day 1, then each port's posted all-aboard. Null once there are none left. */
export function nextDeadline(sailing: Sailing, now: number): number | null {
  const first = zonedToEpoch(itinerary(sailing)[0].date, '14:30', shipHomeZone(sailing))
  const moments = [first, ...itinerary(sailing).flatMap((d) => allAboardEpoch(sailing, d.day) ?? [])]
  return moments.find((m) => m > now) ?? null
}
