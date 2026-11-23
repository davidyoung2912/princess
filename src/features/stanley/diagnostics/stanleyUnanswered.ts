import { deviceStore } from '../../../shared/data/deviceStorage'
/**
 * Opt-in memory of the questions Stanley could not place (docs/stanley-answers-plan.md, sections 10 and 11, phase 7).
 * Off until the guest turns it on in Diagnostics settings. While on, the words of a missed or ambiguous question are kept on this device only,
 * trimmed, stripped of anything that looks like an email, phone, card or long number, and bounded. Nothing is sent anywhere: the guest copies the list and sends it themselves, or not.
 */
export const UNANSWERED_ON_KEY = 'princess:diagnostics:stanley:unanswered:on'
export const UNANSWERED_KEY = 'princess:diagnostics:stanley:unanswered'
/** Questions kept; the oldest go first. */
export const MAX_UNANSWERED = 100
/** Characters kept of one question. */
export const MAX_QUESTION_CHARS = 140
export type UnansweredKind = 'miss' | 'ambiguous'
export interface UnansweredQuestion { text: string; kind: UnansweredKind; at: string }

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The words with anything personal blanked: emails, links, and any run of digits (phones, cards, booking numbers). */
export function scrub(text: string): string {
  return text
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '…')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '…')
    .replace(/[+(]?\d[\d\s().-]{2,}\d|\d{2,}/g, '…')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUESTION_CHARS)
}

export const isUnansweredOn = (store: Store | null): boolean => { try { return store?.getItem(UNANSWERED_ON_KEY) === '1' } catch { return false } }

export function readUnanswered(store: Store | null): UnansweredQuestion[] {
  try {
    const raw: unknown = JSON.parse(store?.getItem(UNANSWERED_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((r): r is UnansweredQuestion => !!r && typeof r === 'object' && typeof r.text === 'string' && r.text.length > 0 && (r.kind === 'miss' || r.kind === 'ambiguous') && typeof r.at === 'string').slice(-MAX_UNANSWERED)
  } catch { return [] }
}

export const clearUnanswered = (store: Store | null): void => { try { store?.removeItem(UNANSWERED_KEY) } catch { /* nothing to do */ } }

/** Turning it off also forgets what was kept. */
export function setUnansweredOn(store: Store | null, on: boolean): void {
  if (!store) return
  try {
    if (on) store.setItem(UNANSWERED_ON_KEY, '1')
    else { store.removeItem(UNANSWERED_ON_KEY); store.removeItem(UNANSWERED_KEY) }
  } catch { /* nothing to do */ }
}

/** Keeps one question, only when the guest opted in. Never throws, and keeps nothing that scrubs down to nothing. */
export function recordUnanswered(store: Store | null, text: string, kind: UnansweredKind, now: Date = new Date()): void {
  if (!store || !isUnansweredOn(store)) return
  try {
    const clean = scrub(text)
    if (clean.replace(/[…\s]/g, '').length < 2) return
    const list = readUnanswered(store)
    list.push({ text: clean, kind, at: now.toISOString().slice(0, 10) })
    store.setItem(UNANSWERED_KEY, JSON.stringify(list.slice(-MAX_UNANSWERED)))
  } catch { /* nothing to do */ }
}

/** Safe where there is no storage. */
export function keepUnanswered(text: string, kind: UnansweredKind): void {
  try { recordUnanswered(deviceStore(), text, kind) } catch { /* storage blocked */ }
}

/** The export: one JSON object per line is easy to diff, but a plain list is what a guest can read before sending, so it is a small JSON document. */
export function exportUnanswered(list: readonly UnansweredQuestion[]): string {
  return JSON.stringify({ stanleyUnanswered: 1, questions: list }, null, 2)
}

/** Reads an export back (for the analysis script). Tolerates a bare array or one question per line. */
export function parseUnanswered(raw: string): UnansweredQuestion[] {
  const fromList = (v: unknown): UnansweredQuestion[] => (Array.isArray(v) ? v : []).flatMap((r): UnansweredQuestion[] => {
    if (typeof r === 'string') return r.trim() ? [{ text: r.trim(), kind: 'miss', at: '' }] : []
    if (r && typeof r === 'object' && typeof (r as UnansweredQuestion).text === 'string') return [{ text: (r as UnansweredQuestion).text, kind: (r as UnansweredQuestion).kind === 'ambiguous' ? 'ambiguous' : 'miss', at: String((r as UnansweredQuestion).at ?? '') }]
    return []
  })
  try {
    const v: unknown = JSON.parse(raw)
    return fromList(Array.isArray(v) ? v : (v as { questions?: unknown })?.questions)
  } catch {
    return fromList(raw.split('\n').map((l) => l.trim()).filter(Boolean))
  }
}
