import { isMuster, screen, type Handoff } from './guard'
import { matchQuestion, questionOf, type LibraryEntry } from './stanleyLibrary'
import { isLiveOrPersonal, liveLibrary, mentionsRiskTopic, riskOf } from './stanleyLibrary/governance'
import { routeQuestion } from './stanleyRoute'
import type { ShipFact } from '../domain/finishMore'
import type { JourneyStage } from '../routes/hubs'

/** What the device does with a typed question before anything is sent: the safety screen, then the authored library, then a ship fact, else the server (which also prepares any change for the guest to confirm). */
export type StanleyDecision =
  | { kind: 'handoff'; handoff: Handoff }
  | { kind: 'library'; entry: LibraryEntry }
  | { kind: 'ship'; fact: ShipFact }
  | { kind: 'server' }

/** The authored entry that answers every muster question. */
export const MUSTER_ENTRY = 'embark.muster'
const plain = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export interface DecideOptions { stage?: JourneyStage; libraryOn?: boolean; now?: number }

/**
 * The one order the device follows, kept in one place so the dialog and the evaluation set (src/ai/eval) cannot drift apart. An emergency is never answered from a library
 * or a model. A library entry past its expiry date is not used (its fallback is the server), a question on a risk topic is answered only by a high-risk entry, and the server's switch can turn the library off. A request to change something is not decided here: the server reads it into a typed intent.
 */
export function decideStanley(text: string, o: DecideOptions): StanleyDecision {
  const handoff = screen(text)
  if (handoff) {
    // A tapped, authored low-risk question whose only medical word is "seasick" ("What if I get seasick?") is answered by its own entry; anything more ("I am seasick and vomiting") is still a handoff.
    const own = handoff === 'medical' && !screen(text.replace(/seasick\w*/gi, ' ')) ? liveLibrary(o.now ?? Date.now()).find((e) => plain(questionOf(e)) === plain(text) && riskOf(e) === 'low') : undefined
    if (!own || o.libraryOn === false) return { kind: 'handoff', handoff }
    return { kind: 'library', entry: own }
  }
  // The muster drill and life-saving equipment are answered only from the authored safety entry. With it unavailable (expired or switched off) the server's own fixed answer replies.
  if (isMuster(text)) {
    const muster = o.libraryOn === false ? undefined : liveLibrary(o.now ?? Date.now()).find((e) => e.id === MUSTER_ENTRY)
    return muster ? { kind: 'library', entry: muster } : { kind: 'server' }
  }
  const live = o.libraryOn === false ? [] : liveLibrary(o.now ?? Date.now())
  // The authored question itself (a tapped chip) is always answered by its own entry; a typed question that only resembles one is checked against the risk topics.
  const exact = live.find((e) => plain(questionOf(e)) === plain(text))
  const matched = exact ?? matchQuestion(text, o.stage, live)
  const entry = matched && matched !== exact && mentionsRiskTopic(text) && (riskOf(matched) !== 'high' || isLiveOrPersonal(text)) ? null : matched
  if (entry) return { kind: 'library', entry }
  return routeQuestion(text)
}
