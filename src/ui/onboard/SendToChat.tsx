import { useEffect, useRef, useState } from 'react'
import type { ChatConversation } from '../../api/chatTypes'
import { newClientId } from '../../domain/chatThread'
import { useAction } from '../../hooks/useAction'
import { api } from '../../runtime'
import { t } from '../../i18n'
import { Button } from '../Button'
import { shareError } from './ChatCards'

/**
 * "Send to chat" on a booked excursion or dinner. It lists the guest's open conversations when first opened and sends the booking as a card: the screen names only the booking's `ref`
 * (`excursion:<id>` or `dining:<id>`), and the server builds the words from its own data, so nothing about price or booking numbers can go with it.
 */
export function SendToChat({ shareRef, title }: { shareRef: string; title: string }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ChatConversation[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const asked = useRef(false)
  useEffect(() => {
    if (!open || asked.current) return
    asked.current = true
    api.chatConversations.list().then((l) => setRows(l.filter((c) => c.kind !== 'stanley' && !c.closed)), () => { asked.current = false; setFailed(true) })
  }, [open])
  const send = useAction(async (c: ChatConversation) => {
    await api.chatConversations.sendTyped(c.id, { kind: 'card', shareRef }, newClientId())
    setSentTo(t('sendchat.sent', { name: c.name }))
  })
  return (
    <details className="send-chat" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{t('sendchat.title')}<span className="visually-hidden"> {title}</span></summary>
      <p role="status" className="visually-hidden">{sentTo}</p>
      {sentTo && <p className="muted">{sentTo}</p>}
      {open && !rows && !failed && <p role="status" className="muted">{t('conv.share.loading')}</p>}
      {failed && <p role="alert" className="field__error">{t('conv.share.failed')}</p>}
      {rows && rows.length === 0 && <p className="muted">{t('sendchat.none')}</p>}
      {rows && rows.length > 0 && (
        <ul className="chat-share__list">
          {rows.map((c) => (
            <li key={c.id}>
              <span>{c.name}</span>
              <Button variant="secondary" disabled={send.busy} aria-label={t('sendchat.to', { title, name: c.name })} onClick={() => void send.run(c)}>{t('conv.share.send')}</Button>
            </li>
          ))}
        </ul>
      )}
      {send.error && <p role="alert" className="field__error">{t(shareError(send.error))}</p>}
    </details>
  )
}
