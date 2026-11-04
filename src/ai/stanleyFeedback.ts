/**
 * "Was that helpful?" answers, kept on this device only (nothing is sent). One small list of answer id and yes/no, newest 100, so a later
 * review of the authored library can see which answers missed. Never holds typed text.
 */
export const FEEDBACK_KEY = 'princess:stanley-feedback'
export const MAX_FEEDBACK = 100

export interface FeedbackItem { id: string; helpful: boolean; at: string }

type Store = Pick<Storage, 'getItem' | 'setItem'>

const isItem = (v: unknown): v is FeedbackItem =>
  typeof v === 'object' && v !== null && typeof (v as FeedbackItem).id === 'string' && typeof (v as FeedbackItem).helpful === 'boolean' && typeof (v as FeedbackItem).at === 'string'

export function readFeedback(store: Store | null): FeedbackItem[] {
  try {
    const raw = store?.getItem(FEEDBACK_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isItem).slice(-MAX_FEEDBACK) : []
  } catch {
    return []
  }
}

/** Adds an answer, keeping the newest 100. Never throws. */
export function recordFeedback(store: Store | null, id: string, helpful: boolean, now: Date = new Date()): void {
  if (!store) return
  try {
    const next = [...readFeedback(store), { id: id.slice(0, 80), helpful, at: now.toISOString() }].slice(-MAX_FEEDBACK)
    store.setItem(FEEDBACK_KEY, JSON.stringify(next))
  } catch {
    // Storage is full or blocked; the thanks line still shows.
  }
}

/** Records an answer in this browser's storage; a blocked store is ignored. */
export function rateAnswer(id: string, helpful: boolean): void {
  try { recordFeedback(typeof window === 'undefined' ? null : window.localStorage, id, helpful) } catch { /* storage blocked */ }
}
