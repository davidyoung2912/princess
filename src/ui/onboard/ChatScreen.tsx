import { deliveryOf } from '../../domain/chat'
import { optimistic } from '../../data/optimistic'
import { useEffect, useState } from 'react'
import type { Message, ServiceThread } from '../../api/types'
import { channelById, CHANNELS, ESCALATE_AFTER_MINUTES, MAX_MESSAGE, type ChannelId } from '../../domain/chat'
import { GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { MAX_PLAN_DAY } from '../../domain/nightsRules'
import { addPlanCard, encodePlanCard, hasPlanCard, newPlanCard, parsePlanCard, PLACE_MAX, planCardSentence, type PlanCard } from '../../domain/planCard'
import { useMemory } from '../../hooks/useMemory'

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
import { DeferredImage } from '../DeferredImage'
import { Card } from '../Card'
import { Chip } from '../Chip'
import { Field, TextArea } from '../Field'
import { Phone } from '../icons'
import { ActionError, Load, SupervisedNote } from '../account/parts'
import { duration, useShipTime } from './shipTime'
import { BlockedList, MessageSafety, PhotoSender } from '../aboard/ChatSafe'
import { personFirstName } from '../../account/context'

type Mode = 'party' | 'service'

/** Chat (MSG-01, MSG-02, SUP-08): free messages with the travel party, and Guest Services by topic with visible response times and a phone call when waiting is too long. */
export function ChatScreen() {
  const [mode, setMode] = useState<Mode>('party')
  return (
    <div className="page">
      <p>{t('chat.free')}</p>
      <div className="chip-row" role="group" aria-label={t('chat.who')}>
        <Chip pressed={mode === 'party'} onToggle={() => setMode('party')}>{t('chat.party')}</Chip>
        <Chip pressed={mode === 'service'} onToggle={() => setMode('service')}>{t('chat.service')}</Chip>
      </div>
      {mode === 'party' ? <Party /> : <Service />}
      <Card info>
        <p><Phone aria-hidden="true" /> {t('chat.urgent', { number: GUEST_SERVICES_NUMBER })} <a href={`tel:${GUEST_SERVICES_NUMBER}`}>{GUEST_SERVICES_NUMBER}</a></p>
      </Card>
    </div>
  )
}

function Party() {
  const me = usePersona()
  const ownerId = useOwnerId()
  const shipTime = useShipTime()
  const list = useMine(() => api.messages.list())
  const receipts = useMine(() => api.messages.receipts())
  const [text, setText] = useState('')
  const [blockedVersion, setBlockedVersion] = useState(0)
  const outbox = useOutbox(ownerId ?? 'none', 'chat', (p) => api.messages.send(p.text), () => list.retry())
  const [full, setFull] = useState(false)
  const send = useAction(async () => {
    setFull(false)
    try { await sendWithin(api.messages.send(text)); setText(''); list.retry() }
    catch (e) { if (worthRetrying(e)) { if (outbox.hold({ text })) setText(''); else setFull(true) } else throw e }
  })
  // The switch moves at once and goes back if saving fails (PERF-04).
  const [shownReceipts, setShownReceipts] = useState<boolean | null>(null)
  const receiptsOn = shownReceipts ?? receipts.data === true
  const flip = useAction(async (on: boolean) => {
    await optimistic(() => setShownReceipts(on), () => api.messages.setReceipts(on), () => setShownReceipts(null))
    receipts.retry(); list.retry(); setShownReceipts(null)
  })
  const seen = useAction(async () => { await api.messages.markSeen(); list.retry() })
  useEffect(() => { if (list.status === 'ready' && receipts.data) void api.messages.markSeen() }, [list.status, list.data?.length, receipts.data])
  const name = (m: Message) => (m.from === me?.id ? t('chat.you') : (personFirstName(m.from) || m.from))
  return (
    <section aria-labelledby="party-h">
      <h2 id="party-h">{heading('chat.party')}</h2>
      <p className="muted">{t('chat.partyBody')}</p>
      <Load state={list}>
        {(messages) => (
          <>
            {messages.length === 0 ? <p>{t('chat.none')}</p> : (
              <ol className="chat-log" aria-label={t('chat.log')}>
                {messages.map((m) => (
                  <li key={m.id} className={m.from === me?.id ? 'chat-msg chat-msg--mine' : 'chat-msg'}>
                    <p className="chat-msg__meta"><strong>{name(m)}</strong> <span className="muted">{shipTime(m.at)}</span></p>
                    {m.text && (parsePlanCard(m.text) ? <PlanCardView card={parsePlanCard(m.text)!} /> : <p>{m.text}</p>)}
                    {m.photo && <ChatPhoto src={m.photo} name={name(m)} />}
                    {m.from !== me?.id && <MessageSafety messageId={m.id} from={m.from} onBlocked={() => { list.retry(); setBlockedVersion(blockedVersion + 1) }} />}
                    {m.from === me?.id && <p className="muted">{t(`chat.delivery.${deliveryOf(m)}` as StringKey)}</p>}
                    {m.seenBy && m.seenBy.length > 0 && <p className="muted">{t('chat.seenBy', { names: m.seenBy.map((id) => (personFirstName(id) || id)).join(', ') })}</p>}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </Load>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) void send.run() }}>
        <Field label={t('chat.message')} value={text} maxLength={MAX_MESSAGE} onChange={(e) => setText(e.target.value)} autoComplete="off" />
        <ActionError error={send.error} />
        {send.error && <p className="muted">{t('chat.kept')}</p>}
        {full && <p role="alert" className="field__error">{t('outbox.full')}</p>}
        <Waiting items={outbox.items} />
        <div className="button-row">
          <Button type="submit" disabled={send.busy || !text.trim()}>{t('chat.send')}</Button>
          <Button variant="tertiary" onClick={() => void seen.run()}>{t('chat.refresh')}</Button>
        </div>
      </form>
      <div className="chip-row">
        <Chip pressed={receiptsOn} onToggle={() => void flip.run(!receiptsOn)}>{t('chat.receipts')}</Chip>
      </div>
      <p className="muted">{t('chat.receiptsBody')}</p>
      <p className="muted">{t('chat.noPreview')}</p>
      <PlanCardSender onSent={() => list.retry()} />
      <PhotoSender onSent={() => list.retry()} />
      <BlockedList version={blockedVersion} reload={list.retry} />
      <p className="muted">{t('chat.photos')}</p>
    </section>
  )
}

/** A photo in the chat. In data-light mode it waits to be asked for, so nothing is fetched on its own (NET-04, PERF-05). */
function ChatPhoto({ src, name }: { src: string; name: string }) {
  return <DeferredImage name={name} className="chat-msg__photo" src={src} alt={t('chat.photoAlt', { name })} />
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
                <Field label={t('chat.phone')} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={call.error?.code === 'invalid' ? t('chat.phoneBad') : undefined} />
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

/** A plan card in the chat, with a button that adds it to the guest's own plan day. */
function PlanCardView({ card }: { card: PlanCard }) {
  const { state, update } = useMemory()
  const added = hasPlanCard(state.pasted, card)
  const full = !added && addPlanCard(state.pasted, card).length === state.pasted.length
  return (
    <div className="plan-card">
      <p><strong>{planCardSentence(card)}</strong></p>
      <Button variant="secondary" disabled={added || full} onClick={() => update((m) => ({ ...m, pasted: addPlanCard(m.pasted, card) }))}>{added ? t('chat.card.added') : t('chat.card.add')}</Button>
      {full && <p className="muted">{t('chat.card.full')}</p>}
    </div>
  )
}

/** Sends a meeting as a card instead of a line of text (C01). */
function PlanCardSender({ onSent }: { onSent: () => void }) {
  const [place, setPlace] = useState('')
  const [day, setDay] = useState(1)
  const [time, setTime] = useState('19:00')
  const card = newPlanCard(day, time, place)
  const send = useAction(async () => { if (card) { await api.messages.send(encodePlanCard(card)); setPlace(''); onSent() } })
  return (
    <details className="plan-card-form">
      <summary>{t('chat.card.title')}</summary>
      <p className="muted">{t('chat.card.hint')}</p>
      <form onSubmit={(e) => { e.preventDefault(); void send.run() }}>
        <Field label={t('chat.card.place')} value={place} maxLength={PLACE_MAX} onChange={(e) => setPlace(e.target.value)} autoComplete="off" />
        <div className="field">
          <label htmlFor="card-day">{t('chat.card.day')}</label>
          <select id="card-day" value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {Array.from({ length: MAX_PLAN_DAY }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <Field label={t('chat.card.time')} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <ActionError error={send.error} />
        <Button type="submit" disabled={send.busy || !card}>{t('chat.card.send')}</Button>
      </form>
    </details>
  )
}
