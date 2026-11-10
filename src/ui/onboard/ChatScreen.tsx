import { useState } from 'react'
import type { ServiceThread } from '../../api/types'
import { channelById, CHANNELS, ESCALATE_AFTER_MINUTES, MAX_MESSAGE, type ChannelId } from '../../domain/chat'
import { GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { api } from '../../runtime'
import type { OutboxItem } from '../../data/outbox'
import { useAction } from '../../hooks/useAction'
import { useVisibleInterval } from '../../hooks/useVisibleInterval'
import { sendWithin, useOutbox, worthRetrying } from '../../hooks/useOutbox'
import { useOwnerId, usePersona } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { t, th as heading, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Chip } from '../Chip'
import { Field, TextArea } from '../Field'
import { Phone } from '../icons'
import { ActionError, Load, SupervisedNote } from '../account/parts'
import { duration, useShipTime } from './shipTime'
import { personFirstName } from '../../account/context'
import { People, RequestsBanner } from './ChatPeople'
import { Conversations } from './ChatConversations'
import { Children } from './ChatGuardian'

type Mode = 'chats' | 'people' | 'service' | 'children'

/** Chat (MSG-01, MSG-02, SUP-08): free messages with the travel party, and Guest Services by topic with visible response times and a phone call when waiting is too long. */
export function ChatScreen() {
  const [mode, setMode] = useState<Mode>('chats')
  // Only someone who supervises a child sees the guardian view; a failed check (offline, or acting as a child) just hides it.
  const kids = useMine(() => api.chatGuardian.children())
  const guardian = (kids.data?.length ?? 0) > 0
  return (
    <div className="page">
      <p>{t('chat.free')}</p>
      {mode !== 'people' && <RequestsBanner onOpen={() => setMode('people')} />}
      <div className="chip-row" role="group" aria-label={t('chat.who')}>
        <Chip pressed={mode === 'chats'} onToggle={() => setMode('chats')}>{t('chat.chats')}</Chip>
        <Chip pressed={mode === 'people'} onToggle={() => setMode('people')}>{t('chat.people')}</Chip>
        {guardian && <Chip pressed={mode === 'children'} onToggle={() => setMode('children')}>{t('guard.chip')}</Chip>}
        <Chip pressed={mode === 'service'} onToggle={() => setMode('service')}>{t('chat.service')}</Chip>
      </div>
      {mode === 'chats' ? <Conversations /> : mode === 'people' ? <People /> : mode === 'children' ? <Children /> : <Service />}
      <Card info>
        <p><Phone aria-hidden="true" /> {t('chat.urgent', { number: GUEST_SERVICES_NUMBER })} <a href={`tel:${GUEST_SERVICES_NUMBER}`}>{GUEST_SERVICES_NUMBER}</a></p>
      </Card>
    </div>
  )
}

function Service() {
  const me = usePersona()
  const [channel, setChannel] = useState<ChannelId>('guestServices')
  const channels = useMine(() => api.service.channels())
  const thread = useMine(() => api.service.thread(channel), [channel])
  const waiting = thread.data?.state?.status === 'waiting'
  useVisibleInterval(thread.retry, 10_000, waiting)
  const c = channelById(channel)!
  const minutes = channels.data?.find((x) => x.id === channel)?.minutes ?? c.minutes
  return (
    <section aria-labelledby="svc-h">
      <h2 id="svc-h">{heading('chat.service')}</h2>
      {me?.child && <SupervisedNote booker={personFirstName(me.booker)} />}
      <fieldset className="plain-fieldset">
        <legend>{t('chat.topic')}</legend>
        {CHANNELS.map((ch) => {
          const view = channels.data?.find((x) => x.id === ch.id)
          return (
            <label key={ch.id} className="choice choice--top">
              <input type="radio" name="svc-channel" checked={channel === ch.id} onChange={() => setChannel(ch.id)} />
              <span>{t(`chat.ch.${ch.id}` as StringKey)}<small>{t('chat.usually', { time: duration(view?.minutes ?? ch.minutes) })}{view?.unanswered ? ` · ${t('chat.waitingTag')}` : ''}</small></span>
            </label>
          )
        })}
      </fieldset>
      {c.urgentNote && <Banner kind="warning" title={t('chat.medicalUrgent')}><p>{t('chat.medicalUrgentBody')}</p></Banner>}
      <Load state={thread}>{(thr) => <Thread th={thr} minutes={minutes} reload={thread.retry} canWrite={!me?.child} />}</Load>
    </section>
  )
}

function Thread({ th, minutes, reload, canWrite }: { th: ServiceThread; minutes: number; reload: () => void; canWrite: boolean }) {
  const shipTime = useShipTime()
  const [text, setText] = useState('')
  const [phone, setPhone] = useState('')
  const ownerId = useOwnerId()
  const outbox = useOutbox(ownerId ?? 'none', 'service', (p) => api.service.send(p.channel as ChannelId, p.text), reload)
  const [full, setFull] = useState(false)
  const send = useAction(async () => {
    setFull(false)
    try { await sendWithin(api.service.send(th.channel, text)); setText(''); reload() }
    catch (e) { if (worthRetrying(e)) { if (outbox.hold({ channel: th.channel, text })) setText(''); else setFull(true) } else throw e }
  })
  const call = useAction(async () => { await api.service.escalate(th.channel, phone); setPhone(''); reload() })
  const st = th.state
  return (
    <>
      {th.slow && <Banner kind="warning" title={t('chat.slow')}><p>{t('chat.slowBody', { time: duration(minutes) })}</p></Banner>}
      {st && (
        <p role="status" className="chat-state">
          <strong>{t(`chat.status.${st.status}` as StringKey)}</strong>
          {st.status === 'waiting' && <> {t('chat.queue', { position: st.queue ?? 1, time: duration(Math.max(1, st.expectedMinutes - st.waitedMinutes)) })}</>}
        </p>
      )}
      {th.messages.length === 0 ? <p>{t('chat.noThread', { time: duration(minutes) })}</p> : (
        <ol className="chat-log" aria-label={t('chat.log')}>
          {th.messages.map((m) => (
            <li key={m.id} className={m.from === 'me' ? 'chat-msg chat-msg--mine' : 'chat-msg'}>
              <p className="chat-msg__meta"><strong>{m.from === 'me' ? t('chat.you') : m.crew}</strong> <span className="muted">{shipTime(m.at)}</span></p>
              <p>{m.text}</p>
            </li>
          ))}
        </ol>
      )}
      {canWrite && (
        <>
          <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) void send.run() }}>
            <TextArea label={t('chat.message')} value={text} maxLength={MAX_MESSAGE} onChange={(e) => setText(e.target.value)} />
            <ActionError error={send.error} />
            {send.error && <p className="muted">{t('chat.kept')}</p>}
            {full && <p role="alert" className="field__error">{t('outbox.full')}</p>}
            <Waiting items={outbox.items.filter((x) => x.payload.channel === th.channel)} />
            <Button type="submit" disabled={send.busy || !text.trim()}>{t('chat.send')}</Button>
          </form>
          {(st?.canEscalate || th.slow) && st?.status !== 'escalated' && (
            <Card info>
              <h3 className="card__title">{heading('chat.callMe')}</h3>
              <p>{t('chat.callMeBody', { minutes: ESCALATE_AFTER_MINUTES })}</p>
              <form onSubmit={(e) => { e.preventDefault(); void call.run() }}>
                <Field label={t('chat.phone')} help={t('helptip.callbackPhone')} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={call.error?.code === 'invalid' ? t('chat.phoneBad') : undefined} />
                {call.error && call.error.code !== 'invalid' && <ActionError error={call.error} />}
                <Button type="submit" variant="secondary" disabled={call.busy || !phone.trim()}>{t('chat.callMeSend')}</Button>
              </form>
            </Card>
          )}
        </>
      )}
    </>
  )
}

/** Messages that could not be sent yet. They go on their own when the link comes back, and stay here until then (NET-03). */
function Waiting({ items }: { items: readonly OutboxItem[] }) {
  if (items.length === 0) return null
  return (
    <div role="status" className="outbox">
      <p><strong>{t('box.title', { count: items.length })}</strong> {t('box.body')}</p>
      <ul className="plain-bullets">{items.map((x) => <li key={x.id}>{x.payload.text}</li>)}</ul>
    </div>
  )
}
