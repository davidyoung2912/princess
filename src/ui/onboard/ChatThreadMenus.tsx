import { useEffect, useRef, useState } from 'react'
import type { ChatConversation, ChatMessage } from '../../api/chatTypes'
import { isApiError } from '../../api/errors'
import { optimistic } from '../../data/optimistic'
import { newClientId } from '../../domain/chatThread'
import { isMuted, MUTE_LENGTHS, type MuteLength } from '../../domain/chatControl'
import { REPORT_REASONS, type ChatReportReason } from '../../domain/services'
import { KeepSection } from './ChatKeep'
import { addPlanCard, encodePlanCard, hasPlanCard, newPlanCard, PLACE_MAX, planCardSentence, type PlanCard } from '../../domain/planCard'
import { MAX_PLAN_DAY } from '../../domain/nightsRules'
import { useAction } from '../../hooks/useAction'
import { useMemory } from '../../hooks/useMemory'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { t, type StringKey, headingCase } from '../../i18n'
import { Dialog } from '../Dialog'
import { Button } from '../Button'
import { Chip } from '../Chip'
import { GroupStanleySwitch } from './ChatMoments'
import { EllipsisVertical } from 'lucide-react'

/** A small icon for each quick reply; the words are its label. */
/** The quick replies in rows of related ones: answers, getting together, and feelings. */
import { Field } from '../Field'
import { ActionError } from '../account/parts'
import { BlockedList } from '../aboard/ChatSafe'
import { useShipTime } from './shipTime'
import { GetPersonButton, RecapCard } from './ChatRelay'
import { RemainingCard, RemindersSwitch } from './ChatCoordinator'
import { HostPanel } from './ChatHost'
import { ChatSearch, SaveChat } from './ChatSearch'
import { PhotosGallery } from './ChatPhotos'
import { isSearchable } from '../../domain/chatSearch'
import { isRoomChat } from '../../domain/chatRooms'
import { MUTE_KEY } from './chatConversationShared'

/**
 * The chat's header menu: mute (for an hour, a day, a week or until turned back on), archive, and for the people in it Block and Report. A report goes with their latest message so the moderators can see
 * what was said; a block only hides them from you. Escape closes it and focus returns to the button.
 */
export function ChatMenu({ conversation, messages, now, busy, onMute, onArchive, onBlocked, onFind }: {
  conversation: ChatConversation; messages: readonly ChatMessage[]; now: number; busy: boolean; onMute: (on: boolean, length?: MuteLength) => void; onArchive: (on: boolean) => void; onBlocked: () => void; onFind: (messageId: string) => void
}) {
  const [finding, setFinding] = useState(false)
  const [gallery, setGallery] = useState(false)
  const shipTime = useShipTime()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const people = conversation.people ?? []
  const [personId, setPersonId] = useState('')
  const person = people.find((p) => p.id === personId) ?? people[0]
  const [reason, setReason] = useState<ChatReportReason>('rude')
  const [reported, setReported] = useState<'done' | 'nothing' | null>(null)
  const block = useAction(async () => { if (person) { await api.aboard.chat.block(person.id, true); onBlocked(); setOpen(false) } })
  const report = useAction(async () => {
    if (!person) return
    try { await api.chatConversations.reportPerson(conversation.id, person.id, reason); setReported('done') } catch (e) { if (isApiError(e) && e.code === 'notFound') setReported('nothing'); else throw e }
  })
  useEffect(() => { if (open) root.current?.querySelector<HTMLElement>('.chat-menu__panel button, .chat-menu__panel select')?.focus() }, [open])
  const close = () => { setOpen(false); root.current?.querySelector<HTMLElement>('[aria-expanded]')?.focus() }
  const muted = isMuted(conversation, now)
  return (
    <>
    {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape is a shortcut for a menu whose controls all work by themselves */}
    <div ref={root} className="chat-menu" onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); close() } }}>
      <Button variant="secondary" icon={EllipsisVertical} aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>{t('conv.menu')}</Button>
      {open && (
        <div className="chat-menu__panel" role="group" aria-label={t('conv.menu')}>
          <h3>{headingCase(t('conv.menuMute'))}</h3>
          {muted ? (
            <>
              <p className="muted">{conversation.mutedUntil ? t('conv.mutedUntil', { time: shipTime(conversation.mutedUntil) }) : t('conv.mutedNoEnd')}</p>
              <div className="button-row"><Button variant="secondary" disabled={busy} onClick={() => onMute(false)}>{t('conv.unmute')}</Button></div>
            </>
          ) : (
            <div className="button-row">
              {MUTE_LENGTHS.map((l) => <Button key={l} variant="secondary" disabled={busy} onClick={() => { onMute(true, l); close() }}>{t(MUTE_KEY[l])}</Button>)}
            </div>
          )}
          <p className="muted">{t('conv.muteBody')}</p>
          {isSearchable(conversation) && (
            <>
              <div className="button-row"><Button variant="secondary" onClick={() => setFinding(true)}>{t('csearch.inChat')}</Button></div>
              <div className="button-row"><Button variant="secondary" onClick={() => setGallery(true)}>{t('cphoto.gallery')}</Button></div>
              <SaveChat conversationId={conversation.id} />
            </>
          )}
          <div className="button-row"><Button variant="secondary" disabled={busy} onClick={() => onArchive(!conversation.archived)}>{t(conversation.archived ? 'conv.unarchive' : 'conv.archive')}</Button></div>
          {!conversation.permanent && !conversation.closed && !isRoomChat(conversation) && <KeepSection conversationId={conversation.id} />}
          {person && (
            <>
              <h3>{headingCase(t('conv.menuPerson'))}</h3>
              {people.length > 1 && (
                <div className="field">
                  <label htmlFor="menu-person">{t('conv.menuPerson')}</label>
                  <select id="menu-person" className="field__input" value={person.id} onChange={(e) => { setPersonId(e.target.value); setReported(null) }}>
                    {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              {people.length === 1 && <p><strong>{person.name}</strong></p>}
              <div className="button-row"><Button variant="secondary" disabled={block.busy} onClick={() => void block.run()}>{t('conv.menuBlock', { name: person.name })}</Button></div>
              <div className="field">
                <label htmlFor="menu-reason">{t('safe.reason')}</label>
                <select id="menu-reason" className="field__input" value={reason} onChange={(e) => setReason(e.target.value as ChatReportReason)}>
                  {REPORT_REASONS.map((r) => <option key={r} value={r}>{t(`safe.r.${r}` as StringKey)}</option>)}
                </select>
              </div>
              <div className="button-row"><Button variant="secondary" disabled={report.busy} onClick={() => void report.run()}>{t('conv.menuReport', { name: person.name })}</Button></div>
              <p className="muted">{t('conv.menuReportBody')}</p>
              {reported === 'done' && <p role="status">{t('conv.menuReported')}</p>}
              {reported === 'nothing' && <p role="status">{t('conv.menuNothing', { name: person.name })}</p>}
              <ActionError error={block.error ?? report.error} />
            </>
          )}
        </div>
      )}
    </div>
    {gallery && (
      <Dialog title={t('cphoto.gallery')} onClose={() => setGallery(false)}>
        <PhotosGallery conversationId={conversation.id} messages={messages} you={t('chat.you')} />
      </Dialog>
    )}
    {finding && (
      <Dialog title={t('csearch.inChat')} onClose={() => setFinding(false)}>
        <ChatSearch conversationId={conversation.id} onPick={(h) => { setFinding(false); setOpen(false); setTimeout(() => onFind(h.messageId), 0) }} />
      </Dialog>
    )}
    </>
  )
}

/** Everything that is not the message itself: mute, read receipts, a plan card, a photo, and who you have hidden. */
export function Options({ conversation, messages, awayBusy, onAway, mentionsBusy, onMentionsOnly, onSent, blockedVersion, reload }: {
  conversation: ChatConversation; messages: ChatMessage[]; awayBusy: boolean; onAway: (on: boolean) => void; mentionsBusy: boolean; onMentionsOnly: (on: boolean) => void; onSent: () => void; blockedVersion: number; reload: () => void
}) {
  const receipts = useMine(() => api.messages.receipts())
  const [shown, setShown] = useState<boolean | null>(null)
  const on = shown ?? receipts.data === true
  // The switch moves at once and goes back if saving fails (PERF-04).
  const flip = useAction(async (next: boolean) => {
    await optimistic(() => setShown(next), () => api.messages.setReceipts(next), () => setShown(null))
    receipts.retry(); reload(); setShown(null)
  })
  return (
    <details className="chat-options">
      <summary>{headingCase(t('conv.options'))}</summary>
      <div className="chip-row">
        <Chip pressed={conversation.notifyAway === true} onToggle={() => { if (!awayBusy) onAway(conversation.notifyAway !== true) }}>{t('conv.away')}</Chip>
      </div>
      <p className="muted">{t('conv.awayBody')}</p>
      {conversation.kind !== 'direct' && (
        <>
          <div className="chip-row">
            <Chip pressed={conversation.mentionsOnly === true} onToggle={() => { if (!mentionsBusy) onMentionsOnly(conversation.mentionsOnly !== true) }}>{t('mention.only')}</Chip>
          </div>
          <p className="muted">{t('mention.only.hint')}</p>
        </>
      )}
      {conversation.kind === 'group' && <GroupStanleySwitch groupId={conversation.id} />}
      {conversation.kind === 'group' && <RemainingCard />}
      {conversation.kind === 'group' && <RemindersSwitch groupId={conversation.id} />}
      {conversation.kind === 'group' && <RecapCard groupId={conversation.id} />}
      {conversation.kind === 'group' && <HostPanel conversation={conversation} />}
      {(conversation.kind !== 'direct' || !conversation.closed) ? <GetPersonButton conversationId={conversation.id} messages={messages} /> : null}
      <div className="chip-row">
        <Chip pressed={on} onToggle={() => void flip.run(!on)}>{t('chat.receipts')}</Chip>
      </div>
      <ActionError error={flip.error} />
      <p className="muted">{t('chat.receiptsBody')}</p>
      <p className="muted">{t('chat.noPreview')}</p>
      {!conversation.closed && (
        <>
          <PlanCardSender conversationId={conversation.id} onSent={onSent} />
        </>
      )}
      <BlockedList version={blockedVersion} reload={reload} />
      <p className="muted">{t('chat.photos')}</p>
    </details>
  )
}

/** A plan card in the chat, with a button that adds it to the guest's own plan day. */
export function PlanCardView({ card }: { card: PlanCard }) {
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
export function PlanCardSender({ conversationId, onSent }: { conversationId: string; onSent: () => void }) {
  const [place, setPlace] = useState('')
  const [day, setDay] = useState(1)
  const [time, setTime] = useState('19:00')
  const card = newPlanCard(day, time, place)
  const send = useAction(async () => { if (card) { await api.chatConversations.send(conversationId, encodePlanCard(card), newClientId()); setPlace(''); onSent() } })
  return (
    <details className="plan-card-form">
      <summary>{headingCase(t('chat.card.title'))}</summary>
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

/** What a channel or room says about itself above the thread: its topic, a note on plain text, and slow mode when it applies. */
export function RoomNotes({ room }: { room: ChatConversation }) {
  const info = room.room
  if (!info) return null
  return (
    <>
      {info.topic && <p className="muted">{info.topic} · {t('room.members', { count: info.members })}</p>}
      {info.slow && <p className="muted" role="note">{t('room.slow')}</p>}
      {room.kind === 'room' && <p className="muted" role="note">{t('room.noRoom')}</p>}
    </>
  )
}

