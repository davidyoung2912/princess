import { useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { HelpTip } from '../HelpTip'
import { screen } from '../../ai/guard'
import { getStanleyStatus, subscribeStanley } from '../../ai/stanley'
import { CASE_TOPICS, caseProblemOf, caseState, normalizeCase, topicFromWords, type CaseTopic, type StanleyCase } from '../../ai/stanleyHandoff'
import { EMERGENCY_NUMBER, GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { buildHandoff, defaultParts, hasMessage, HANDOFF_MAX, type HandoffParts } from '../../domain/handoff'

import { useAction } from '../../hooks/useAction'
import { useSailing, usePersona, useNow } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { t, th, type StringKey } from '../../i18n'
import { api, stanleyHandoffs } from '../../runtime'
import { getContext, subscribeContext, partyPeople } from '../../account/context'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field, TextArea } from '../Field'

const time = (ms: number): string => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/** What a case says now, in words: its owner, its status, when the next update is due and, once that has passed, the number to call. */
export function CaseStatusLine({ c, now }: { c: StanleyCase; now: number }) {
  const s = caseState(c, now)
  return <p role="status">{t(`handoff.status.${s.key}` as StringKey, { owner: c.owner, time: time(c.nextUpdateAt), phone: GUEST_SERVICES_NUMBER, reference: c.reference })}</p>
}

/**
 * Handoff with context (XA-06, phase 6). Shows the whole message that would go to Guest Services (the question, the booking facts, the last of the conversation),
 * lets the guest leave parts out or edit it, asks them to agree to exactly that text, and opens a case only when they press the button.
 * It says "handed to Guest Services" only after the server has answered with a case reference; until then, and on any failure, it says nothing has been sent.
 * An emergency makes no message: it shows the number.
 */
export function HandoffCard({ messages, initialTopic }: { messages: readonly { role: 'user' | 'assistant'; text: string }[]; initialTopic?: CaseTopic }) {
  const me = usePersona()
  const sailing = useSailing()
  const booking = useSyncExternalStore(subscribeContext, getContext, getContext)?.booking
  const on = useSyncExternalStore(subscribeStanley, getStanleyStatus, getStanleyStatus).handoff
  const checklist = useMine(() => api.plan.checklist.get())
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.text ?? ''
  const screened = screen(lastUser) ?? 'person'
  const [topic, setTopic] = useState<CaseTopic>(initialTopic ?? topicFromWords(lastUser))
  const [parts, setParts] = useState<HandoffParts>(defaultParts(screened))
  const [edited, setEdited] = useState<string | null>(null)
  const [outcome, setOutcome] = useState('')
  const [tried, setTried] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [made, setMade] = useState<StanleyCase | null>(null)
  const now = useNow()
  const send = useAction((body: unknown) => stanleyHandoffs.create(body), { quiet: false })

  if (!hasMessage(screened)) {
    return (
      <Card labelledBy="ai-hand-h">
        <h2 id="ai-hand-h" className="card__title">{th('ai.handoffCard')}</h2>
        <p>{t('handoff.emergency', { emergency: EMERGENCY_NUMBER })}</p>
      </Card>
    )
  }
  if (!on) {
    return (
      <Card labelledBy="ai-hand-h">
        <h2 id="ai-hand-h" className="card__title">{th('ai.handoffCard')}</h2>
        <p>{t('handoff.problem.off', { phone: GUEST_SERVICES_NUMBER })}</p>
        <p><Link to="/chat">{t('route.chat')}</Link></p>
      </Card>
    )
  }
  const open = checklist.data ? checklist.data.milestones.flatMap((m) => m.entries).filter((e) => e.state !== 'done' && !e.automatic).length : null
  const built = buildHandoff(screened, lastUser, messages.map((m) => ({ role: m.role, text: m.text })), { guest: me?.name ?? '', sailing: sailing.departure, party: me ? partyPeople(me.id).length : 1, open }, parts) ?? ''
  const text = edited ?? built
  const toggle = (k: keyof HandoffParts) => { setParts((p) => ({ ...p, [k]: !p[k] })); setEdited(null); setAgreed(false) }

  if (made) {
    return (
      <Card labelledBy="ai-hand-h">
        <h2 id="ai-hand-h" className="card__title">{th('ai.handoffCard')}</h2>
        <p role="status">{t('handoff.sent', { owner: made.owner, reference: made.reference })}</p>
        <CaseStatusLine c={made} now={now} />
      </Card>
    )
  }

  const submit = async () => {
    const r = await send.run({ topic, issue: text.trim(), outcome: outcome.trim(), reference: booking?.number ?? '', tried: tried.trim(), role: 'guest', consent: agreed })
    const c = normalizeCase(r)
    if (c) setMade(c)
  }
  return (
    <Card labelledBy="ai-hand-h">
      <h2 id="ai-hand-h" className="card__title">{th('ai.handoffCard')}</h2>
      <p>{t('handoff.body')}</p>
      <p>
        <label htmlFor="ai-hand-topic">{t('handoff.topic')}</label>{' '}
        <select id="ai-hand-topic" value={topic} onChange={(e) => { setTopic(e.target.value as CaseTopic); setAgreed(false) }}>
          {CASE_TOPICS.map((k) => <option key={k} value={k}>{t(`handoff.topic.${k}` as StringKey)}</option>)}
        </select>
      </p>
      {topic === 'missedShip' && <p><strong>{t('handoff.missedShip', { phone: GUEST_SERVICES_NUMBER })}</strong></p>}
      <fieldset className="plain-fieldset">
        <legend>{t('handoff.include')}</legend>
        <HelpTip about={t('handoff.include')}>{t('helptip.handoff')}</HelpTip>
        {(['question', 'booking', 'conversation'] as const).map((k) => (
          <label key={k} className="choice"><input type="checkbox" checked={parts[k]} onChange={() => toggle(k)} /><span>{t(`handoff.part.${k}` as StringKey)}</span></label>
        ))}
      </fieldset>
      {screened === 'medical' && <p className="muted">{t('handoff.medical')}</p>}
      <TextArea label={t('handoff.preview')} hint={t('handoff.previewHint')} value={text} maxLength={HANDOFF_MAX} rows={8} onChange={(e) => { setEdited(e.target.value); setAgreed(false) }} />
      <Field label={t('handoff.outcome')} hint={t('handoff.outcomeHint')} value={outcome} maxLength={200} onChange={(e) => { setOutcome(e.target.value); setAgreed(false) }} />
      <Field label={t('handoff.tried')} hint={t('handoff.triedHint')} value={tried} maxLength={300} onChange={(e) => { setTried(e.target.value); setAgreed(false) }} />
      <label className="choice"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /><span>{t('handoff.consent')}</span></label>
      {send.error && <p role="alert" className="field__error">{t(`handoff.problem.${caseProblemOf(send.error)}` as StringKey, { phone: GUEST_SERVICES_NUMBER })}</p>}
      {!made && <p className="muted">{t('handoff.notSent')}</p>}
      <Button variant="secondary" disabled={send.busy || !agreed || text.trim() === ''} onClick={() => void submit()}>{t('handoff.send')}</Button>
    </Card>
  )
}
