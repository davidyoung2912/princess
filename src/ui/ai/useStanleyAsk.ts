import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router'
import { MAX_MESSAGE, screen } from '../../ai/guard'
import { awayAnswer, awayTopic } from '../../ai/stanleyAway'
import { useAwayFacts } from '../../hooks/useAwayFacts'
import { clockHhmm, planSnapshot, type ActionContext } from '../../ai/stanleyAction'
import { decideStanley } from '../../ai/stanleyDecide'
import { answerOf } from '../../ai/stanleyLibrary'
import { savedFacts } from '../../feeds/stanleyFacts'
import { answerActions, type StanleySource } from '../../ai/stanleyRoute'
import { assistantMobility } from '../../domain/bookingPrep'
import { useMemory } from '../../hooks/useMemory'
import { countTier, type Tier } from '../../diagnostics/stanleyTiers'
import { getContext, subscribeContext } from '../../account/context'
import { useSailing } from '../../hooks/useDemo'
import { useCurrentDay, useDayPlan } from '../../hooks/useDayPlan'
import { useOnboardToday } from '../../hooks/useOnboardToday'
import { shipZoneAt } from '../../domain/sailings'
import { useSettings } from '../../hooks/useSettings'
import { stanleyLevelFor } from '../../settings/settings'
import { screenForPath } from '../../routes/screens'
import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { askStanley, cooldownSeconds, getStanleyStatus, getStanleyThread, loadStanleyStatus, revealSteps, setStanleyThread, stanleyProblem, subscribeStanley, type StanleyMessage, type StanleyTurn } from '../../ai/stanley'
import { EMERGENCY_NUMBER, GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { t, type StringKey } from '../../i18n'
import { useVisibleInterval } from '../../hooks/useVisibleInterval'
import { fetchStanleyStatus, sendStanley } from '../../runtime'

/** Stanley's own wording for a reply; only an answer carries text from the server. */
function wording(turn: StanleyTurn): string {
  switch (turn.kind) {
    case 'answer': return turn.text
    case 'blocked': return t('stanley.blocked')
    case 'offtopic': return t('stanley.offtopic')
    case 'handoff': return t(`ai.handoff.${turn.handoff ?? 'person'}` as StringKey, { phone: GUEST_SERVICES_NUMBER, emergency: EMERGENCY_NUMBER })
    case 'unavailable': return t(`stanley.unavailable.${turn.fallback ?? 'bad'}` as StringKey)
    default: return t('stanley.unreachable')
  }
}

/** Whether a question is waiting for its answer. Kept outside the hook so the Stanley chat's history can show the waiting dots where the answer will land. */
let waiting = false
const waitingListeners = new Set<() => void>()
const setBusy = (on: boolean) => { waiting = on; waitingListeners.forEach((fn) => fn()) }
export const useStanleyBusy = (): boolean => useSyncExternalStore((fn) => { waitingListeners.add(fn); return () => { waitingListeners.delete(fn) } }, () => waiting, () => waiting)

/**
 * Asking Stanley, shared by his dialog and the Stanley chat page so a question can be asked and answered where the guest already is.
 * The thread is the in-memory one both show; `submit` adds the question, waits (busy shows the typing dots) and adds the answer.
 */
export function useStanleyAsk() {
  const { stage } = useJourneyPosition()
  const hasBooking = !!useSyncExternalStore(subscribeContext, getContext, getContext)?.booking
  const sailing = useSailing()
  const dayPlan = useDayPlan(useCurrentDay())
  const allAboardAt = useOnboardToday(hasBooking).data?.portDay?.state.at ?? null
  const [settings] = useSettings()
  // While the guest is off the ship Stanley answers on the phone, about the port and getting back, and never calls the server.
  const awayFacts = useAwayFacts()
  const screenId = screenForPath(useLocation().pathname)?.id
  const { state: mem } = useMemory()
  const [problem, setProblem] = useState<string | null>(null)
  const busy = useStanleyBusy()
  const [reveal, setReveal] = useState<{ id: string; steps: string[]; i: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const messages = useSyncExternalStore(subscribeStanley, getStanleyThread, getStanleyThread)
  const status = useSyncExternalStore(subscribeStanley, getStanleyStatus, getStanleyStatus)
  useEffect(() => { void loadStanleyStatus(fetchStanleyStatus) }, [])
  // Keep the trip facts on this phone while there is a signal, so they can be shown when there is none.
  useEffect(() => { if (hasBooking) void savedFacts.load() }, [hasBooking])
  const cooldown = cooldownSeconds(messages, now)
  useVisibleInterval(() => setNow(Date.now()), 1000, cooldown > 0)
  useVisibleInterval(() => setReveal((r) => (r && r.i + 1 < r.steps.length ? { ...r, i: r.i + 1 } : null)), 80, reveal !== null)

  const submit = async (text: string, onAccepted?: () => void) => {
    if (busy) return
    setNow(Date.now())
    if (cooldownSeconds(getStanleyThread(), Date.now())) return
    const p = stanleyProblem(text)
    if (p === 'empty') return
    if (p) { setProblem(t(`stanley.problem.${p}` as StringKey, { max: MAX_MESSAGE })); return }
    setProblem(null)
    const at = Date.now()
    const asked: StanleyMessage = { id: `u-${at}-${messages.length}`, role: 'user', text: text.trim(), at }
    const withUser = [...getStanleyThread(), asked]
    setStanleyThread(withUser)
    onAccepted?.()
    // Away from the ship: the safety screen still comes first (an emergency goes to the handoff below); anything else is answered here, from what the app holds.
    if (awayFacts && !screen(asked.text)) {
      const topic = awayTopic(asked.text)
      setStanleyThread([...withUser, { id: `a-${at}-${withUser.length}`, role: 'assistant', text: awayAnswer(topic, awayFacts, t as (k: string, p?: Record<string, string | number>) => string), at: Date.now(), kind: 'answer' }])
      countTier('library', `away:${topic ?? 'none'}`)
      setNow(Date.now())
      return
    }
    setBusy(true)
    // One front door: the authored library first (free, on the device), then a ship fact; everything else, including a request to change something, goes to the server's gateway, which picks the source or prepares a preview.
    // The safety screen comes first, so an emergency is never answered from a library or a model. The server's switch can turn the library off.
    const decision = decideStanley(asked.text, { stage, libraryOn: status.library })
    const known = decision.kind === 'library' ? decision.entry : null
    const route = decision.kind === 'ship' ? decision : null
    let source: StanleySource = 'model'
    let link: string | undefined
    let entryId: string | undefined
    let turn: StanleyTurn
    const id = `a-${at}-${withUser.length}`
    if (known) { source = 'library'; link = known.link; entryId = known.id; turn = { kind: 'answer', text: answerOf(known), handoff: null, fallback: null } }
    else if (route?.kind === 'ship') { source = 'ship'; turn = { kind: 'answer', text: route.fact.a, handoff: null, fallback: null } }
    else {
      // The server turns a request to change something into a typed preview; it needs today's plan and the all-aboard time to name an item or a reminder's basis.
      const actionContext: ActionContext = { plan: hasBooking && dayPlan.ready ? planSnapshot(dayPlan.rows, dayPlan.alternatives, dayPlan.day) : [], sailingId: sailing.id }
      if (allAboardAt !== null) actionContext.allAboard = { at: clockHhmm(allAboardAt, shipZoneAt(sailing, allAboardAt)), label: 'ship time' }
      turn = await askStanley(sendStanley, withUser, { context: { stage, screen: screenId, sailingId: sailing.id, level: stanleyLevelFor(settings) }, mobility: assistantMobility(mem.access), actionContext })
      if (turn.tier === 'trip' || turn.tier === 'before') source = turn.tier
      else if (turn.tier === 'resolver' || turn.tier === 'action') source = 'trip'
    }
    const citations = turn.citations ?? []
    const answered = turn.kind === 'answer' && !(turn.fallback && source !== 'model')
    const actions = [...answerActions({ source, link, citations, answered, question: asked.text }, { open: (name) => t('stanley.open', { name }), show: t('stanley.show'), group: t('stanley.group') })].slice(0, 3)
    const tier: Tier = turn.kind === 'handoff' ? 'handoff' : turn.kind === 'answer' && answered ? source : 'unanswered'
    countTier(tier, known ? `library:${known.id}` : route?.kind === 'ship' ? `ship:${route.fact.id}` : undefined)
    const saved = turn.kind === 'unreachable' && turn.fallback === 'network' && hasBooking ? savedFacts.now() ?? [] : []
    const reply: StanleyMessage = { id, role: 'assistant', text: saved.length > 0 ? t('stanley.offline.saved') : wording(turn), saved: saved.length > 0 ? saved : undefined, at: Date.now(), kind: turn.kind, handoff: turn.handoff, fallback: turn.fallback, source: turn.kind === 'answer' ? source : undefined, citations, card: turn.card ?? undefined, action: turn.action ?? undefined, actions, entryId }
    setStanleyThread([...getStanleyThread(), reply])
    setNow(Date.now())
    setBusy(false)
    // An answer appears a few words at a time, as if it were arriving; with reduced motion it simply appears.
    if (turn.kind !== 'answer' || turn.card || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    setReveal({ id: reply.id, steps: revealSteps(reply.text), i: 0 })
  }

  return { submit, busy, problem, setProblem, reveal, cooldown, messages, status, stage, screenId, awayFacts }
}
