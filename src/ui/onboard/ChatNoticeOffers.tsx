import { useState } from 'react'
import { cardFor, normalizeList, savedParam, type ChangeCard } from '../../ai/stanleyChanges'
import type { ChatMessage, NoticeReply } from '../../api/chatTypes'
import { IN_THREAD_ACTIONS, noticeOffers, safeNoticePath } from '../../domain/stanleyThread'
import { useAction } from '../../hooks/useAction'
import { chatChanged } from '../../hooks/useChatSummary'
import { useNow, useSailing } from '../../hooks/useDemo'
import { getWatched } from '../../push/browser'
import { t, type StringKey } from '../../i18n'
import { api, stanleyChanges } from '../../runtime'
import { ActionError } from '../account/parts'
import { StanleyChangeCard } from '../ai/StanleyChanges'
import { Button, LinkButton } from '../Button'

/**
 * What a relayed notice lets the guest do from the thread (phase 0c): its action buttons and reply chips. The offers come from the server, and an expired or replaced notice offers nothing, also on a
 * copy held on the device (the notice carries its own `expiresAt`). Confirming the muster calls the same service the muster screen calls, so the two cannot differ; every other action opens the screen
 * that already does the job.
 */
export function ChatNoticeOffers({ m, conversationId, onChanged }: { m: ChatMessage; conversationId: string; onChanged: () => void }) {
  const now = useNow()
  const { actions, replies } = noticeOffers(m, now)
  const [answer, setAnswer] = useState<string | null>(null)
  const [mustered, setMustered] = useState<string | null>(null)
  const link = safeNoticePath(m.notice?.path)
  const sailing = useSailing()
  // The change engine's card for this notice, with its options (move dinner, add to plan). It is only shown here: each option is prepared and confirmed on the card's own Confirm, as everywhere else.
  const [card, setCard] = useState<{ card: ChangeCard | null } | null>(null)
  const review = useAction(async () => {
    const list = normalizeList(await stanleyChanges.list(sailing.id, savedParam([...getWatched()])))
    setCard({ card: cardFor(list, m.notice?.subject) })
  }, { quiet: true })

  const reply = useAction(async (r: NoticeReply) => {
    const a = await api.chatConversations.noticeReply(conversationId, m.id, r)
    setAnswer(a.text)
  }, { quiet: true })
  const muster = useAction(async () => {
    const view = await api.onboard.muster()
    const waiting = view.guests.filter((g) => g.confirmedAt === null).map((g) => g.id)
    if (waiting.length === 0) { setMustered(t('stanley.notice.musterNothing')); return }
    await api.onboard.confirmMuster(waiting)
    // A critical notice asks for Got it: confirming the station is the answer, so it is recorded with the same call the Got it button makes.
    if (m.acked === false) await api.chatConversations.ack(conversationId, m.id).catch(() => undefined)
    setMustered(t('stanley.notice.musterDone'))
    chatChanged()
    onChanged()
  }, { quiet: true })

  if (actions.length === 0 && replies.length === 0 && !answer) return null
  const err = muster.error ?? reply.error ?? review.error
  return (
    <div className="chat-notice-offers">
      {actions.map((id) => id === 'reviewChange'
        ? <Button key={id} variant="secondary" disabled={review.busy || card !== null} onClick={() => void review.run()}>{t('stanley.notice.action.reviewChange')}</Button>
        : IN_THREAD_ACTIONS.includes(id)
        ? <Button key={id} disabled={muster.busy || mustered !== null} onClick={() => void muster.run()}>{t('stanley.notice.action.confirmMuster')}</Button>
        : link && <LinkButton key={id} to={link} variant="secondary">{t(`stanley.notice.action.${id}` as StringKey)}</LinkButton>)}
      {mustered && <p role="status">{mustered}</p>}
      {card && (card.card ? <StanleyChangeCard card={card.card} sailingId={sailing.id} onDismissed={() => { setCard(null); onChanged() }} /> : <p role="status" className="muted">{t('stanley.notice.noOptions')}</p>)}
      {replies.length > 0 && (
        <div className="chip-row" role="group" aria-label={t('stanley.notice.replies')}>
          {replies.map((r) => <Button key={r} variant="secondary" disabled={reply.busy} onClick={() => void reply.run(r)}>{t(`stanley.notice.reply.${r}` as StringKey)}</Button>)}
        </div>
      )}
      {answer && <p role="status" className="chat-notice-offers__answer">{answer}</p>}
      {err && (err.code === 'conflict' ? <p role="alert" className="field__error">{t('stanley.notice.later.expired')}</p> : <ActionError error={err} />)}
    </div>
  )
}
