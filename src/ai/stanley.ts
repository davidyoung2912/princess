import { MAX_MESSAGE, screen, type Handoff } from './guard'

/** What Stanley's reply was, as the server names it. The front end words everything but an answer from its own strings. */
export type StanleyKind = 'answer' | 'blocked' | 'offtopic' | 'handoff' | 'unavailable'
export type StanleyFallback = 'limit' | 'auth' | 'rate' | 'network' | 'bad'

export interface StanleyMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  at: number
  /** On an assistant message: what kind of reply it was. Only `answer` carries text from the server. */
  kind?: StanleyKind | 'unreachable'
  handoff?: Handoff | null
  fallback?: StanleyFallback | null
}

export interface StanleyTurn {
  kind: StanleyKind | 'unreachable'
  text: string
  handoff: Handoff | null
  fallback: StanleyFallback | null
}

/** Sends one turn to `POST /me/stanley`. Set by the runtime. */
export type StanleySender = (body: { history: { role: 'user' | 'assistant'; text: string; at: number }[] }) => Promise<unknown>

/** Round trips kept in what is sent, and messages the server accepts in one request. */
export const MAX_TRIPS = 10
export const MAX_SENT = 60

const KINDS: readonly StanleyKind[] = ['answer', 'blocked', 'offtopic', 'handoff', 'unavailable']
const HANDOFFS: readonly Handoff[] = ['emergency', 'medical', 'legal', 'person']
const FALLBACKS: readonly StanleyFallback[] = ['limit', 'auth', 'rate', 'network', 'bad']

export type StanleyProblem = 'empty' | 'long'
export const stanleyProblem = (message: string): StanleyProblem | null => (!message.trim() ? 'empty' : message.trim().length > MAX_MESSAGE ? 'long' : null)

/** Reads the server's reply; anything that is not the agreed shape gives null. */
export function normalizeStanley(raw: unknown): StanleyTurn | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const kind = KINDS.find((k) => k === o.kind)
  if (!kind) return null
  const handoff = HANDOFFS.find((h) => h === o.handoff) ?? null
  if (kind === 'handoff' && !handoff) return null
  const text = typeof o.text === 'string' ? o.text.slice(0, 4000) : ''
  if (kind === 'answer' && !text.trim()) return null
  return { kind, text: kind === 'answer' ? text : '', handoff: kind === 'handoff' ? handoff : null, fallback: FALLBACKS.find((f) => f === o.fallback) ?? null }
}

/**
 * What is sent: the latest clean round trips (a guest message followed by an answer) and then the new message. Blocked, off-topic, handed-off and
 * failed exchanges are left out, as the server's own plan asks, so they never reach a prompt. `thread` ends with the guest's new message.
 */
export function historyToSend(thread: readonly StanleyMessage[]): { role: 'user' | 'assistant'; text: string; at: number }[] {
  const last = thread[thread.length - 1]
  const trips: StanleyMessage[][] = []
  for (let i = 0; i + 1 < thread.length - 1; i++) {
    const a = thread[i]
    const b = thread[i + 1]
    if (a.role === 'user' && b.role === 'assistant' && b.kind === 'answer') { trips.push([a, b]); i++ }
  }
  return [...trips.slice(-MAX_TRIPS).flat(), ...(last ? [last] : [])].map((m) => ({ role: m.role, text: m.text, at: m.at }))
}

/**
 * One turn. The server decides everything (word filter, safety screen, topic, answer, limit). The one check kept on the device is the safety screen,
 * so an emergency message shows the numbers to call even with no signal. When the server cannot be reached the guest is told so.
 */
export async function askStanley(send: StanleySender, thread: readonly StanleyMessage[]): Promise<StanleyTurn> {
  const message = thread[thread.length - 1]?.text ?? ''
  const handoff = screen(message)
  if (handoff) return { kind: 'handoff', text: '', handoff, fallback: null }
  try {
    return normalizeStanley(await send({ history: historyToSend(thread) })) ?? { kind: 'unreachable', text: '', handoff: null, fallback: 'bad' }
  } catch {
    return { kind: 'unreachable', text: '', handoff: null, fallback: 'network' }
  }
}

// The conversation lives in memory only: closing the dialog keeps it, a refresh clears it.
let thread: readonly StanleyMessage[] = []
const listeners = new Set<() => void>()
export const getStanleyThread = (): readonly StanleyMessage[] => thread
export const subscribeStanley = (fn: () => void): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export function setStanleyThread(next: readonly StanleyMessage[]) {
  thread = next.slice(-MAX_SENT)
  listeners.forEach((fn) => fn())
}
