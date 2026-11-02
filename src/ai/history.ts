import { APP_PREFIX } from '../data/lifecycle'
import { sync } from '../sync'
import type { ChatMessage, Citation, Source } from './types'

/**
 * The conversation: kept on this device for the signed-in guest and clearable (SUP-03). One thread per person. When the guest has agreed to keep
 * private notes in their account (Settings: syncPrivate) the thread follows them to their other devices, as the `concierge` document; clearing it
 * deletes the account's copy too.
 */
export interface ThreadState { messages: ChatMessage[] }
export const EMPTY_THREAD: ThreadState = { messages: [] }
/** The most messages kept; older ones drop off. */
export const KEEP = 60

const SOURCES: readonly Source[] = ['claude', 'scripted', 'handoff']
const citationOf = (c: unknown): Citation | null =>
  c && typeof c === 'object' && typeof (c as Citation).label === 'string' && typeof (c as Citation).path === 'string' && (c as Citation).path.startsWith('/')
    ? { label: (c as Citation).label.slice(0, 120), path: (c as Citation).path.slice(0, 200) }
    : null

const messageOf = (m: unknown): ChatMessage | null => {
  if (!m || typeof m !== 'object') return null
  const o = m as Record<string, unknown>
  if ((o.role !== 'user' && o.role !== 'assistant') || typeof o.text !== 'string' || typeof o.at !== 'number' || typeof o.id !== 'string') return null
  const citations = Array.isArray(o.citations) ? o.citations.map(citationOf).filter((c): c is Citation => c !== null).slice(0, 5) : undefined
  return { id: o.id.slice(0, 60), role: o.role, text: o.text.slice(0, 4000), at: o.at, ...(SOURCES.includes(o.source as Source) ? { source: o.source as Source } : {}), ...(citations && citations.length > 0 ? { citations } : {}) }
}

/** Reads a stored or served thread; damaged messages are dropped and only the newest `KEEP` stay. */
export const normalizeThread = (raw: unknown): ThreadState => {
  const messages = raw && typeof raw === 'object' ? (raw as { messages?: unknown }).messages : null
  return { messages: Array.isArray(messages) ? messages.map(messageOf).filter((m): m is ChatMessage => m !== null).slice(-KEEP) : [] }
}

export const threadKeyFor = (personaId: string | null): string => `${APP_PREFIX}concierge:${personaId ?? ''}`

const safeStorage = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

export function loadThread(personaId: string | null, storage: Pick<Storage, 'getItem'> | null = safeStorage()): ThreadState {
  try {
    const text = storage?.getItem(threadKeyFor(personaId))
    return text ? normalizeThread(JSON.parse(text)) : EMPTY_THREAD
  } catch {
    return EMPTY_THREAD
  }
}

export function saveThread(personaId: string | null, state: ThreadState, storage: Pick<Storage, 'setItem'> | null = safeStorage()): boolean {
  try {
    storage?.setItem(threadKeyFor(personaId), JSON.stringify(state))
    return !!storage
  } catch {
    return false
  }
}

const cache = new Map<string, ThreadState>()
const listeners = new Set<() => void>()

export function getThread(personaId: string | null): ThreadState {
  const key = threadKeyFor(personaId)
  let s = cache.get(key)
  if (!s) { s = loadThread(personaId); cache.set(key, s) }
  return s
}

export function subscribeThread(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Replaces the thread (trimmed to the newest `KEEP`); false when it could not be saved on this device. */
export function setThread(personaId: string | null, messages: readonly ChatMessage[]): boolean {
  const next: ThreadState = { messages: messages.slice(-KEEP) }
  cache.set(threadKeyFor(personaId), next)
  const saved = saveThread(personaId, next)
  listeners.forEach((l) => l())
  sync.changed('concierge', personaId)
  return saved
}

/** Clears the thread here and deletes the account's copy (retried when the connection returns if that fails). */
export function clearThread(personaId: string | null): void {
  cache.set(threadKeyFor(personaId), EMPTY_THREAD)
  saveThread(personaId, EMPTY_THREAD)
  listeners.forEach((l) => l())
  void sync.withdraw('concierge').then(() => sync.pull())
}

/** Takes the account's copy (null: empty) without telling the sync module it changed. */
export function applyRemoteThread(personaId: string | null, next: ThreadState): void {
  cache.set(threadKeyFor(personaId), next)
  saveThread(personaId, next)
  listeners.forEach((l) => l())
}

/** Two devices talked while apart: both sets of messages are kept, in time order. */
export function mergeThreads(remote: unknown, local: unknown): ThreadState {
  const byId = new Map<string, ChatMessage>()
  for (const m of [...normalizeThread(remote).messages, ...normalizeThread(local).messages]) byId.set(m.id, m)
  return { messages: [...byId.values()].sort((a, b) => a.at - b.at).slice(-KEEP) }
}
