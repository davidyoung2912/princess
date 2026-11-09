import { isMuster, screen, type Handoff } from './guard'
import { matchQuestion, questionOf, type LibraryEntry } from './stanleyLibrary'
import { isLiveOrPersonal, liveLibrary, mentionsRiskTopic, riskOf } from './stanleyLibrary/governance'
import { routeQuestion } from './stanleyRoute'
import type { ShipFact } from '../domain/finishMore'
import type { JourneyStage } from '../routes/hubs'

/** What the device does with a typed question before anything is sent: the safety screen, then the authored library, then a ship fact or a change to confirm, else the server. */
export type StanleyDecision =
  | { kind: 'handoff'; handoff: Handoff }
  | { kind: 'library'; entry: LibraryEntry }
  | { kind: 'act' }
  | { kind: 'ship'; fact: ShipFact }
  | { kind: 'server' }

/** The authored entry that answers every muster question. */
export const MUSTER_ENTRY = 'embark.muster'
const plain = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const COMMAND = /^(please\s+|can you\s+|could you\s+|i want to\s+|i need to\s+)?(move|change|shift|push|skip|drop|cancel|remove|add)\b/i

export interface DecideOptions { stage?: JourneyStage; hasBooking: boolean; libraryOn?: boolean; actionsOn?: boolean; now?: number }

/**
 * The one order the device follows, kept in one place so the dialog and the evaluation set (src/ai/eval) cannot drift apart. An emergency is never answered from a library
 * or a model. A library entry past its expiry date is not used (its fallback is the server), a question on a risk topic is answered only by a high-risk entry, and the server's switches can turn the library or the changes off.
 */
export function decideStanley(text: string, o: DecideOptions): StanleyDecision {
  const handoff = screen(text)
  if (handoff) return { kind: 'handoff', handoff }
  // The muster drill and life-saving equipment are answered only from the authored safety entry. With it unavailable (expired or switched off) the server's own fixed answer replies.
  if (isMuster(text)) {
    const muster = o.libraryOn === false ? undefined : liveLibrary(o.now ?? Date.now()).find((e) => e.id === MUSTER_ENTRY)
    return muster ? { kind: 'library', entry: muster } : { kind: 'server' }
  }
  // A plain request to change something goes to "Ask your cruise" for a preview and a confirm, ahead of an explainer that shares a word with it.
  if ((o.actionsOn ?? true) && o.hasBooking && COMMAND.test(text.trim())) return { kind: 'act' }
  const live = o.libraryOn === false ? [] : liveLibrary(o.now ?? Date.now())
  // The authored question itself (a tapped chip) is always answered by its own entry; a typed question that only resembles one is checked against the risk topics.
  const exact = live.find((e) => plain(questionOf(e)) === plain(text))
  const matched = exact ?? matchQuestion(text, o.stage, live)
  const entry = matched && matched !== exact && mentionsRiskTopic(text) && (riskOf(matched) !== 'high' || isLiveOrPersonal(text)) ? null : matched
  if (entry) return { kind: 'library', entry }
  const route = routeQuestion(text, o.hasBooking, o.actionsOn ?? true)
  return route.kind === 'server' ? { kind: 'server' } : route
}
