import { MAX_MESSAGE, screen, type Handoff } from './guard'
import type { AnswerAction, StanleySource } from './stanleyRoute'
import type { Citation } from './types'

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
  /** On an assistant message: which source answered, so the guest can see it. */
  source?: StanleySource
  /** The screens an answer used, shown as links. */
  citations?: Citation[]
  /** Buttons under the answer: a way on, the screens used, the group. */
  actions?: AnswerAction[]
  /** The words of a request to change something, shown with a preview and a Confirm button under the answer. */
  confirm?: string
  /** The library entry that answered, so follow-up chips can follow on from it. */
  entryId?: string
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

/** Blocked messages in a row (newest last) that start a cooldown, and how long it lasts. */
export const COOLDOWN_AFTER = 3
export const COOLDOWN_MS = 30_000

/**
 * Seconds left before the guest may send again. After {@link COOLDOWN_AFTER} blocked replies in a row, the box pauses for {@link COOLDOWN_MS} from the last one.
 * A good exchange of any other kind ends the run. The server's word filter and hourly limit still apply; this only slows down a guest who keeps testing it.
 */
export function cooldownSeconds(thread: readonly StanleyMessage[], now: number): number {
  let run = 0
  let lastAt = 0
  for (let i = thread.length - 1; i >= 0; i--) {
    const m = thread[i]
    if (m.role === 'user') continue
    if (m.kind !== 'blocked') break
    run++
    lastAt = lastAt || m.at
  }
  if (run < COOLDOWN_AFTER) return 0
  return Math.max(0, Math.ceil((lastAt + COOLDOWN_MS - now) / 1000))
}

/** The text in growing pieces of `words` words, each ending at a word boundary; the last piece is the whole text. Used to show an answer as it "arrives". */
export function revealSteps(text: string, words = 3): string[] {
  const parts = text.match(/\S+\s*/g) ?? []
  const steps: string[] = []
  for (let i = words; i < parts.length; i += words) steps.push(parts.slice(0, i).join(''))
  steps.push(text)
  return steps
}
