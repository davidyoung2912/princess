import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { NOTICE_MS, noticePath, type ChatNotice } from '../domain/chatNotice'
import { t } from '../i18n'
import { api } from '../runtime'
import { chatChanged } from '../hooks/useChatSummary'
import { unackedUrgent } from '../domain/chatUrgency'
import { Button } from './Button'
import { Chat, OctagonAlert, X } from './icons'

/**
 * A small notice at the top of the screen for a chat request or message that arrived while the guest is elsewhere in the app. It never takes focus and has no sound,
 * goes away by itself (and waits while the keyboard is on it), and Escape closes it. Tapping the sentence opens the chat, as Open does. A request can be accepted from it; declining and blocking stay in the list.
 * An urgent message is different (docs/chat-urgency-plan.md): it is announced at once, never goes away by itself or on Escape, and waits for **Got it**.
 */
export function ChatToast({ notice, onClose }: { notice: ChatNotice | null; onClose: () => void }) {
  return (
    <>
      <div className="chat-toast-region" role="status" aria-live="polite">
        {notice && !notice.urgent && <Toast key={notice.key} notice={notice} onClose={onClose} />}
      </div>
      <div className="chat-toast-region" role="alert">
        {notice?.urgent && <UrgentToast key={notice.key} notice={notice} onClose={onClose} />}
      </div>
    </>
  )
}

function UrgentToast({ notice, onClose }: { notice: ChatNotice; onClose: () => void }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const id = notice.conversationId
  const gotIt = async () => {
    if (!id) return
    setBusy(true)
    setFailed(false)
    try {
      const th = await api.chatConversations.thread(id)
      await Promise.all(unackedUrgent(th.messages).map((m) => api.chatConversations.ack(id, m.id)))
      chatChanged()
      onClose()
    } catch { setFailed(true) } finally { setBusy(false) }
  }
  const to = noticePath(notice)
  return (
    <div className="chat-toast chat-toast--urgent" role="group" aria-label={t('urgent.label')}>
      <OctagonAlert className="chat-toast__icon chat-toast__icon--urgent" aria-hidden="true" />
      <p className="chat-toast__text">
        <button type="button" className="chat-toast__main" onClick={() => { navigate(to) }}>
          <span className="chat-toast__label">{t('urgent.label')}</span> {t('urgent.notice', { name: notice.name })}
        </button>
        {failed && <span className="field__error" role="alert"> {t('urgent.ackFailed')}</span>}
      </p>
      <div className="chat-toast__actions">
        <Button onClick={() => void gotIt()} disabled={busy}>{t('urgent.gotIt')}</Button>
        <Button variant="secondary" onClick={() => { navigate(to) }}>{t('notice.open')}</Button>
      </div>
    </div>
  )
}

function Toast({ notice, onClose }: { notice: ChatNotice; onClose: () => void }) {
  const navigate = useNavigate()
  const box = useRef<HTMLDivElement>(null)
  const [hold, setHold] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ to: string } | 'failed' | null>(null)
  useEffect(() => {
    if (hold || busy) return
    const id = window.setTimeout(onClose, NOTICE_MS)
    return () => window.clearTimeout(id)
  }, [hold, busy, done, notice.count, onClose])
  // It waits while the keyboard is on it, and Escape closes it. (Listeners are added here rather than in the markup: the box itself is not a control.)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const on = () => setHold(true)
    const off = () => setHold(false)
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    el.addEventListener('focusin', on); el.addEventListener('focusout', off); el.addEventListener('keydown', key)
    return () => { el.removeEventListener('focusin', on); el.removeEventListener('focusout', off); el.removeEventListener('keydown', key) }
  }, [onClose])
  const go = (to: string) => { onClose(); navigate(to) }
  const accept = async () => {
    if (!notice.requestId) return
    setBusy(true)
    try {
      const c = await api.chatConnections.respond(notice.requestId, true)
      chatChanged()
      setDone({ to: c.conversationId ? `/chat?c=${encodeURIComponent(c.conversationId)}` : '/chat' })
    } catch { setDone('failed') } finally { setBusy(false) }
  }
  const text = done === 'failed' ? t('notice.failed')
    : done ? t('notice.accepted', { name: notice.name })
    : notice.kind === 'request' ? t('notice.request', { name: notice.name })
    : notice.count > 1 ? t('notice.messages', { count: notice.count, name: notice.name }) : t('notice.message', { name: notice.name })
  const target = done && done !== 'failed' ? done.to : noticePath(notice)
  return (
    <div
      ref={box} className="chat-toast" role="group" aria-label={t('notice.label')}
    >
      <Chat className="chat-toast__icon" aria-hidden="true" />
      <p className="chat-toast__text">
        <button type="button" className="chat-toast__main" onClick={() => go(target)}><span className="chat-toast__label">{t('notice.label')}</span> {text}</button>
      </p>
      <div className="chat-toast__actions">
        {notice.requestId && !done && <Button onClick={() => void accept()} disabled={busy}>{t('notice.accept')}</Button>}
        <Button variant="secondary" onClick={() => go(target)}>{t('notice.open')}</Button>
        <button type="button" className="chat-toast__close" onClick={onClose} aria-label={t('notice.dismiss')}><X aria-hidden="true" /></button>
      </div>
    </div>
  )
}
