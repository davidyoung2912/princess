import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ask, askProblem, configFrom } from '../../ai/concierge'
import { clearThread, loadThread, saveThread } from '../../ai/history'
import { MAX_MESSAGE, type Handoff } from '../../ai/guard'
import type { ChatMessage, Citation } from '../../ai/types'
import { EMERGENCY_NUMBER, GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { api, getStore } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useDemo, useNow, usePersona } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Dialog } from '../Dialog'
import { TextArea } from '../Field'
import { BackLink } from '../onboard/common'

const config = configFrom(import.meta.env)

const HANDOFF_LINKS: Record<Handoff, Citation[]> = {
  emergency: [{ label: 'route.emergency', path: '/ship/emergency' }],
  medical: [{ label: 'route.health', path: '/ship/health' }, { label: 'route.contact', path: '/me/contact' }],
  legal: [{ label: 'route.contact', path: '/me/contact' }],
  person: [{ label: 'route.chat', path: '/chat' }, { label: 'route.contact', path: '/me/contact' }],
}

/** A short text of the last messages, sent with a request to Guest Services so the history travels with the guest (SUP-03). */
const transcript = (messages: readonly ChatMessage[]): string =>
  messages.slice(-8).map((m) => `${m.role === 'user' ? 'Guest' : 'Concierge'}: ${m.text}`).join('\n').slice(0, 900)

/** The AI concierge (DIS-09, SUP-03): ask about the cruise, ports, tours, dining and a day plan. It is labelled as AI, answers only from app data, cannot book or pay, and hands emergencies and medical or legal questions to people. */
export function ConciergeScreen() {
  const me = usePersona()
  const demo = useDemo()
  const now = useNow()
  const [thread, setThread] = useState<{ owner: string; messages: ChatMessage[] } | null>(null)
  const [draft, setDraft] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [sent, setSent] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const owner = me?.id ?? ''
  const messages = thread?.owner === owner ? thread.messages : null
  const setMessages = (m: ChatMessage[]) => setThread({ owner, messages: m })
  const send = useAction((text: string) => api.support.email(text))

  useEffect(() => {
    let current = true
    getStore().then((s) => loadThread(s, owner)).then((m) => { if (current) setThread({ owner, messages: m }) }, () => { if (current) setThread({ owner, messages: [] }) })
    return () => { current = false }
  }, [owner])
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }) }, [messages?.length])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const p = askProblem(draft)
    if (p || busy || !messages || !me) { setProblem(p ? t(`ai.problem.${p}` as StringKey, { max: MAX_MESSAGE }) : null); return }
    setProblem(null)
    setNotice(null)
    setSent(false)
    const user: ChatMessage = { id: `u-${now}-${messages.length}`, role: 'user', text: draft.trim(), at: now }
    const withUser = [...messages, user]
    setMessages(withUser)
    setDraft('')
    setBusy(true)
    const turn = await ask(config, withUser, messages.filter((m) => m.role === 'user').map((m) => m.at), { sailingId: demo.sailingId, personaId: me.id, now })
    if (turn.fallback) setNotice(t(`ai.fallback.${turn.fallback}` as StringKey))
    const reply: ChatMessage = turn.handoff
      ? { id: `a-${now}-${withUser.length}`, role: 'assistant', text: t(`ai.handoff.${turn.handoff}` as StringKey, { phone: GUEST_SERVICES_NUMBER, emergency: EMERGENCY_NUMBER }), at: now, source: 'handoff', citations: HANDOFF_LINKS[turn.handoff].map((c) => ({ label: t(c.label as StringKey), path: c.path })) }
      : { id: `a-${now}-${withUser.length}`, role: 'assistant', text: turn.reply.text, at: now, source: turn.reply.source, citations: turn.reply.citations }
    const all = [...withUser, reply]
    setMessages(all)
    setBusy(false)
    try { await saveThread(await getStore(), owner, all, now) } catch { setNotice(t('ai.saveFailed')) }
  }

  const clear = async () => {
    setConfirmClear(false)
    try { await clearThread(await getStore(), owner) } catch { /* the screen below is cleared either way */ }
    setMessages([])
    setNotice(null)
  }

  const last = messages?.[messages.length - 1]
  return (
    <div className="page">
      <h1>{t('route.concierge')}</h1>
      <Banner kind="info" title={t('ai.label.title')}><p>{t('ai.label.body')}</p><p className="muted">{config ? t('ai.mode.claude') : t('ai.mode.scripted')}</p></Banner>
      <Card labelledBy="ai-log-h">
        <h2 id="ai-log-h" className="card__title">{t('ai.conversation')}</h2>
        {messages === null ? <p role="status" className="muted">{t('account.loading')}</p> : messages.length === 0 ? (
          <div>
            <p>{t('ai.empty')}</p>
            <ul className="plain-bullets">{(['ai.try.1', 'ai.try.2', 'ai.try.3'] as const).map((k) => <li key={k}><button type="button" className="link-button" onClick={() => setDraft(t(k))}>{t(k)}</button></li>)}</ul>
          </div>
        ) : (
          <ol className="ai-log" role="log" aria-live="polite" aria-label={t('ai.conversation')}>
            {messages.map((m) => (
              <li key={m.id} className={`ai-msg ai-msg--${m.role}`}>
                <p className="ai-msg__who">{m.role === 'user' ? t('ai.you') : t(`ai.from.${m.source ?? 'scripted'}` as StringKey)}</p>
                <p className="ai-msg__text">{m.text}</p>
                {m.citations && m.citations.length > 0 && (
                  <p className="ai-msg__cites">{t('ai.sources')} {m.citations.map((c, i) => <span key={c.path}>{i > 0 && ', '}<Link to={c.path}>{c.label}</Link></span>)}</p>
                )}
              </li>
            ))}
          </ol>
        )}
        {busy && <p role="status" className="muted">{t('ai.thinking')}</p>}
        <div ref={end} />
      </Card>
      {notice && <Banner kind="warning" title={t('ai.notice')}><p>{notice}</p></Banner>}
      {last?.source === 'handoff' && (
        <Card labelledBy="ai-hand-h">
          <h2 id="ai-hand-h" className="card__title">{t('ai.handoffCard')}</h2>
          <p>{t('ai.handoffBody')}</p>
          {send.error && <p role="alert" className="field__error">{t('ai.sendFailed')}</p>}
          {sent && <p role="status">{t('ai.sent')}</p>}
          <Button variant="secondary" disabled={send.busy || sent} onClick={() => void send.run(transcript(messages ?? [])).then((r) => setSent(!!r))}>{t('ai.sendToServices')}</Button>
        </Card>
      )}
      <form onSubmit={(e) => void submit(e)} noValidate>
        <TextArea label={t('ai.ask')} hint={t('ai.askHint', { max: MAX_MESSAGE })} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX_MESSAGE + 100} />
        {problem && <p role="alert" className="field__error">{problem}</p>}
        <div className="button-row">
          <Button type="submit" disabled={busy}>{t('ai.send')}</Button>
          <Button variant="tertiary" onClick={() => setConfirmClear(true)} disabled={!messages || messages.length === 0}>{t('ai.clear')}</Button>
        </div>
      </form>
      <p className="muted">{t('ai.stored')} <Link to="/me/contact">{t('ai.person')}</Link></p>
      {confirmClear && (
        <Dialog title={t('ai.clearTitle')} onClose={() => setConfirmClear(false)}>
          <p>{t('ai.clearBody')}</p>
          <div className="button-row">
            <Button variant="danger" onClick={() => void clear()}>{t('ai.clearYes')}</Button>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>{t('ai.clearNo')}</Button>
          </div>
        </Dialog>
      )}
      <BackLink to="/" label={t('route.home')} />
    </div>
  )
}
