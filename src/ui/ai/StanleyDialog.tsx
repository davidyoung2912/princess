import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import stanley from '../../assets/stanley-small.png'
import { MAX_MESSAGE } from '../../ai/guard'
import { decideStanley } from '../../ai/stanleyDecide'
import { answerOf, LIBRARY, questionOf, type LibraryEntry } from '../../ai/stanleyLibrary'
import { followUps } from '../../ai/stanleyFollow'
import { StanleyConfirm } from './StanleyConfirm'
import { StanleyAnswerCard } from './StanleyAnswerCard'
import { WhyThis } from './WhyThis'
import { cardText, explainScreenCard } from '../../ai/stanleyCard'
import { answerActions, type StanleySource } from '../../ai/stanleyRoute'
import { assistantMobility } from '../../domain/bookingPrep'
import { useMemory } from '../../hooks/useMemory'
import { countTier, type Tier } from '../../diagnostics/stanleyTiers'
import { getContext, subscribeContext } from '../../account/context'
import { useSailing } from '../../hooks/useDemo'
import { useSettings } from '../../hooks/useSettings'
import { stanleyLevelFor } from '../../settings/settings'
import { screenForPath } from '../../routes/screens'
import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { askStanley, cooldownSeconds, getStanleyStatus, getStanleyThread, loadStanleyStatus, revealSteps, setStanleyThread, stanleyProblem, subscribeStanley, type StanleyMessage, type StanleyTurn } from '../../ai/stanley'
import { EMERGENCY_NUMBER, GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { t, type StringKey } from '../../i18n'
import { useVisibleInterval } from '../../hooks/useVisibleInterval'
import { fetchStanleyStatus, sendStanley } from '../../runtime'
import { Button, LinkButton } from '../Button'
import { Dialog } from '../Dialog'
import { DialogHeader } from '../DialogHeader'
import { TextArea } from '../Field'

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

function FollowChips({ items, onPick }: { items: readonly LibraryEntry[]; onPick: (question: string) => void }) {
  return (
    <ul className="stanley__follow" aria-label={t('stanley.follow')}>
      {items.map((e) => <li key={e.id}><button type="button" className="stanley__chip" onClick={() => onPick(questionOf(e))}>{questionOf(e)}</button><WhyThis kind="chip" fact={t('stanley.why.fact.follow')} what={questionOf(e)} /></li>)}
    </ul>
  )
}

/**
 * Stanley, the cruise chat helper (docs/stanley-plan.md): a dialog with his picture, a log, a typing indicator and one box. The server does the filtering and answering;
 * the conversation is kept in memory only, so closing the dialog keeps it and a refresh clears it.
 */
export function StanleyDialog({ onClose, prefill = '' }: { onClose: () => void; prefill?: string }) {
  const [draft, setDraft] = useState(prefill.slice(0, MAX_MESSAGE))
  const { stage } = useJourneyPosition()
  const hasBooking = !!useSyncExternalStore(subscribeContext, getContext, getContext)?.booking
  const sailing = useSailing()
  const [settings] = useSettings()
  const screenId = screenForPath(useLocation().pathname)?.id
  const { state: mem } = useMemory()
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reveal, setReveal] = useState<{ id: string; steps: string[]; i: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const end = useRef<HTMLLIElement>(null)
  const messages = useSyncExternalStore(subscribeStanley, getStanleyThread, getStanleyThread)
  const status = useSyncExternalStore(subscribeStanley, getStanleyStatus, getStanleyStatus)
  useEffect(() => { void loadStanleyStatus(fetchStanleyStatus) }, [])
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }) }, [messages.length, busy, reveal?.i])
  const lastAnswer = [...messages].reverse().find((m) => m.role === 'assistant')
  const follow = lastAnswer && lastAnswer.kind === 'answer' && !lastAnswer.confirm && cooldownSeconds(messages, now) === 0
    ? followUps(stage, messages.filter((m) => m.role === 'user').map((m) => m.text), LIBRARY.find((e) => e.id === lastAnswer.entryId))
    : []
  const cooldown = cooldownSeconds(messages, now)
  useVisibleInterval(() => setNow(Date.now()), 1000, cooldown > 0)
  useVisibleInterval(() => setReveal((r) => (r && r.i + 1 < r.steps.length ? { ...r, i: r.i + 1 } : null)), 80, reveal !== null)

  const submit = async (e: FormEvent | null, text = draft) => {
    e?.preventDefault()
    if (busy) return
    setNow(Date.now())
    if (cooldownSeconds(getStanleyThread(), Date.now())) return
    const p = stanleyProblem(text)
    if (p) { setProblem(t(`stanley.problem.${p}` as StringKey, { max: MAX_MESSAGE })); return }
    setProblem(null)
    const at = Date.now()
    const asked: StanleyMessage = { id: `u-${at}-${messages.length}`, role: 'user', text: text.trim(), at }
    const withUser = [...getStanleyThread(), asked]
    setStanleyThread(withUser)
    setDraft('')
    setBusy(true)
    // One front door: the authored library first (free, on the device), then a ship fact or an "Ask your cruise" change; everything else goes to the server's gateway, which picks the source.
    // The safety screen comes first, so an emergency is never answered from a library or a model. The server's switches can turn the library or the changes off.
    const decision = decideStanley(asked.text, { stage, hasBooking, libraryOn: status.library, actionsOn: status.actions })
    const known = decision.kind === 'library' ? decision.entry : null
    const route = decision.kind === 'act' || decision.kind === 'ship' ? decision : null
    let source: StanleySource = 'model'
    let link: string | undefined
    let confirm: string | undefined
    let entryId: string | undefined
    let turn: StanleyTurn
    const id = `a-${at}-${withUser.length}`
    if (known) { source = 'library'; link = known.link; entryId = known.id; turn = { kind: 'answer', text: answerOf(known), handoff: null, fallback: null } }
    else if (route?.kind === 'act') { source = 'trip'; confirm = asked.text; turn = { kind: 'answer', text: t('stanley.act'), handoff: null, fallback: null } }
    else if (route?.kind === 'ship') { source = 'ship'; turn = { kind: 'answer', text: route.fact.a, handoff: null, fallback: null } }
    else {
      turn = await askStanley(sendStanley, withUser, { context: { stage, screen: screenId, sailingId: sailing.id, level: stanleyLevelFor(settings) }, mobility: assistantMobility(mem.access) })
      if (turn.tier === 'trip' || turn.tier === 'before') source = turn.tier
      else if (turn.tier === 'resolver') source = 'trip'
    }
    const citations = turn.citations ?? []
    const answered = turn.kind === 'answer' && !(turn.fallback && source !== 'model')
    const actions = [...answerActions({ source, link, citations, answered, question: asked.text }, { open: (name) => t('stanley.open', { name }), show: t('stanley.show'), group: t('stanley.group') })].slice(0, 3)
    const tier: Tier = turn.kind === 'handoff' ? 'handoff' : turn.kind === 'answer' && answered ? source : 'unanswered'
    countTier(tier, known ? `library:${known.id}` : route?.kind === 'ship' ? `ship:${route.fact.id}` : undefined)
    const reply: StanleyMessage = { id, role: 'assistant', text: wording(turn), at: Date.now(), kind: turn.kind, handoff: turn.handoff, fallback: turn.fallback, source: turn.kind === 'answer' ? source : undefined, citations, card: turn.card ?? undefined, actions, confirm, entryId }
    setStanleyThread([...getStanleyThread(), reply])
    setNow(Date.now())
    setBusy(false)
    // An answer appears a few words at a time, as if it were arriving; with reduced motion it simply appears.
    if (turn.kind !== 'answer' || turn.card || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    setReveal({ id: reply.id, steps: revealSteps(reply.text), i: 0 })
  }


  const pick = (question: string) => { void submit(null, question) }

  // "Explain this screen": answered on the device from the page's id and its authored description, so it works offline and costs nothing. It is added to the thread like any answer.
  const explain = () => {
    if (busy) return
    const at = Date.now()
    const card = explainScreenCard(screenId)
    const asked: StanleyMessage = { id: `u-${at}-x`, role: 'user', text: t('stanley.explain.screen'), at }
    const reply: StanleyMessage = card
      ? { id: `a-${at}-x`, role: 'assistant', text: cardText(card), at, kind: 'answer', card }
      : { id: `a-${at}-x`, role: 'assistant', text: t('stanley.explain.screen.none'), at, kind: 'answer' }
    setStanleyThread([...getStanleyThread(), asked, reply])
    countTier('library', `explain:${screenId ?? 'none'}`)
  }

  return (
    <Dialog title={t('stanley.title')} onClose={onClose} header={(titleId) => (
      <DialogHeader titleId={titleId} title={t('stanley.title')} subtext={t('stanley.label')} onClose={onClose}
        image={<img className="stanley__avatar" src={stanley} alt="" width="192" height="192" />} />
    )}>
      <div className="stanley">
        {messages.length === 0 ? (
          <div className="stanley__empty">
            <p>{t('stanley.empty')}</p>
            <ul className="stanley__tries">{(['stanley.try.1', 'stanley.try.2', 'stanley.try.3'] as const).map((k) => <li key={k}><button type="button" className="link-button" onClick={() => setDraft(t(k))}>{t(k)}</button><WhyThis kind="suggestion" fact={t('stanley.why.fact.suggestion')} what={t(k)} /></li>)}</ul>
          </div>
        ) : (
          <ol className="ai-log stanley__log" role="log" aria-live="polite" aria-label={t('stanley.log')}>
            {messages.map((m) => (
              <li key={m.id} className={`ai-msg ai-msg--${m.role}`}>
                <p className="ai-msg__who">{m.role === 'user' ? t('stanley.you') : t('stanley.from')}</p>
                {m.card ? <StanleyAnswerCard card={m.card} onNavigate={onClose} /> : <p className="ai-msg__text">{reveal?.id === m.id ? reveal.steps[reveal.i] : m.text}</p>}
                {m.source && !m.card && <p className="ai-msg__cites muted">{t(`stanley.source.${m.source}` as StringKey, { time: new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })}</p>}
                {m.actions && m.actions.length > 0 && <p className="stanley__actions">{m.actions.map((a) => <LinkButton key={a.path} variant="secondary" to={a.path} onClick={onClose}>{a.label}</LinkButton>)}</p>}
                {m.confirm && <StanleyConfirm question={m.confirm} onNavigate={onClose} />}
                {m.id === lastAnswer?.id && !busy && follow.length > 0 && (
                  <FollowChips items={follow} onPick={pick} />
                )}
                {m.kind === 'handoff' && <p className="ai-msg__cites"><Link to="/chat" onClick={onClose}>{t('route.chat')}</Link></p>}
              </li>
            ))}
            <li ref={end} aria-hidden="true" />
          </ol>
        )}
        {status.degraded.length > 0 && <p role="status" className="muted stanley__note">{t('stanley.degraded')}</p>}
        {busy && <p role="status" className="muted stanley__typing"><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><span className="visually-hidden">{t('stanley.typing')}</span></p>}
        <p className="stanley__explain"><button type="button" className="link-button" onClick={explain} disabled={busy}>{t('stanley.explain.screen')}</button></p>
        <form className="stanley__form" onSubmit={(e) => void submit(e)} noValidate>
          <TextArea label={t('stanley.ask')} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX_MESSAGE + 100} rows={2} />
          <Button type="submit" disabled={busy || cooldown > 0}>{t('stanley.send')}</Button>
        </form>
        {cooldown > 0 && <p role="status" className="muted stanley__note">{t('stanley.cooldown', { seconds: cooldown })}</p>}
        {problem && <p role="alert" className="field__error stanley__note">{problem}</p>}
      </div>
    </Dialog>
  )
}
