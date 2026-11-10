import { useEffect, useRef, useState } from 'react'
import type { ChatCard, ChatConversation, ChatMessage, ChatPin, ChatShareables } from '../../api/chatTypes'
import { isApiError } from '../../api/errors'
import { cardLink, cardSummary, cleanNote, isExpired, matchPeople, mentionParts, MAX_PINS, NOTE_MAX, sortPlaces, sortShareables, type MentionPerson } from '../../domain/chatCards'
import { newClientId } from '../../domain/chatThread'
import { clock12 } from '../../domain/planCard'
import { useAction } from '../../hooks/useAction'
import { useNow } from '../../hooks/useDemo'
import { api } from '../../runtime'
import { t, type StringKey } from '../../i18n'
import { Button, LinkButton } from '../Button'
import { useShipTime } from './shipTime'

const TYPE_KEY: Record<ChatCard['type'], StringKey> = {
  excursion: 'card.type.excursion', dining: 'card.type.dining', booking: 'card.type.booking', portDay: 'card.type.portDay', place: 'card.type.place', plan: 'card.type.plan',
}

const clock = (time: string): string => clock12(time)

/**
 * Something shared from the app, or a meeting point (phase 3). The server built the words, so the card shows only a title, when and where. A card opens the screen it came from; one the app cannot open says
 * it is no longer available. A meeting point says how long it is good for and, once the time has passed, that it has.
 */
export function CardMessage({ card }: { card: ChatCard }) {
  const now = useNow()
  const shipTime = useShipTime()
  const place = card.type === 'place'
  const expired = place && isExpired(card, now)
  const link = cardLink(card)
  const when = [card.day !== undefined ? t('card.day', { day: card.day }) : '', card.time ? clock(card.time) : ''].filter(Boolean).join(', ')
  return (
    <div className={['chat-card', `chat-card--${card.type}`, expired && 'chat-card--spent'].filter(Boolean).join(' ')} role="group" aria-label={`${t(TYPE_KEY[card.type])}: ${cardSummary(card, clock)}`}>
      <p className="chat-card__type"><strong>{t(TYPE_KEY[card.type])}</strong></p>
      <p className="chat-card__title">{card.title}</p>
      {card.subtitle && <p className="muted">{card.subtitle}</p>}
      {when && <p>{when}</p>}
      {card.place && card.place !== card.title && <p>{card.place}</p>}
      {card.note && <p>{card.note}</p>}
      {place && card.expiresAt !== undefined && <p className="muted">{expired ? t('card.place.expired') : t('card.place.until', { time: shipTime(card.expiresAt) })}</p>}
      {!place && (link ? <LinkButton to={link} variant="secondary" aria-label={t('card.open.label', { title: card.title })}>{t('card.open')}</LinkButton> : <p className="muted">{t('card.gone')}</p>)}
    </div>
  )
}

/** A message's words with each `@Name` in strong type; a screen reader still reads it as ordinary words. */
export function MessageWords({ text, mentionsYou }: { text: string; mentionsYou?: boolean }) {
  const parts = mentionParts(text)
  return (
    <p>
      {mentionsYou && <span className="visually-hidden">{t('mention.youLabel')}. </span>}
      {parts.map((p, i) => (p.mention ? <strong key={i} className="chat-mention">{p.text}</strong> : <span key={i}>{p.text}</span>))}
    </p>
  )
}

/** The pinned messages at the top of a conversation (up to three). A tap goes to the message; whoever may pin can unpin from here. */
export function PinBar({ pins, canPin, busy, onGo, onUnpin }: { pins: readonly ChatPin[]; canPin: boolean; busy: boolean; onGo: (messageId: string) => void; onUnpin: (messageId: string) => void }) {
  if (pins.length === 0) return null
  return (
    <section className="chat-pins" aria-label={t('pin.bar')}>
      <h3 className="chat-pins__title">{t('pin.bar')} <span className="muted">({pins.length}/{MAX_PINS})</span></h3>
      <ul>
        {pins.map((p) => (
          <li key={p.messageId} className="chat-pin">
            <button type="button" className="chat-pin__go" aria-label={t('pin.go', { who: p.fromName ?? t('chat.you'), text: p.text })} onClick={() => onGo(p.messageId)}>
              <strong>{p.fromName ?? t('chat.you')}</strong> <span>{p.text}</span>
            </button>
            {canPin && <button type="button" className="chat-act" disabled={busy} onClick={() => onUnpin(p.messageId)}>{t('pin.unpin')}</button>}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The people matching the `@word` being typed, as buttons under the box (Tab reaches them; Escape in the box dismisses them). */
export function MentionList({ people, query, onPick }: { people: readonly MentionPerson[]; query: string; onPick: (person: MentionPerson) => void }) {
  const found = matchPeople(people, query)
  if (found.length === 0) return null
  return (
    <div className="chat-mentions" role="group" aria-label={t('mention.list')}>
      <p role="status" className="visually-hidden">{t('mention.found', { count: found.length })}</p>
      <ul>
        {found.map((p) => <li key={p.id}><button type="button" className="chat-act" onClick={() => onPick(p)}>@{p.name}</button></li>)}
      </ul>
    </div>
  )
}

/** The words for a card that could not be sent: the thing is no longer on the trip, the note was not acceptable, or the chat has closed. */
export function shareError(e: unknown): StringKey {
  if (!isApiError(e)) return 'conv.share.failed'
  if (e.message === 'shareRef' || e.message === 'place') return 'conv.share.stale'
  if (e.message === 'blocked') return 'conv.blocked'
  if (e.message === 'contactInfo') return 'conv.contact'
  if (e.code === 'conflict') return 'conv.closed'
  return 'conv.share.failed'
}

/**
 * "Share from the app" and "Meet me here" in one place under the composer. It asks the server what can be shared the first time it is opened. A card is not held for later: it has to be true when it is sent.
 * People you mention in the note are not offered; a note is a short line.
 */
export function ShareChooser({ conversation, onSent }: { conversation: ChatConversation; onSent: (sent: ChatMessage) => void }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<ChatShareables | null>(null)
  const [failed, setFailed] = useState(false)
  const [placeId, setPlaceId] = useState('')
  const [note, setNote] = useState('')
  const [announce, setAnnounce] = useState('')
  const asked = useRef(false)
  useEffect(() => {
    if (!open || asked.current) return
    asked.current = true
    api.chatConversations.shareable().then(setData, () => { asked.current = false; setFailed(true) })
  }, [open])
  const send = useAction(async (input: Parameters<typeof api.chatConversations.sendTyped>[1]) => {
    const sent = await api.chatConversations.sendTyped(conversation.id, input, newClientId())
    setAnnounce(t('conv.share.sent'))
    onSent(sent)
    if (input.kind === 'place') { setNote(''); setPlaceId('') }
  })
  const items = data ? sortShareables(data.items) : []
  const places = data ? sortPlaces(data.places) : []
  return (
    <details className="chat-share" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{t('conv.share')}</summary>
      <p className="muted">{t('conv.share.hint')}</p>
      <p role="status" className="visually-hidden">{announce}</p>
      {open && !data && !failed && <p role="status" className="muted">{t('conv.share.loading')}</p>}
      {failed && <p role="alert" className="field__error">{t('conv.share.failed')}</p>}
      {data && (
        <>
          <h3>{t('conv.share.fromTrip')}</h3>
          {items.length === 0
            ? <p className="muted">{t('conv.share.none')}</p>
            : (
              <ul className="chat-share__list">
                {items.map((s) => (
                  <li key={s.ref}>
                    <span><strong>{t(TYPE_KEY[s.type])}</strong> {s.title}{(s.day !== undefined || s.time) && <span className="muted"> · {[s.day !== undefined ? t('card.day', { day: s.day }) : '', s.time ? clock(s.time) : ''].filter(Boolean).join(', ')}</span>}</span>
                    <Button variant="secondary" disabled={send.busy} aria-label={t('conv.share.send.label', { title: s.title })} onClick={() => void send.run({ kind: 'card', shareRef: s.ref })}>{t('conv.share.send')}</Button>
                  </li>
                ))}
              </ul>
            )}
          <h3>{t('card.place.title')}</h3>
          <form onSubmit={(e) => { e.preventDefault(); if (placeId) void send.run({ kind: 'place', placeId, ...(cleanNote(note) ? { note: cleanNote(note) } : {}) }) }}>
            <div className="field">
              <label htmlFor="meet-place">{t('card.place.pick')}</label>
              <select id="meet-place" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
                <option value="">{t('card.place.choose')}</option>
                {places.map((p) => <option key={p.id} value={p.id}>{p.name} ({t('card.place.deck', { deck: p.deck })})</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="meet-note">{t('card.place.note')}</label>
              <input id="meet-note" type="text" value={note} maxLength={NOTE_MAX} autoComplete="off" onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button type="submit" disabled={send.busy || !placeId}>{t('card.place.send')}</Button>
          </form>
        </>
      )}
      {send.error && <p role="alert" className="field__error">{t(shareError(send.error))}</p>}
    </details>
  )
}
