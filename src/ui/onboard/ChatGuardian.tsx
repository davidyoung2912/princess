import { useCallback, useEffect, useState } from 'react'
import type { ChatChild, ChatConversation, ChatMessage } from '../../api/chatTypes'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { t, th as heading } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { ActionError, Load } from '../account/parts'
import { useShipTime } from './shipTime'
import { KeepSection } from './ChatKeep'

/**
 * A guardian's read-only view of a supervised child's chats (docs/chat-plan.md, 4.6 and phase 7). It says first that every read is recorded and that the other people in the chat are told a guardian can read it.
 * Nothing here can send, mark read or change anything as the child.
 */
export function Children() {
  const kids = useMine(() => api.chatGuardian.children())
  const [child, setChild] = useState<ChatChild | null>(null)
  return (
    <section aria-labelledby="guard-h">
      <h2 id="guard-h">{heading('guard.title')}</h2>
      <p>{t('guard.body')}</p>
      <Load state={kids}>
        {(list) => child ? <ChildChats child={child} onBack={() => setChild(null)} /> : (
          list.length === 0 ? <p>{t('guard.none')}</p> : (
            <ul className="plain-bullets" aria-label={t('guard.title')}>
              {list.map((k) => <li key={k.id}><Button variant="secondary" onClick={() => setChild(k)}>{t('guard.open', { name: k.name })}</Button></li>)}
            </ul>
          )
        )}
      </Load>
    </section>
  )
}

function ChildChats({ child, onBack }: { child: ChatChild; onBack: () => void }) {
  const rows = useMine(() => api.chatGuardian.conversations(child.id), [child.id])
  const [open, setOpen] = useState<ChatConversation | null>(null)
  if (open) return <ChildThread child={child} conversation={open} onBack={() => setOpen(null)} />
  return (
    <div>
      <Button variant="tertiary" onClick={onBack}>{t('guard.back')}</Button>
      <h3>{t('guard.chatsOf', { name: child.name })}</h3>
      <p className="muted">{t('guard.recorded')}</p>
      <Load state={rows}>
        {(list) => list.length === 0 ? <p>{t('conv.none')}</p> : (
          <ul className="conv-list" aria-label={t('guard.chatsOf', { name: child.name })}>
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" className="conv" onClick={() => setOpen(c)}>
                  <span className="conv__body">
                    <strong>{c.name}</strong>
                    {c.last && <span className="muted">{c.last.photo && !c.last.text ? t('guard.photo') : c.last.text}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Load>
    </div>
  )
}

function ChildThread({ child, conversation, onBack }: { child: ChatChild; conversation: ChatConversation; onBack: () => void }) {
  const shipTime = useShipTime()
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [more, setMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const load = useCallback(() => {
    api.chatGuardian.thread(child.id, conversation.id).then(
      (th) => { setMessages(th.messages); setMore(th.hasMore); setFailed(false) },
      () => setFailed(true),
    )
  }, [child.id, conversation.id])
  // oxlint-disable-next-line react/set-state-in-effect -- loading from the server is the external system this effect synchronizes with
  useEffect(() => { load() }, [load])
  const older = useAction(async () => {
    const first = messages?.[0]
    if (!first) return
    const th = await api.chatGuardian.thread(child.id, conversation.id, first.id)
    setMessages((cur) => [...th.messages, ...(cur ?? [])])
    setMore(th.hasMore)
  })
  return (
    <div>
      <Button variant="tertiary" onClick={onBack}>{t('guard.backChats')}</Button>
      <h3>{t('guard.thread', { name: conversation.name, child: child.name })}</h3>
      <p className="muted">{t('guard.readOnly')}</p>
      {!conversation.permanent && !conversation.closed && <KeepSection conversationId={conversation.id} childId={child.id} />}
      {failed && <Banner kind="offline" title={t('conv.offline')} action={<Button variant="secondary" onClick={load}>{t('ref.retry')}</Button>} />}
      {!messages && !failed && <p role="status" className="muted">{t('account.loading')}</p>}
      {more && <Button variant="secondary" disabled={older.busy} onClick={() => void older.run()}>{t('conv.earlier')}</Button>}
      <ActionError error={older.error} />
      {messages && (messages.length === 0 ? <p>{t('chat.none')}</p> : (
        <ol className="chat-log" aria-label={t('guard.thread', { name: conversation.name, child: child.name })}>
          {messages.map((m) => m.system
            ? <li key={m.id} className="chat-msg chat-msg--system"><p className="muted">{m.text} · {shipTime(m.at)}</p></li>
            : (
              <li key={m.id} className={m.from === child.id ? 'chat-msg chat-msg--mine' : 'chat-msg'}>
                <p className="chat-msg__meta"><strong>{m.from === child.id ? child.name : (m.fromName ?? '')}</strong> <span className="muted">{shipTime(m.at)}</span></p>
                {m.text && <p>{m.text}</p>}
                {m.photo && <p className="muted">{t('guard.photo')}</p>}
              </li>
            ))}
        </ol>
      ))}
    </div>
  )
}
