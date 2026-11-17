import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import stanley from '../../assets/stanley-small.png'
import { MAX_MESSAGE } from '../../ai/guard'
import { AWAY_CHIPS } from '../../ai/stanleyAway'
import { type StanleyAction } from '../../ai/stanleyAction'
import { LIBRARY, questionOf, type LibraryEntry } from '../../ai/stanleyLibrary'
import { followUps } from '../../ai/stanleyFollow'
import { StanleyActionCard } from './StanleyActionCard'
import { HandoffCard } from './HandoffCard'
import { HandoffCases } from './HandoffCases'
import { CrewCards } from './CrewCards'
import { StanleyAnswerCard } from './StanleyAnswerCard'
import { WhyThis } from './WhyThis'
import { cardText, explainScreenCard } from '../../ai/stanleyCard'
import { asSaved } from '../../feeds/stanleyFacts'
import { countTier } from '../../diagnostics/stanleyTiers'
import { getStanleyThread, setStanleyThread, type StanleyMessage } from '../../ai/stanley'
import { t, type StringKey } from '../../i18n'
import { Button, LinkButton } from '../Button'
import { useStanleyAsk } from './useStanleyAsk'
import { Dialog } from '../Dialog'
import { DialogHeader } from '../DialogHeader'
import { TextArea } from '../Field'
import { PocketPanel, ReadAloud } from './StanleyVoice'
import { cardSpeech } from '../../ai/stanleyVoice'

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
  const { submit: ask, busy, problem, reveal, cooldown, messages, status, stage, screenId, awayFacts } = useStanleyAsk()
  const [help, setHelp] = useState<'person' | 'crew' | 'pocket' | null>(null)
  const end = useRef<HTMLLIElement>(null)
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }) }, [messages.length, busy, reveal?.i])
  const lastAnswer = [...messages].reverse().find((m) => m.role === 'assistant')
  const follow = lastAnswer && lastAnswer.kind === 'answer' && !lastAnswer.action && cooldown === 0
    ? followUps(stage, messages.filter((m) => m.role === 'user').map((m) => m.text), LIBRARY.find((e) => e.id === lastAnswer.entryId))
    : []

  const submit = (e: FormEvent | null, text = draft) => {
    e?.preventDefault()
    return ask(text, () => setDraft(''))
  }


  const updateAction = (id: string, next: StanleyAction) => setStanleyThread(getStanleyThread().map((m) => (m.id === id ? { ...m, action: next } : m)))

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
            <p>{awayFacts ? t('away.mode') : t('stanley.empty')}</p>
            {awayFacts && <ul className="stanley__tries">{AWAY_CHIPS.map((c) => <li key={c}><button type="button" className="link-button" onClick={() => pick(t(`away.chip.${c}` as StringKey))}>{t(`away.chip.${c}` as StringKey)}</button></li>)}</ul>}
            {!awayFacts && <ul className="stanley__tries">{(['stanley.try.1', 'stanley.try.2', 'stanley.try.3'] as const).map((k) => <li key={k}><button type="button" className="link-button" onClick={() => setDraft(t(k))}>{t(k)}</button></li>)}</ul>}
          </div>
        ) : (
          <ol className="ai-log stanley__log" role="log" aria-live="polite" aria-label={t('stanley.log')}>
            {messages.map((m) => (
              <li key={m.id} className={`ai-msg ai-msg--${m.role}`}>
                <p className="ai-msg__who">{m.role === 'user' ? t('stanley.you') : t('stanley.from')}</p>
                {m.card ? <StanleyAnswerCard card={m.card} onNavigate={onClose} /> : <p className="ai-msg__text">{reveal?.id === m.id ? reveal.steps[reveal.i] : m.text}</p>}
                {m.role === 'assistant' && (m.card || m.text) && <p className="stanley__actions"><ReadAloud text={m.card ? cardSpeech(m.card, { abstained: t('stanley.read.abstained'), cached: t('stanley.read.cached') }) : m.text} /></p>}
                {m.saved?.map((c) => <StanleyAnswerCard key={c.id} card={asSaved(c, t('stanley.offline.note'))} onNavigate={onClose} />)}
                {m.source && !m.card && <p className="ai-msg__cites muted">{t(`stanley.source.${m.source}` as StringKey, { time: new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })}</p>}
                {m.actions && m.actions.length > 0 && <p className="stanley__actions">{m.actions.map((a) => <LinkButton key={a.path} variant="secondary" to={a.path} onClick={onClose}>{a.label}</LinkButton>)}</p>}
                {m.action && <StanleyActionCard action={m.action} onChange={(next) => updateAction(m.id, next)} onNavigate={onClose} />}
                {m.id === lastAnswer?.id && !busy && follow.length > 0 && (
                  <FollowChips items={follow} onPick={pick} />
                )}
                {m.kind === 'handoff' && <p className="ai-msg__cites"><Link to="/chat" onClick={onClose}>{t('route.chat')}</Link></p>}
                {m.kind === 'handoff' && m.id === lastAnswer?.id && <HandoffCard messages={messages} />}
              </li>
            ))}
            <li ref={end} aria-hidden="true" />
          </ol>
        )}
        {awayFacts && messages.length > 0 && <p role="status" className="muted stanley__note">{t('away.mode')}</p>}
        {status.degraded.length > 0 && <p role="status" className="muted stanley__note">{t('stanley.degraded')}</p>}
        {busy && <p role="status" className="muted stanley__typing"><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><span className="visually-hidden">{t('stanley.typing')}</span></p>}
        <p className="stanley__explain">
          <button type="button" className="link-button" onClick={explain} disabled={busy}>{t('stanley.explain.screen')}</button>{' · '}
          <button type="button" className="link-button" aria-expanded={help === 'person'} onClick={() => setHelp(help === 'person' ? null : 'person')}>{t('handoff.open')}</button>{' · '}
          <button type="button" className="link-button" aria-expanded={help === 'crew'} onClick={() => setHelp(help === 'crew' ? null : 'crew')}>{t('crew.open')}</button>{' · '}
          <button type="button" className="link-button" aria-expanded={help === 'pocket'} onClick={() => setHelp(help === 'pocket' ? null : 'pocket')}>{t('stanley.pocket.open')}</button>
        </p>
        {help === 'person' && !(lastAnswer?.kind === 'handoff') && <HandoffCard messages={messages} initialTopic="person" />}
        {help === 'crew' && <CrewCards />}
        {help === 'pocket' && <PocketPanel />}
        <HandoffCases />
        <form className="stanley__form" onSubmit={(e) => void submit(e)} noValidate>
          <TextArea label={t('stanley.ask')} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX_MESSAGE + 100} rows={3} />
          <Button type="submit" disabled={busy || cooldown > 0}>{t('stanley.send')}</Button>
        </form>
        {cooldown > 0 && <p role="status" className="muted stanley__note">{t('stanley.cooldown', { seconds: cooldown })}</p>}
        {problem && <p role="alert" className="field__error stanley__note">{problem}</p>}
      </div>
    </Dialog>
  )
}
