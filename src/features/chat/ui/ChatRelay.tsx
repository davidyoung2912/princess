import { useId, useState } from 'react'
import type { ApiError } from '../../../shared/api/errors'
import type { ChatMessage, ChatRecap } from '../../../shared/api/chatTypes'
import { RECAP_MAX_PHOTOS, RELAY_ISSUE_MAX, RELAY_MAX_MESSAGES, awaitingMe, mayHandOver, recapProblem, relayChoices, relayProblem, toggleChoice } from '../domain/chatRelay'
import { useAction } from '../../../shared/hooks/useAction'
import { chatChanged } from '../hooks/useChatSummary'
import { useMine } from '../../../shared/hooks/useMine'
import { api, stanleyHandoffs } from '../../../app/runtime'
import { t, type StringKey } from '../../../shared/i18n'
import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { ActionError } from '../../account/ui/parts'

function RelayError({ error }: { error: ApiError | null }) {
  if (!error) return null
  const why = relayProblem(error.code, error.message)
  return why === 'other' ? <ActionError error={error} /> : <p role="alert" className="field__error">{t(`crelay.problem.${why}` as StringKey)}</p>
}

function RecapError({ error }: { error: ApiError | null }) {
  if (!error) return null
  const why = recapProblem(error.code, error.message)
  return why === 'other' ? <ActionError error={error} /> : <p role="alert" className="field__error">{t(`crecap.problem.${why}` as StringKey)}</p>
}

/**
 * Get a person (phase 13): the guest picks up to ten messages, reads the exact text that would go to Guest Services, may change it, agrees, and only then sends it.
 * Nothing is sent by choosing messages; the case is opened by the guest's own tap, through the ordinary hand-off route.
 */
function RelayDialog({ conversationId, messages, onClose }: { conversationId: string; messages: ChatMessage[]; onClose: () => void }) {
  const choices = relayChoices(messages)
  const [chosen, setChosen] = useState<string[]>([])
  const [text, setText] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [reference, setReference] = useState('')
  const [sent, setSent] = useState(false)
  const field = useId()
  const draft = useAction(async () => { setText((await api.chatConversations.relayDraft(conversationId, chosen)).text) })
  const send = useAction(async () => {
    const r = (await stanleyHandoffs.create({ topic: 'person', issue: text, consent: true })) as { reference?: unknown } | null
    setReference(typeof r?.reference === 'string' ? r.reference : '')
    setSent(true)
    chatChanged()
  })
  return (
    <Dialog title={t('crelay.title')} onClose={onClose}>
      {sent ? (
        <>
          <p role="status">{reference ? t('crelay.sent', { reference }) : t('crelay.sentNoRef')}</p>
          <div className="button-row"><Button onClick={onClose}>{t('crelay.close')}</Button></div>
        </>
      ) : text === null ? (
        <>
          <p className="muted">{t('crelay.pickBody', { max: RELAY_MAX_MESSAGES })}</p>
          {choices.length === 0 ? <p>{t('crelay.noMessages')}</p> : (
            <fieldset>
              <legend>{t('crelay.pick', { count: chosen.length, max: RELAY_MAX_MESSAGES })}</legend>
              <ul className="plain-list">
                {choices.map((m) => (
                  <li key={m.id}>
                    <label>
                      <input type="checkbox" checked={chosen.includes(m.id)} onChange={() => setChosen((c) => toggleChoice(c, m.id))} />{' '}
                      <strong>{m.fromName ?? t('chat.you')}</strong>: {m.text}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          <RelayError error={draft.error} />
          <div className="button-row">
            <Button disabled={chosen.length === 0 || draft.busy} onClick={() => void draft.run().catch(() => undefined)}>{t('crelay.next')}</Button>
            <Button variant="tertiary" onClick={onClose}>{t('crelay.cancel')}</Button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">{t('crelay.previewBody')}</p>
          <label htmlFor={field}>{t('crelay.exact')}</label>
          <textarea id={field} rows={8} maxLength={RELAY_ISSUE_MAX} value={text} onChange={(e) => setText(e.target.value)} />
          <p className="muted">{t('crelay.count', { count: text.length, max: RELAY_ISSUE_MAX })}</p>
          <label>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> {t('crelay.consent')}
          </label>
          <RelayError error={send.error} />
          <div className="button-row">
            <Button disabled={!mayHandOver(text, consent) || send.busy} onClick={() => void send.run().catch(() => undefined)}>{t('crelay.send')}</Button>
            <Button variant="secondary" onClick={() => { setText(null); setConsent(false) }}>{t('crelay.back')}</Button>
            <Button variant="tertiary" onClick={onClose}>{t('crelay.cancel')}</Button>
          </div>
        </>
      )}
    </Dialog>
  )
}

/** "Get a person" in the chat options of a person to person chat. Hidden for a supervised child's own chats by the server's refusal, which the dialog shows. */
export function GetPersonButton({ conversationId, messages }: { conversationId: string; messages: ChatMessage[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="button-row"><Button variant="secondary" onClick={() => setOpen(true)}>{t('crelay.open')}</Button></div>
      <p className="muted">{t('crelay.openHint')}</p>
      {open && <RelayDialog conversationId={conversationId} messages={messages} onClose={() => setOpen(false)} />}
    </>
  )
}

function SharedPhoto({ groupId, messageId, from }: { groupId: string; messageId: string; from?: string }) {
  const photo = useMine(() => api.chatConversations.recapPhoto(groupId, messageId), [groupId, messageId])
  if (!photo.data) return <li className="muted">{photo.status === 'error' ? t('crecap.photoGone') : t('crecap.loading')}</li>
  return <li><img src={photo.data} alt={from ? t('crecap.photoFrom', { name: from }) : t('crecap.photoYours')} className="recap-photo" /></li>
}

function RecapBody({ groupId, recap, set }: { groupId: string; recap: ChatRecap; set: (r: ChatRecap) => void }) {
  const choices = useMine(() => (recap.shared ? Promise.resolve([]) : api.chatConversations.recapChoices(groupId)), [groupId, recap.shared, recap.photos.length])
  const [picked, setPicked] = useState<string[] | null>(null)
  const decide = useAction(async (messageId: string, decision: 'approved' | 'declined') => { set(await api.chatConversations.decideRecapPart(groupId, messageId, decision)) })
  const savePhotos = useAction(async (ids: string[]) => { set(await api.chatConversations.setRecapPhotos(groupId, ids)); setPicked(null) })
  const share = useAction(async () => { set(await api.chatConversations.shareRecap(groupId)); chatChanged() })
  const have = choices.data?.filter((c) => c.chosen).map((c) => c.messageId) ?? []
  const current = picked ?? have
  if (recap.shared) {
    return (
      <>
        <p>{t('crecap.sharedBody')}</p>
        {recap.plans.length > 0 && <ul className="plain-list">{recap.plans.map((p) => <li key={p.messageId}>{p.title}{p.place ? `, ${p.place}` : ''}</li>)}</ul>}
        {recap.photos.length > 0 && <ul className="plain-list recap-photos">{recap.photos.map((p) => <SharedPhoto key={p.messageId} groupId={groupId} messageId={p.messageId} from={p.from} />)}</ul>}
      </>
    )
  }
  const waiting = awaitingMe(recap)
  return (
    <>
      <p role="status">{recap.progress}</p>
      <p className="muted">{t('crecap.privateBody')}</p>
      {recap.plans.filter((p) => p.mine).map((p) => (
        <div key={p.messageId} className="recap-part">
          <p><strong>{p.title}</strong> {p.decision !== 'pending' && <span className="muted">({t(`crecap.decision.${p.decision}` as StringKey)})</span>}</p>
          <div className="button-row">
            <Button variant={p.decision === 'approved' ? 'primary' : 'secondary'} disabled={decide.busy} onClick={() => void decide.run(p.messageId, 'approved').catch(() => undefined)}>{t('crecap.include')}</Button>
            <Button variant={p.decision === 'declined' ? 'primary' : 'secondary'} disabled={decide.busy} onClick={() => void decide.run(p.messageId, 'declined').catch(() => undefined)}>{t('crecap.leaveOut')}</Button>
          </div>
        </div>
      ))}
      {waiting > 0 && <p className="muted">{t('crecap.awaiting', { count: waiting })}</p>}
      {choices.data && choices.data.length > 0 && (
        <fieldset>
          <legend>{t('crecap.photos', { count: current.length, max: RECAP_MAX_PHOTOS })}</legend>
          <ul className="plain-list">
            {choices.data.map((c) => (
              <li key={c.messageId}>
                <label>
                  <input type="checkbox" checked={current.includes(c.messageId)} onChange={() => setPicked(toggleChoice(current, c.messageId, RECAP_MAX_PHOTOS))} /> {t('crecap.photoAt', { when: new Date(c.at).toLocaleString() })}
                </label>
              </li>
            ))}
          </ul>
          <div className="button-row"><Button variant="secondary" disabled={picked === null || savePhotos.busy} onClick={() => void savePhotos.run(current).catch(() => undefined)}>{t('crecap.savePhotos')}</Button></div>
        </fieldset>
      )}
      <RecapError error={decide.error ?? savePhotos.error} />
      <div className="button-row"><Button disabled={!recap.canShare || share.busy} onClick={() => void share.run().catch(() => undefined)}>{t('crecap.share')}</Button></div>
      {!recap.canShare && recap.shareRefusal && <p className="muted">{t(`crecap.cannot.${recap.shareRefusal}` as StringKey)}</p>}
      <RecapError error={share.error} />
    </>
  )
}

/** The group recap (phase 13), in the chat options of a made group. Each member decides only their own parts; nothing is shared until a member shares it. */
export function RecapCard({ groupId }: { groupId: string }) {
  const state = useMine(() => api.chatConversations.recap(groupId).then((r) => ({ recap: r as ChatRecap | null })).catch((e: ApiError) => (e.code === 'notFound' ? { recap: null } : Promise.reject(e))), [groupId])
  const [recap, setRecap] = useState<ChatRecap | null>(null)
  const start = useAction(async () => { setRecap(await api.chatConversations.startRecap(groupId)) })
  const current = recap ?? state.data?.recap ?? null
  if (state.status === 'loading') return null
  return (
    <section aria-labelledby={`crecap-h-${groupId}`}>
      <h4 id={`crecap-h-${groupId}`}>{t('crecap.title')}</h4>
      {current ? <RecapBody groupId={groupId} recap={current} set={setRecap} /> : (
        <>
          <p className="muted">{t('crecap.startBody')}</p>
          <div className="button-row"><Button variant="secondary" disabled={start.busy} onClick={() => void start.run().catch(() => undefined)}>{t('crecap.start')}</Button></div>
          <RecapError error={start.error} />
        </>
      )}
    </section>
  )
}
