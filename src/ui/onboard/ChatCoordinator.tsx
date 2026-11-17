import { createContext, useContext, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import type { ApiError } from '../../api/errors'
import type { ChatMessage, GroupStanley } from '../../api/chatTypes'
import { coordinatorProblem, isCoordinable, mayCoordinate, reminderReason, remainingLine } from '../../domain/chatCoordinator'
import { useAction } from '../../hooks/useAction'
import { chatChanged } from '../../hooks/useChatSummary'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Chip } from '../Chip'
import { Dialog } from '../Dialog'
import { ActionError } from '../account/parts'

/** Whether the caller is an admin of this group and Stanley may help in it. The conversation asks the server once and every poll and plan reads it from here. */
type Ctx = { groupId: string; state: GroupStanley } | null
const CoordinatorContext = createContext<Ctx>(null)
export const CoordinatorProvider = CoordinatorContext.Provider

/** The sentence for a refusal or failure, or the general error when there is no sentence for it. */
function Problem({ error }: { error: ApiError | null }) {
  if (!error) return null
  const why = coordinatorProblem(error.code, error.message)
  return why === 'other' ? <ActionError error={error} /> : <p role="alert" className="field__error">{t(`cco.problem.${why}` as StringKey)}</p>
}

/**
 * What the organiser sees before anything goes out (phase 11): the tally in counts, any compromise idea, the exact text that would be posted to the group, and the exact private reminder with how many people it would reach.
 * Nobody is named. Posting and reminding are each the organiser's own tap; Stanley never does either by himself.
 */
function CoordinatorDialog({ groupId, message, onClose }: { groupId: string; message: ChatMessage; onClose: () => void }) {
  const preview = useMine(() => api.chatConversations.coordinatorPreview(groupId, message.id), [groupId, message.id])
  const [done, setDone] = useState('')
  const share = useAction(async () => {
    await api.chatConversations.shareTally(groupId, message.id)
    setDone(t('cco.posted'))
    chatChanged()
    onClose()
  })
  const remind = useAction(async () => {
    const r = await api.chatConversations.remindGroup(groupId, message.id)
    setDone(r.line)
    preview.retry()
  })
  const data = preview.data
  const reason = data ? reminderReason(data) : null
  return (
    <Dialog title={t('cco.title')} onClose={onClose}>
      <p role="status" className="visually-hidden">{done}</p>
      {preview.status === 'loading' && <p>{t('cco.loading')}</p>}
      {preview.status === 'error' && <Problem error={preview.error as ApiError} />}
      {data && (
        <>
          <p><strong>{data.status}</strong></p>
          {data.compromise && <p>{data.compromise}</p>}
          <h3>{t('cco.postHeading')}</h3>
          <p className="muted">{t('cco.postBody')}</p>
          <blockquote className="cco-text">{data.shareText}</blockquote>
          <div className="button-row">
            <Button disabled={share.busy} onClick={() => void share.run()}>{t('cco.post')}</Button>
          </div>
          <Problem error={share.error} />
          <h3>{t('cco.remindHeading')}</h3>
          <p className="muted">{t('cco.remindBody')}</p>
          <blockquote className="cco-text">{data.reminderText}</blockquote>
          {reason ? <p className="muted">{t(`cco.reason.${reason}` as StringKey)}</p> : <p className="muted">{t('cco.willRemind', { count: data.willRemind })}</p>}
          <div className="button-row">
            <Button variant="secondary" disabled={remind.busy || reason !== null} onClick={() => void remind.run()}>{t('cco.remind', { count: data.willRemind })}</Button>
          </div>
          <Problem error={remind.error} />
          {done && <p className="muted" aria-hidden="true">{done}</p>}
        </>
      )}
      <div className="button-row"><Button variant="tertiary" onClick={onClose}>{t('cco.close')}</Button></div>
    </Dialog>
  )
}

/** "Stanley's tally" under a poll or plan: only for an admin of a group that let Stanley help. Nothing is drawn for anyone else. */
export function CoordinatorButton({ message }: { message: ChatMessage }) {
  const ctx = useContext(CoordinatorContext)
  const [open, setOpen] = useState(false)
  if (!ctx || !mayCoordinate(ctx.state) || !isCoordinable(message)) return null
  return (
    <>
      <button type="button" className="chat-act chat-act--icon" aria-label={t('cco.open')} title={t('cco.open')} onClick={() => setOpen(true)}><ClipboardList aria-hidden="true" /></button>
      {open && <CoordinatorDialog groupId={ctx.groupId} message={message} onClose={() => setOpen(false)} />}
    </>
  )
}

/** The organiser's private "what remains": the open polls and plans still waiting for someone, in counts. It is never posted. */
export function RemainingCard() {
  const ctx = useContext(CoordinatorContext)
  const on = ctx !== null && mayCoordinate(ctx.state)
  const remaining = useMine(() => (on ? api.chatConversations.remaining(ctx.groupId) : Promise.resolve(null)), [on, ctx?.groupId])
  if (!on || !remaining.data) return null
  const r = remaining.data
  return (
    <section aria-labelledby="cco-remaining-h">
      <h4 id="cco-remaining-h">{t('cco.remaining')}</h4>
      {r.waiting === 0 ? <p className="muted">{t('cco.remainingNone')}</p> : (
        <>
          <p>{t('cco.remainingCount', { waiting: r.waiting, missing: r.outstanding })}</p>
          <ul className="cst-list">{r.items.map((i) => <li key={i.messageId}>{remainingLine(i)}</li>)}</ul>
        </>
      )}
      <p className="muted">{t('cco.remainingHint')}</p>
    </section>
  )
}

/** Every member's own switch for Stanley's reminders in this group. Nobody is told. */
export function RemindersSwitch({ groupId }: { groupId: string }) {
  const state = useMine(() => api.chatConversations.remindersMuted(groupId), [groupId])
  const [muted, setMuted] = useState<boolean | null>(null)
  const set = useAction(async (next: boolean) => {
    setMuted(next)
    try { setMuted(await api.chatConversations.setRemindersMuted(groupId, next)) } catch (e) { setMuted(null); throw e }
  })
  if (state.data === null) return null
  const current = muted ?? state.data
  return (
    <>
      <div className="chip-row">
        <Chip pressed={current} onToggle={() => void set.run(!current).catch(() => undefined)}>{t('cco.mute')}</Chip>
      </div>
      <p className="muted">{t('cco.muteHint')}</p>
      <ActionError error={set.error} />
    </>
  )
}
