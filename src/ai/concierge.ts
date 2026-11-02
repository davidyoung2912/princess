import { MAX_CONTEXT, MAX_MESSAGE, screen, type Handoff } from './guard'
import { t } from '../i18n'
import type { ChatMessage, Citation, Context, Reply, Source } from './types'

/** Why a model was not used when it normally would be: the server's codes, or `limit` for the hourly limit. */
export type FailureCode = 'auth' | 'rate' | 'network' | 'bad'
export type Fallback = FailureCode | 'limit'

export interface Turn {
  reply: Reply
  /** The handoff that answered instead of a model, if any. */
  handoff: Handoff | null
  /** Why the model was not used when it normally would be. */
  fallback: Fallback | null
}

export type AskProblem = 'empty' | 'long'

export const askProblem = (message: string): AskProblem | null => (!message.trim() ? 'empty' : message.trim().length > MAX_MESSAGE ? 'long' : null)

/** What the server needs to answer: the thread (newest last) and what the device knows about the guest. The model key, the tools and the limit are all on the server. */
export interface ServerAsk {
  history: { role: 'user' | 'assistant'; text: string; at: number }[]
  mobility?: Context['mobility']
  likes?: string[]
}

/** Sends one turn to `POST /me/concierge`. Set by the runtime. */
export type ConciergeSender = (body: ServerAsk) => Promise<unknown>

const HANDOFFS: readonly Handoff[] = ['emergency', 'medical', 'legal', 'person']
const FALLBACKS: readonly Fallback[] = ['auth', 'rate', 'network', 'bad', 'limit']
const SOURCES: readonly Source[] = ['claude', 'scripted', 'handoff']

/** Reads the server's answer; anything that is not the agreed shape gives null, and the built-in helper answers instead. */
export function normalizeTurn(raw: unknown): Turn | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const source = SOURCES.find((s) => s === o.source)
  if (!source || typeof o.text !== 'string') return null
  const handoff = HANDOFFS.find((h) => h === o.handoff) ?? null
  if (source === 'handoff' && !handoff) return null
  if (source !== 'handoff' && !o.text.trim()) return null
  const citations: Citation[] = Array.isArray(o.citations)
    ? o.citations.flatMap((c): Citation[] => {
        const x = c as Partial<Citation> | null
        return x && typeof x.label === 'string' && typeof x.path === 'string' && x.path.startsWith('/') ? [{ label: x.label.slice(0, 120), path: x.path.slice(0, 200) }] : []
      }).slice(0, 5)
    : []
  return { reply: { text: o.text.slice(0, 4000), citations, source }, handoff, fallback: FALLBACKS.find((f) => f === o.fallback) ?? null }
}

/**
 * One turn. The server decides everything: a message needing a person never reaches a model, the model answers when it is set up and the hourly limit
 * allows, and the server's scripted concierge answers otherwise. The one check kept on the device is the handoff screen, so an emergency message
 * shows the numbers to call even with no signal. When the server cannot be reached the guest is told so; nothing is answered from this device.
 * `history` ends with the guest's new message.
 */
export async function ask(send: ConciergeSender, history: readonly ChatMessage[], ctx: Context): Promise<Turn> {
  const message = history[history.length - 1]?.text ?? ''
  const handoff = screen(message)
  if (handoff) return { reply: { text: '', citations: [], source: 'handoff' }, handoff, fallback: null }
  const unreachable = (fallback: Fallback): Turn => ({ reply: { text: t('ai.unreachable'), citations: [], source: 'scripted' }, handoff: null, fallback })
  try {
    const turn = normalizeTurn(await send({
      history: history.slice(-MAX_CONTEXT).map((m) => ({ role: m.role, text: m.text, at: m.at })),
      mobility: ctx.mobility,
      likes: ctx.likes ? [...ctx.likes] : undefined,
    }))
    return turn ?? unreachable('bad')
  } catch {
    return unreachable('network')
  }
}
