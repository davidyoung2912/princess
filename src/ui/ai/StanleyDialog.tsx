import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { Link } from 'react-router'
import stanley from '../../assets/stanley-small.png'
import { MAX_MESSAGE } from '../../ai/guard'
import { askStanley, getStanleyThread, setStanleyThread, stanleyProblem, subscribeStanley, type StanleyMessage, type StanleyTurn } from '../../ai/stanley'
import { EMERGENCY_NUMBER, GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { t, type StringKey } from '../../i18n'
import { sendStanley } from '../../runtime'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
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

/**
 * Stanley, the cruise chat helper (docs/stanley-plan.md): a dialog with his picture, a log, a typing indicator and one box. The server does the filtering and answering;
 * the conversation is kept in memory only, so closing the dialog keeps it and a refresh clears it.
 */
export function StanleyDialog({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const messages = useSyncExternalStore(subscribeStanley, getStanleyThread, getStanleyThread)
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }) }, [messages.length, busy])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const p = stanleyProblem(draft)
    if (p) { setProblem(t(`stanley.problem.${p}` as StringKey, { max: MAX_MESSAGE })); return }
    setProblem(null)
    const at = Date.now()
    const asked: StanleyMessage = { id: `u-${at}-${messages.length}`, role: 'user', text: draft.trim(), at }
    const withUser = [...getStanleyThread(), asked]
    setStanleyThread(withUser)
    setDraft('')
    setBusy(true)
    const turn = await askStanley(sendStanley, withUser)
    const reply: StanleyMessage = { id: `a-${at}-${withUser.length}`, role: 'assistant', text: wording(turn), at: Date.now(), kind: turn.kind, handoff: turn.handoff, fallback: turn.fallback }
    setStanleyThread([...getStanleyThread(), reply])
    setBusy(false)
  }

  return (
    <Dialog title={t('stanley.title')} onClose={onClose}>
      <div className="stanley__head">
        <img src={stanley} alt="" width="192" height="192" />
        <p className="muted">{t('stanley.subtext')}</p>
      </div>
      <p className="muted">{t('stanley.label')}</p>
      {messages.length === 0 ? (
        <div>
          <p>{t('stanley.empty')}</p>
          <ul className="plain-bullets">{(['stanley.try.1', 'stanley.try.2', 'stanley.try.3'] as const).map((k) => <li key={k}><button type="button" className="link-button" onClick={() => setDraft(t(k))}>{t(k)}</button></li>)}</ul>
        </div>
      ) : (
        <ol className="ai-log stanley__log" role="log" aria-live="polite" aria-label={t('stanley.log')}>
          {messages.map((m) => (
            <li key={m.id} className={`ai-msg ai-msg--${m.role}`}>
              <p className="ai-msg__who">{m.role === 'user' ? t('stanley.you') : t('stanley.from')}</p>
              <p className="ai-msg__text">{m.text}</p>
              {m.kind === 'handoff' && <p className="ai-msg__cites"><Link to="/chat" onClick={onClose}>{t('route.chat')}</Link></p>}
            </li>
          ))}
        </ol>
      )}
      {busy && <p role="status" className="muted stanley__typing"><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><span className="visually-hidden">{t('stanley.typing')}</span></p>}
      <div ref={end} />
      <form onSubmit={(e) => void submit(e)} noValidate>
        <TextArea label={t('stanley.ask')} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX_MESSAGE + 100} />
        {problem && <p role="alert" className="field__error">{problem}</p>}
        <div className="button-row">
          <Button type="submit" disabled={busy}>{t('stanley.send')}</Button>
        </div>
      </form>
    </Dialog>
  )
}
