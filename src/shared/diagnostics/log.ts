/**
 * On-device diagnostics: a short list of the problems the app hit, kept in this browser only and never sent anywhere.
 * The guest can read it, copy it for Guest Services, and clear it. Entries hold a kind, a time and a short message with
 * no stack, address or typed text, so a copy is safe to share.
 */
export const DIAGNOSTICS_KEY = 'princess:diagnostics'
export const MAX_ENTRIES = 30
export const MAX_MESSAGE = 200

export type DiagnosticKind = 'error' | 'promise' | 'screen' | 'storage' | 'slow'

export interface DiagnosticEntry {
  kind: DiagnosticKind
  at: string
  message: string
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const KINDS: readonly string[] = ['error', 'promise', 'screen', 'storage', 'slow']

/** Message text with web addresses, e-mail addresses and long digit runs (card, phone, booking numbers) removed, then cut short. */
export function scrub(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, '[link]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\d[\d\s-]{5,}\d/g, '[number]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MESSAGE)
}

const isEntry = (v: unknown): v is DiagnosticEntry =>
  typeof v === 'object' && v !== null &&
  KINDS.includes((v as DiagnosticEntry).kind) &&
  typeof (v as DiagnosticEntry).at === 'string' &&
  typeof (v as DiagnosticEntry).message === 'string'

/** The saved entries, oldest first; anything unreadable gives an empty list. */
export function readLog(store: Store | null): DiagnosticEntry[] {
  try {
    const raw = store?.getItem(DIAGNOSTICS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(-MAX_ENTRIES) : []
  } catch {
    return []
  }
}

/** Adds an entry, keeping the newest 30. Never throws: a full or blocked store must not turn one problem into two. */
export function record(store: Store | null, kind: DiagnosticKind, message: unknown, now: Date = new Date()): void {
  if (!store) return
  try {
    const text = message instanceof Error ? `${message.name}: ${message.message}` : String(message)
    const next = [...readLog(store), { kind, at: now.toISOString(), message: scrub(text) }].slice(-MAX_ENTRIES)
    store.setItem(DIAGNOSTICS_KEY, JSON.stringify(next))
  } catch {
    // Storage is full or blocked; the problem has already been shown to the guest where it matters.
  }
}

export function clearLog(store: Store | null): void {
  try { store?.removeItem(DIAGNOSTICS_KEY) } catch { /* nothing to clear */ }
}

/** The log as plain text for copying, newest last, with a header that says what it is. */
export function logToText(entries: readonly DiagnosticEntry[]): string {
  const lines = entries.map((e) => `${e.at}  ${e.kind}  ${e.message}`)
  return ['Princess app diagnostics (stays on this device unless you copy it)', ...lines].join('\n')
}
