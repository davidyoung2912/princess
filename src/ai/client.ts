import { MAX_CONTEXT } from './guard'
import { runTool, TOOLS } from './tools'
import type { ChatMessage, Citation, Context, Reply } from './types'
import { personaById } from '../domain/personas'

/**
 * The model call: the Anthropic Messages API over `fetch`, with the app's tools and a loop that runs them until the
 * model answers. Plain `fetch` keeps it small and testable in node (no SDK in the browser bundle).
 */
export interface ClaudeConfig {
  apiKey: string
  model: string
  endpoint?: string
  fetch?: typeof fetch
}

export const DEFAULT_MODEL = 'claude-sonnet-5-5'
export const ENDPOINT = 'https://api.anthropic.com/v1/messages'
export const MAX_TURNS = 5
const MAX_TOKENS = 900

export type FailureCode = 'auth' | 'rate' | 'network' | 'bad'
export class ConciergeError extends Error {
  readonly code: FailureCode
  constructor(code: FailureCode, message: string) {
    super(message)
    this.code = code
  }
}

/** The instructions. Grounding and the handoff rules live here as well as in `guard.ts`, which stops the worst cases before a model is asked. */
export function systemPrompt(ctx: Context): string {
  const me = personaById(ctx.personaId)
  return [
    'You are the concierge in a concept app for a Princess-style cruise. You are an AI, not a person, and you say so if asked.',
    `The guest is ${me?.name ?? 'a guest'}. Today in the app is ${new Date(ctx.now).toISOString().slice(0, 10)}.`,
    'Answer only from the tools. If the tools do not hold a fact, say you do not know and point to Guest Services. Never invent prices, times or availability.',
    'The app has one cruise: 7 nights, Western Caribbean, Sun Princess from Fort Lauderdale. If asked about anything else, say so plainly.',
    'You cannot book, pay, cancel or change anything. When the guest wants to book, send them to the booking steps.',
    'Do not give medical, legal or safety advice. For those, and for emergencies, tell the guest to call Guest Services (the 24-hour number is on the Contact screen) or, on board, to use the Help button.',
    'Be brief and plain: short sentences, no markdown headings, bullet points with "•" at most. Prices are US dollars.',
  ].join('\n')
}

type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
interface Turn { role: 'user' | 'assistant'; content: string | Block[] }

const failure = (status: number): ConciergeError =>
  status === 401 || status === 403 ? new ConciergeError('auth', 'The key was refused.') : status === 429 ? new ConciergeError('rate', 'Too many requests.') : new ConciergeError('bad', `The service answered ${status}.`)

/** Asks the model, running tools as it calls them; throws ConciergeError when it cannot get an answer. */
export async function askClaude(cfg: ClaudeConfig, history: readonly ChatMessage[], ctx: Context): Promise<Reply> {
  const send = cfg.fetch ?? fetch
  const turns: Turn[] = history.slice(-MAX_CONTEXT).map((m) => ({ role: m.role, content: m.text }))
  const citations: Citation[] = []
  for (let n = 0; n < MAX_TURNS; n++) {
    let res: Response
    try {
      res = await send(cfg.endpoint ?? ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: cfg.model, max_tokens: MAX_TOKENS, system: systemPrompt(ctx), tools: TOOLS, messages: turns }),
      })
    } catch {
      throw new ConciergeError('network', 'Could not reach the service.')
    }
    if (!res.ok) throw failure(res.status)
    const body = (await res.json()) as { content?: Block[]; stop_reason?: string }
    const blocks = body.content ?? []
    const uses = blocks.filter((b): b is Extract<Block, { type: 'tool_use' }> => b.type === 'tool_use')
    if (body.stop_reason !== 'tool_use' || uses.length === 0) {
      const text = blocks.filter((b): b is Extract<Block, { type: 'text' }> => b.type === 'text').map((b) => b.text).join('').trim()
      if (!text) throw new ConciergeError('bad', 'An empty answer.')
      return { text, citations: dedupe(citations), source: 'claude' }
    }
    turns.push({ role: 'assistant', content: blocks })
    const results: Block[] = uses.map((u) => {
      const r = runTool(u.name, u.input ?? {}, ctx)
      citations.push(...r.citations)
      return { type: 'tool_result', tool_use_id: u.id, content: r.content, ...(r.isError ? { is_error: true } : {}) }
    })
    turns.push({ role: 'user', content: results })
  }
  throw new ConciergeError('bad', 'Too many steps.')
}

const dedupe = (list: Citation[]): Citation[] => [...new Map(list.map((c) => [c.path, c])).values()].slice(0, 5)
