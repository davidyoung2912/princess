import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { Link } from 'react-router'
import stanley from '../../assets/stanley-small.png'
import { MAX_MESSAGE, screen } from '../../ai/guard'
import { answerOf, LIBRARY, matchQuestion, questionOf, type LibraryEntry } from '../../ai/stanleyLibrary'
import { followUps } from '../../ai/stanleyFollow'
import { StanleyConfirm } from './StanleyConfirm'
import { ask } from '../../ai/concierge'
import { answerActions, routeQuestion, type StanleySource } from '../../ai/stanleyRoute'
import type { Citation } from '../../ai/types'
import { assistantMobility } from '../../domain/bookingPrep'
import { useMemory } from '../../hooks/useMemory'
import { countTier, type Tier } from '../../diagnostics/stanleyTiers'
import { getContext, subscribeContext } from '../../account/context'
import { useNow, usePersona, useSailing } from '../../hooks/useDemo'
import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { askStanley, cooldownSeconds, getStanleyThread, revealSteps, setStanleyThread, stanleyProblem, subscribeStanley, type StanleyMessage, type StanleyTurn } from '../../ai/stanley'
import { EMERGENCY_NUMBER, GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { t, type StringKey } from '../../i18n'
import { useVisibleInterval } from '../../hooks/useVisibleInterval'
import { sendConcierge, sendStanley } from '../../runtime'
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
      {items.map((e) => <li key={e.id}><button type="button" className="stanley__chip" onClick={() => onPick(questionOf(e))}>{questionOf(e)}</button></li>)}
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
  const me = usePersona()
  const sailing = useSailing()
  const demoNow = useNow()
  const { state: mem } = useMemory()
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reveal, setReveal] = useState<{ id: string; steps: string[]; i: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const end = useRef<HTMLLIElement>(null)
  const messages = useSyncExternalStore(subscribeStanley, getStanleyThread, getStanleyThread)
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
    // One front door: the authored library first (free), then the source that fits the question. The safety screen comes first, so an emergency is never answered from a library or a model.
    const blocked = screen(asked.text)
    const known = blocked ? null : matchQuestion(asked.text, stage)
    const route = blocked || known ? null : routeQuestion(asked.text, stage, hasBooking)
    let source: StanleySource = 'model'
    let citations: Citation[] = []
    let link: string | undefined
    let confirm: string | undefined
    let entryId: string | undefined
    let turn: StanleyTurn
    const id = `a-${at}-${withUser.length}`
    if (known) { source = 'library'; link = known.link; entryId = known.id; turn = { kind: 'answer', text: answerOf(known), handoff: null, fallback: null } }
    else if (route?.kind === 'act') { source = 'trip'; confirm = asked.text; turn = { kind: 'answer', text: t('stanley.act'), handoff: null, fallback: null } }
    else if (route?.kind === 'ship') { source = 'ship'; turn = { kind: 'answer', text: route.fact.a, handoff: null, fallback: null } }
    else if (route && (route.kind === 'trip' || route.kind === 'before') && me) {
      source = route.kind
      const c = await ask(sendConcierge, [{ id: asked.id, role: 'user', text: asked.text, at }], { sailingId: sailing.id, personaId: me.id, now: demoNow, mobility: assistantMobility(mem.access) })
      citations = c.reply.citations
      turn = c.handoff ? { kind: 'handoff', text: '', handoff: c.handoff, fallback: null } : { kind: 'answer', text: c.reply.text, handoff: null, fallback: c.fallback }
    } else turn = await askStanley(sendStanley, withUser)
    const answered = turn.kind === 'answer' && !(turn.fallback && source !== 'model')
    const actions = [...answerActions({ source, link, citations, answered, question: asked.text }, { open: (name) => t('stanley.open', { name }), show: t('stanley.show'), group: t('stanley.group') })].slice(0, 3)
    const tier: Tier = turn.kind === 'handoff' ? 'handoff' : turn.kind === 'answer' && answered ? source : 'unanswered'
    countTier(tier)
    const reply: StanleyMessage = { id, role: 'assistant', text: wording(turn), at: Date.now(), kind: turn.kind, handoff: turn.handoff, fallback: turn.fallback, source: turn.kind === 'answer' ? source : undefined, citations, actions, confirm, entryId }
    setStanleyThread([...getStanleyThread(), reply])
    setNow(Date.now())
    setBusy(false)
    // An answer appears a few words at a time, as if it were arriving; with reduced motion it simply appears.
    if (turn.kind !== 'answer' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    setReveal({ id: reply.id, steps: revealSteps(reply.text), i: 0 })
  }


  const pick = (question: string) => { void submit(null, question) }

  return (
    <Dialog title={t('stanley.title')} onClose={onClose} header={(titleId) => (
      <DialogHeader titleId={titleId} title={t('stanley.title')} subtext={t('stanley.label')} onClose={onClose}
        image={<img className="stanley__avatar" src={stanley} alt="" width="192" height="192" />} />
    )}>
      <div className="stanley">
        {messages.length === 0 ? (
          <div className="stanley__empty">
            <p>{t('stanley.empty')}</p>
            <ul className="stanley__tries">{(['stanley.try.1', 'stanley.try.2', 'stanley.try.3'] as const).map((k) => <li key={k}><button type="button" className="link-button" onClick={() => setDraft(t(k))}>{t(k)}</button></li>)}</ul>
          </div>
        ) : (
          <ol className="ai-log stanley__log" role="log" aria-live="polite" aria-label={t('stanley.log')}>
            {messages.map((m) => (
              <li key={m.id} className={`ai-msg ai-msg--${m.role}`}>
                <p className="ai-msg__who">{m.role === 'user' ? t('stanley.you') : t('stanley.from')}</p>
                <p className="ai-msg__text">{reveal?.id === m.id ? reveal.steps[reveal.i] : m.text}</p>
                {m.source && <p className="ai-msg__cites muted">{t(`stanley.source.${m.source}` as StringKey, { time: new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })}</p>}
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
        {busy && <p role="status" className="muted stanley__typing"><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><span className="visually-hidden">{t('stanley.typing')}</span></p>}
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
