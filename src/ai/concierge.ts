import { askClaude, ConciergeError, DEFAULT_MODEL, type ClaudeConfig, type FailureCode } from './client'
import { MAX_MESSAGE, screen, withinLimit, type Handoff } from './guard'
import { scriptedReply } from './scripted'
import type { ChatMessage, Context, Reply } from './types'

/** Settings from the build: the key is read from `VITE_ANTHROPIC_API_KEY` (a git-ignored `.env.local`); without one the scripted concierge answers. */
export function configFrom(env: Record<string, unknown>): ClaudeConfig | null {
  const key = typeof env.VITE_ANTHROPIC_API_KEY === 'string' ? env.VITE_ANTHROPIC_API_KEY.trim() : ''
  if (!key) return null
  const model = typeof env.VITE_ANTHROPIC_MODEL === 'string' && env.VITE_ANTHROPIC_MODEL.trim() ? env.VITE_ANTHROPIC_MODEL.trim() : DEFAULT_MODEL
  return { apiKey: key, model }
}

export interface Turn {
  reply: Reply
  /** The handoff that answered instead of a model, if any. */
  handoff: Handoff | null
  /** Why the model was not used when it normally would be. */
  fallback: FailureCode | 'limit' | null
}

export type AskProblem = 'empty' | 'long'

export const askProblem = (message: string): AskProblem | null => (!message.trim() ? 'empty' : message.trim().length > MAX_MESSAGE ? 'long' : null)

/**
 * One turn. A message needing a person never reaches a model; otherwise the model answers when there is a key and the
 * hourly limit allows, and the scripted concierge answers when there is not or the call fails. `history` ends with the
 * guest's new message; `askedAt` is when each of their earlier messages was sent.
 */
export async function ask(config: ClaudeConfig | null, history: readonly ChatMessage[], askedAt: readonly number[], ctx: Context): Promise<Turn> {
  const message = history[history.length - 1]?.text ?? ''
  const handoff = screen(message)
  if (handoff) return { reply: { text: '', citations: [], source: 'handoff' }, handoff, fallback: null }
  if (!config) return { reply: scriptedReply(message, ctx), handoff: null, fallback: null }
  if (!withinLimit(askedAt, ctx.now).ok) return { reply: scriptedReply(message, ctx), handoff: null, fallback: 'limit' }
  try {
    return { reply: await askClaude(config, history, ctx), handoff: null, fallback: null }
  } catch (e) {
    return { reply: scriptedReply(message, ctx), handoff: null, fallback: e instanceof ConciergeError ? e.code : 'bad' }
  }
}
