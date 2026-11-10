import { useState } from 'react'
import type { ChatKeep } from '../../api/chatTypes'
import { deleteDay, keepDate, keepStatus, KEEP_REASON_KEY, waitingPhrase } from '../../domain/chatKeep'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t, th as heading, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { Button } from '../Button'
import { ActionError, Load } from '../account/parts'

/**
 * "Keep this chat" (chat phase 5). Messages are deleted 30 days after the cruise; a chat every person in it agrees to keep is held for 12 months after the cruise instead.
 * The date the messages go is always on the screen, the screen says who has not agreed yet, and a supervised child is told their guardian decides. A guardian uses the same section for the child's chat (`childId`).
 */
export function KeepSection({ conversationId, childId, onChanged }: { conversationId: string; childId?: string; onChanged?: () => void }) {
  const state = useMine(() => (childId ? api.chatGuardian.keep(childId, conversationId) : api.chatConversations.keep(conversationId)), [conversationId, childId])
  return (
    <section className="chat-keep" aria-labelledby={`keep-h-${conversationId}`}>
      <h3 id={`keep-h-${conversationId}`}>{heading('keep.title')}</h3>
      <Load state={state}>{(k) => <KeepBody k={k} conversationId={conversationId} childId={childId} reload={() => { state.retry(); onChanged?.() }} />}</Load>
    </section>
  )
}

function KeepBody({ k, conversationId, childId, reload }: { k: ChatKeep; conversationId: string; childId?: string; reload: () => void }) {
  // What the server said last, so the screen is right the moment a button is pressed and again if the call fails.
  const [shown, setShown] = useState<ChatKeep | null>(null)
  const view = shown ?? k
  const set = useAction(async (on: boolean) => {
    const next = childId ? await api.chatGuardian.setKeep(childId, conversationId, on) : await api.chatConversations.setKeep(conversationId, on)
    setShown(next)
    reload()
  })
  const status = keepStatus(view)
  const day = deleteDay(view)
  if (status === 'unavailable') return <p className="muted">{t((view.reason ? KEEP_REASON_KEY[view.reason] : 'keep.reason.closed') as StringKey)}</p>
  const forChild = childId !== undefined
  return (
    <>
      <p role="status">
        {status === 'kept' && t('keep.kept', { date: day ? keepDate(day) : '' })}
        {status === 'waiting' && t('keep.waiting', { who: waitingPhrase(view.waiting), agreed: view.agreed, total: view.total })}
        {status === 'offer' && t('keep.offer', { date: view.deleteOn ? keepDate(view.deleteOn) : '', standard: view.standardDeleteOn ? keepDate(view.standardDeleteOn) : '' })}
        {status === 'guardian' && t('keep.guardian', { standard: view.standardDeleteOn ? keepDate(view.standardDeleteOn) : '' })}
      </p>
      {status === 'waiting' && day !== null && <p className="muted">{t('keep.goes', { date: keepDate(day) })}</p>}
      {view.needsGuardian ? null : (
        <div className="button-row">
          <Button variant="secondary" disabled={set.busy} onClick={() => void set.run(!view.mine)}>
            {view.mine ? t(forChild ? 'keep.stopFor' : 'keep.stop') : t(forChild ? 'keep.agreeFor' : 'keep.agree')}
          </Button>
        </div>
      )}
      <ActionError error={set.error} />
      <p className="muted">{t('keep.rules')}</p>
    </>
  )
}
