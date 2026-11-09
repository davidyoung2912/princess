import { parseExcursionRequest, parseItemRequest, SHIP_FACTS, type ShipFact } from '../domain/finishMore'

/**
 * One front door (SG7, theme 3.10). Stanley is the only assistant a guest has to find. The device decides only what it can without a server:
 *  - `act`: the guest asks for something to be changed, ordered or added. Stanley never does it in the chat: it opens "Ask your cruise", which shows a preview and acts only on confirm.
 *    (This word list goes in phase 5, when the server prepares and confirms actions.)
 *  - `ship`: a ship fact from authored content, free and instant.
 *  - `server`: everything else. The server's gateway picks the source (the guest's own booking, the facts for someone still choosing, or the open model).
 */
export type StanleyRoute = { kind: 'act' } | { kind: 'ship'; fact: ShipFact } | { kind: 'server' }

/** Where an answer came from, shown under it. `library` is the authored Q&A, which costs nothing. `trip`, `before` and `model` are the server's routes. */
export type StanleySource = 'library' | 'ship' | 'trip' | 'before' | 'model'

const CHANGE_WORDS = /\b(move|change|shift|push|skip|drop|cancel|remove|add)\b/i
/** A request that would change, order or add something: always previewed and confirmed, never done from the chat. */
export const isActionRequest = (q: string): boolean => CHANGE_WORDS.test(q) || !!parseItemRequest(q) || !!parseExcursionRequest(q)

const words = (q: string): string[] => q.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2)

/** The ship fact a question clearly asks about: two keywords, or one when the guest says "ship". A single loose word like "next" or "tour" is left to the server. */
export function shipFactFor(question: string): ShipFact | null {
  const w = words(question)
  const best = SHIP_FACTS.map((f) => ({ f, n: f.keywords.filter((k) => w.includes(k)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)[0]
  if (!best) return null
  return best.n >= 2 || (best.n === 1 && (w.includes('ship') || w.includes('boat'))) ? best.f : null
}

/** Picks what the device can answer or hand on for a question the authored library did not answer. The safety screen has already run. */
export function routeQuestion(question: string, hasBooking: boolean, actionsOn = true): StanleyRoute {
  const q = question.trim()
  if (actionsOn && hasBooking && isActionRequest(q)) return { kind: 'act' }
  const fact = shipFactFor(q)
  if (fact) return { kind: 'ship', fact }
  return { kind: 'server' }
}

/** The path that carries a question to "Ask your cruise" so the guest can confirm it there. */
export const actPath = (question: string): string => `/home/ask?q=${encodeURIComponent(question.trim().slice(0, 200))}`

/** Questions that are really for the people on the booking: who, shall we, everyone. */
const GROUP_WORDS = /\b(who (is|will|are|'s)|shall we|should we|do we|are we|everyone|everybody|all of us|the group|who wants)\b/i
export const groupable = (question: string): boolean => GROUP_WORDS.test(question)

/** The path that carries a question to the group poll, filled in but not created. */
export const groupPath = (question: string): string => `/plan/group-poll?q=${encodeURIComponent(question.trim().slice(0, 80))}`

export interface AnswerAction { label: string; path: string }

/** Buttons under an answer (an "answer card"): the screens it came from, a way on, and the group when the question is for the group or could not be answered. At most three. */
export function answerActions(a: { source?: StanleySource; link?: string; citations?: readonly { label: string; path: string }[]; answered: boolean; question: string }, labels: { open: (name: string) => string; show: string; group: string }): AnswerAction[] {
  const out: AnswerAction[] = []
  if (a.link) out.push({ label: labels.show, path: a.link })
  for (const c of a.citations ?? []) if (out.length < 2 && !out.some((o) => o.path === c.path)) out.push({ label: labels.open(c.label), path: c.path })
  if (a.question && (!a.answered || groupable(a.question))) out.push({ label: labels.group, path: groupPath(a.question) })
  return out.slice(0, 3)
}
