import { useState } from 'react'
import { screen } from '../../ai/guard'
import type { ChatMessage } from '../../ai/types'
import { EMERGENCY_NUMBER } from '../../domain/contacts'
import { buildHandoff, defaultParts, hasMessage, HANDOFF_MAX, type HandoffParts } from '../../domain/handoff'
import { partyOf } from '../../domain/personas'
import { useAction } from '../../hooks/useAction'
import { useSailing, usePersona } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'
import { TextArea } from '../Field'

/**
 * Handoff with context (XA-06). Shows the whole message that would go to Guest Services (the question, the booking facts, the last of the conversation),
 * lets the guest leave parts out or edit it, and sends only when they press the button. An emergency makes no message: it shows the number.
 */
export function HandoffCard({ messages }: { messages: readonly ChatMessage[] }) {
  const me = usePersona()
  const sailing = useSailing()
  const checklist = useMine(() => api.plan.checklist.get())
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.text ?? ''
  const topic = screen(lastUser) ?? 'person'
  const [parts, setParts] = useState<HandoffParts>(defaultParts(topic))
  const [edited, setEdited] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const send = useAction((text: string) => api.support.email(text))

  if (!hasMessage(topic)) {
    return (
      <Card labelledBy="ai-hand-h">
        <h2 id="ai-hand-h" className="card__title">{t('ai.handoffCard')}</h2>
        <p>{t('handoff.emergency', { emergency: EMERGENCY_NUMBER })}</p>
      </Card>
    )
  }
  const open = checklist.data ? checklist.data.milestones.flatMap((m) => m.entries).filter((e) => e.state !== 'done' && !e.automatic).length : null
  const built = buildHandoff(topic, lastUser, messages.map((m) => ({ role: m.role, text: m.text })), { guest: me?.name ?? '', sailing: sailing.departure, party: me ? partyOf(me.id).length : 1, open }, parts) ?? ''
  const text = edited ?? built
  const toggle = (k: keyof HandoffParts) => { setParts((p) => ({ ...p, [k]: !p[k] })); setEdited(null) }
  return (
    <Card labelledBy="ai-hand-h">
      <h2 id="ai-hand-h" className="card__title">{t('ai.handoffCard')}</h2>
      <p>{t('handoff.body')}</p>
      <fieldset className="plain-fieldset">
        <legend>{t('handoff.include')}</legend>
        {(['question', 'booking', 'conversation'] as const).map((k) => (
          <label key={k} className="choice"><input type="checkbox" checked={parts[k]} onChange={() => toggle(k)} /><span>{t(`handoff.part.${k}` as StringKey)}</span></label>
        ))}
      </fieldset>
      {topic === 'medical' && <p className="muted">{t('handoff.medical')}</p>}
      <TextArea label={t('handoff.preview')} hint={t('handoff.previewHint')} value={text} maxLength={HANDOFF_MAX} rows={8} onChange={(e) => setEdited(e.target.value)} />
      {send.error && <p role="alert" className="field__error">{t('ai.sendFailed')}</p>}
      {sent && <p role="status">{t('ai.sent')}</p>}
      <Button variant="secondary" disabled={send.busy || sent || text.trim() === ''} onClick={() => void send.run(text).then((r) => setSent(!!r))}>{t('handoff.send')}</Button>
    </Card>
  )
}
