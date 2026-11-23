import type { ReactNode } from 'react'
import { Fragment, memo, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import stanleyPicture from '../../assets/stanley-small.png'
import { useStanleyAsk, useStanleyBusy } from '../ai/useStanleyAsk'
import { GroupStanleyPills } from '../ai/GroupStanleyPills'
import { StanleyReply } from '../ai/StanleyReply'
import { getStanleyThread, setStanleyThread, subscribeStanley } from '../../ai/stanley'
import { needsYou, noticeBody, noticeHeadline, noticeState, pushPrompt, questionFrom, safeNoticePath, startsDay, threadItems } from '../../domain/stanleyThread'
import type { ChatConversation, ChatMessage, ChatQuote, ChatReaction } from '../../api/chatTypes'
import { isApiError } from '../../api/errors'
import { canTarget, deliveryOf, MAX_TEXT, quoteSummary } from '../../domain/chatThread'
import { chipLabel, myReaction, REACTIONS } from '../../domain/chatReactions'
import { parseBundle } from '../../domain/chatBundles'
import { ShareButton } from './ShareButton'
import { isTyped, pinOffer } from '../../domain/chatCards'
import { canEdit, changeProblem, windowLeft, type ChangeProblem } from '../../domain/chatControl'
import { useLongPress } from '../../hooks/useLongPress'
import { ackedCount, urgencyOf } from '../../domain/chatUrgency'
import { parsePlanCard } from '../../domain/planCard'
import { useLatest } from '../../hooks/useLatest'
import { useNow } from '../../hooks/useDemo'
import { t, headingCase } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { ChatNoticeOffers } from './ChatNoticeOffers'
import { MomentButtons, StanleySuggestions } from './ChatMoments'
import { BellRing, Pencil, Pin as PinIcon, PinOff, Reply as ReplyIcon, Smile, ThumbsUp, Trash2, UserPlus, UserMinus, Info } from 'lucide-react'

/** A small icon for each quick reply; the words are its label. */
/** The quick replies in rows of related ones: answers, getting together, and feelings. */
import { TextArea } from '../Field'
import { ClearDraft } from '../ClearDraft'
import { MessageSafety } from '../aboard/ChatSafe'
import { BundleCard } from './BundleCard'
import { CardMessage, MessageWords } from './ChatCards'
import { PlanMessage, PollMessage } from './ChatPlanning'
import { BoardMessage } from './ChatBoard'
import { CoordinatorButton } from './ChatCoordinator'
import { FlagToStaff } from './ChatHost'
import { StanleyMessageActions } from './ChatStanley'
import { MessagePhotos } from './ChatPhotos'
import { ChatAvatar, GreetFace, MyChatAvatar } from './ChatLooks'
import { subscribeGreeting, withGreeting } from '../../chat/greet'
import { photoCountOf } from '../../domain/chatPhotos'
import { isPlan, isPoll } from '../../domain/chatPlanning'
import { UrgencyTag } from './ChatConversationList'
import { PlanCardView } from './ChatThreadMenus'
import { LANE_KEY, PROBLEM_KEY, keepCardInView, noop, prefersReducedMotion } from './chatConversationShared'
import { stanleyAnswerItem, typingText } from './chatConversationHelpers'

/**
 * The permanent Stanley chat's log: the notices and lines the server holds, and the questions and answers held on this device, in time order. A second device shows the notices only.
 * The device's history is the Ask dialog's, so a question asked there appears here and the other way round.
 */
export function StanleyItems({ messages, mine, shipTime, conversationId, ackBusy, onAck, onChanged, onBlocked, onDelete }: {
  messages: ChatMessage[]; mine: string; shipTime: (at: number) => string; conversationId: string; ackBusy: boolean; onAck: (messageId: string) => void; onChanged: () => void; onBlocked: () => void; onDelete: (messageId: string) => Promise<void>
}) {
  const device = useSyncExternalStore(subscribeStanley, getStanleyThread)
  const waiting = useStanleyBusy()
  // The server's "I'm now speaking for ..." lines are left out: the cards no longer name the ship, so a change of voice needs no marker.
  const items = threadItems(messages.filter((m) => !m.system && !m.deleted), device)
  const dots = waiting ? <li key="waiting" className="chat-msg chat-msg--answer"><p className="chat-msg__meta"><img className="chat-msg__stanley" src={stanleyPicture} alt="" width={28} height={28} /><strong>{t('stanley.chat.reply')}</strong></p><p role="status" className="muted stanley__typing"><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><span className="visually-hidden">{t('stanley.typing')}</span></p></li> : null
  const rows = items.map((item, i) => {
    const heading = startsDay(items, i) ? <li key={`h:${item.key}`} className="chat-day"><h3>{new Date(item.at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</h3></li> : null
    const row = ((): ReactNode => {
    if (item.kind === 'server') return <MessageRow key={item.key} m={item.message} mine={mine} shipTime={shipTime} conversationId={conversationId} kind="stanley" peerName="" ackBusy={ackBusy} onAck={onAck} onChanged={onChanged} onBlocked={onBlocked} onDelete={onDelete} />
    const asked = item.kind === 'question'
    return (
      <li key={item.key} className={asked ? 'chat-msg chat-msg--mine' : 'chat-msg chat-msg--answer'}>
        <p className="chat-msg__meta">{asked ? <MyChatAvatar small /> : <GreetFace name="Stanley"><img className="chat-msg__stanley" src={stanleyPicture} alt="" width={28} height={28} /></GreetFace>}<strong>{asked ? t('stanley.chat.asked') : t('stanley.chat.reply')}</strong> <span className="muted chat-msg__time">{shipTime(item.at)}</span></p>
        {asked ? <p>{item.text}</p> : <StanleyReply m={item.turn} />}
        <DeleteStanleyMessage onDelete={async () => setStanleyThread(getStanleyThread().filter((x) => x.id !== item.key.slice(2)))} />
      </li>
    )
    })()
    return <Fragment key={item.key}>{heading}{row}</Fragment>
  })
  return <>{rows}{dots}</>
}

/** The strip at the top of Stanley's thread: critical and important notices still waiting for Got it, so a guest who scrolled past forty messages still sees what is outstanding. */
export function NeedsYouStrip({ messages, ackBusy, onAck }: { messages: ChatMessage[]; ackBusy: boolean; onAck: (messageId: string) => void }) {
  const now = useNow()
  const waiting = needsYou(messages, now).filter((m) => !m.deleted && m.text.trim() !== '')   // a deleted notice has nothing left to confirm
  if (waiting.length === 0) return null
  return (
    <section className="chat-needs" aria-labelledby="needs-h">
      <h3 id="needs-h" className="chat-needs__title"><BellRing aria-hidden="true" strokeWidth={2.5} />{headingCase(t('stanley.notice.needsTitle'))}</h3>
      <p>{t('stanley.notice.needsBody')}</p>
      <ul>
        {waiting.map((m) => (
          <li key={m.id}>
            <p className="chat-needs__what">{noticeHeadline(m.text)}</p>
            <div className="button-row"><Button icon={ThumbsUp} disabled={ackBusy} onClick={() => onAck(m.id)}>{t('urgent.gotIt')}</Button></div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The permission prompt in the thread: asked at a meaningful moment, with a link to the settings screen that does the asking, and a plain note once declined. */
export function PushPromptNote({ prompt }: { prompt: ReturnType<typeof pushPrompt> }) {
  if (prompt === null) return null
  return prompt === 'ask'
    ? <Banner kind="info" title={t('stanley.chat.pushAskTitle')} action={<LinkButton to="/me/notifications">{t('stanley.chat.pushAskLink')}</LinkButton>}><p>{t('stanley.chat.pushAskBody')}</p></Banner>
    : <Banner kind="info" title={t('stanley.chat.pushDeclinedTitle')}><p>{t('stanley.chat.pushDeclinedBody')}</p></Banner>
}

/** The free-text box. The question is asked and answered right here, on the chat page: it and the answer land in the thread above (the same in-memory thread his dialog uses), with waiting dots until it does. */
export function AskStanley() {
  const [text, setText] = useState('')
  const { submit, busy, problem, cooldown } = useStanleyAsk()
  const ask = questionFrom(text)
  const form = useRef<HTMLFormElement>(null)
  const greet = useLatest((name: string) => {
    const box = form.current?.querySelector('textarea')
    if (!box) return
    const next = withGreeting(text, name)
    if (next !== text) setText(next)
    box.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    requestAnimationFrame(() => { box.focus({ preventScroll: true }); box.setSelectionRange(next.length, next.length) })
  })
  useEffect(() => subscribeGreeting(greet), [greet])
  return (
    <div className="composer composer--ask">
      <form ref={form} className="composer composer--chat" onSubmit={(e) => { e.preventDefault(); if (ask) void submit(ask, () => setText('')) }}>
        <TextArea clear={false} label={t('stanley.chat.askLabel')} value={text} rows={2} maxLength={500} autoComplete="off" onChange={(e) => setText(e.target.value)} />
        {problem && <p role="alert" className="field__error">{problem}</p>}
        {cooldown > 0 && <p role="status" className="muted">{t('stanley.cooldown', { seconds: cooldown })}</p>}
        <Button type="submit" disabled={!ask || busy || cooldown > 0}>{t('stanley.send')}</Button>
        <ClearDraft show={text !== ''} onClear={() => setText('')} disabled={busy} />
        <p className="muted composer__note">{t('stanley.chat.history').split(/(?<=\.)\s+/).map((line) => <span key={line} className="composer__note-line">{line}</span>)}</p>
      </form>
    </div>
  )
}

/** The shell of the Stanley notices settings. The categories, quiet hours and budget are the existing notification settings; the relay that fills this chat with them comes in the next slice. */
export function StanleyNotices() {
  return (
    <details className="chat-options chat-more--tools chat-notices">
      <summary>{headingCase(t('stanley.chat.noticesTitle'))}</summary>
      <p className="muted">{t('stanley.chat.noticesBody')}</p>
      <p><Link to="/me/notifications">{t('stanley.chat.noticesLink')}</Link></p>
      <StanleySuggestions />
    </details>
  )
}

interface MessageRowProps {
  m: ChatMessage
  mine: string
  shipTime: (at: number) => string
  conversationId: string
  kind: ChatConversation['kind'] | undefined
  peerName: string
  ackBusy: boolean
  onAck: (messageId: string) => void
  /** A notice's action changed something (the muster was confirmed): reload the thread. */
  onChanged?: () => void
  onBlocked: () => void
  /** Reacting and replying need a conversation that is still open. */
  canAct?: boolean
  onReact?: (messageId: string, emoji: string) => void
  onReply?: (m: ChatMessage) => void
  /** Go to a quoted message that is not on screen yet (older pages are read until it is). */
  onJump?: (messageId: string) => void
  /** Phase 2: fix or retract your own message inside the 15-minute window. They reject with the server's reason, which the row shows. */
  onEdit?: (messageId: string, text: string) => Promise<void>
  onDelete?: (messageId: string) => Promise<void>
  /** Phase 3: Pin or Unpin is offered when the server allows it here (`canPin`) and, to pin, fewer than three are pinned. */
  canPin?: boolean
  pinned?: number
  onPin?: (messageId: string, on: boolean) => void
  /** Phase 4: a vote or plan answer for this message held for signal (the value), and the way to hold another. */
  held?: string
  onHold?: (job: Record<string, string>) => boolean
  /** Phase 4 of the Stanley plan: a polite reply from "Ask Stanley about this message" goes in the message box (nothing is sent). */
  onUse?: (text: string) => void
  /** For one of Stanley's answers in a shared conversation: the question it answers, so this device can suggest screens that fit this guest. */
  ask?: string | null
}

/**
 * The delete control on a card in the Stanley chat: a small trash icon that asks once (Delete or Keep it) and then removes the message from this guest's thread. The thread is theirs alone,
 * so nothing is deleted for anyone else. A failure is said on the card and nothing is removed.
 */
export function DeleteStanleyMessage({ onDelete }: { onDelete: () => Promise<void> }) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const run = async () => {
    setBusy(true)
    setFailed(false)
    try { await onDelete() } catch { setFailed(true); setBusy(false); return }
    setBusy(false)
  }
  if (!asking) return <p className="chat-msg__tools"><button type="button" className="chat-act chat-act--icon" aria-label={t('stanley.chat.delete')} title={t('stanley.chat.delete')} onClick={() => setAsking(true)}><Trash2 aria-hidden="true" /></button></p>
  return (
    <div className="chat-msg__tools" role="group" aria-label={t('stanley.chat.deleteAsk')}>
      <span className="muted">{t('stanley.chat.deleteAsk')}</span>
      <Button variant="secondary" disabled={busy} onClick={() => void run()}>{t('stanley.chat.deleteYes')}</Button>
      <Button variant="tertiary" disabled={busy} onClick={() => { setAsking(false); setFailed(false) }}>{t('stanley.chat.deleteNo')}</Button>
      {failed && <span role="alert" className="field__error">{t('stanley.chat.deleteFailed')}</span>}
    </div>
  )
}

/** A relayed notice. It reads the clock itself, so a copy held on the device stops showing Got it and the actions when its time passes, even offline. */
export function NoticeRow({ m, n, shipTime, conversationId, ackBusy, onAck, onChanged, onDelete }: { m: ChatMessage; n: NonNullable<ChatMessage['notice']>; shipTime: (at: number) => string; conversationId: string; ackBusy: boolean; onAck: (messageId: string) => void; onChanged?: () => void; onDelete?: (messageId: string) => Promise<void> }) {
  const now = useNow()
  // Its lane in words (never by colour alone), the text, why it may no longer apply, a link into the app and Got it where it asks for one.
  const state = noticeState(m, now)
  const link = state === 'active' ? safeNoticePath(n.path) : null
  const body = noticeBody(m.text)
  return (
    <li className={`chat-msg chat-msg--stanley chat-msg--lane-${n.lane}${state === 'active' ? '' : ' chat-msg--spent'}${m.acked === true ? ' chat-msg--seen' : ''}${n.kind === 'chatNote' ? ' chat-msg--note' : ''}`}>
      {m.acked !== true && <p className="chat-msg__level"><strong>{t(LANE_KEY[n.lane])}</strong></p>}
      <p className="chat-msg__meta"><GreetFace name="Stanley"><img className="chat-msg__stanley" src={stanleyPicture} alt="" width={28} height={28} /></GreetFace><strong>{t('stanley.chat.notification')}</strong> <span className="muted chat-msg__time">{shipTime(m.at)}</span></p>
      <p><strong>{noticeHeadline(m.text)}</strong></p>
      {body && <p>{body}</p>}
      {state === 'superseded' && <p className="muted">{t(n.lane === 'suggestion' ? 'stanley.moment.putAway' : 'stanley.notice.superseded')}</p>}
      {link && (n.actions ?? []).length === 0 && <div className="button-row"><LinkButton to={link} variant="secondary">{t('stanley.notice.open')}</LinkButton></div>}
      {state === 'active' && onChanged && n.lane === 'suggestion' && <MomentButtons m={m} conversationId={conversationId} onChanged={onChanged} />}
      {state === 'active' && onChanged && <ChatNoticeOffers m={m} conversationId={conversationId} onChanged={onChanged} />}
      {state === 'active' && m.acked !== undefined && (m.acked ? <p className="muted">{t('urgent.youAcked')}</p> : <div className="button-row"><Button disabled={ackBusy} onClick={() => onAck(m.id)}>{t('urgent.gotIt')}</Button></div>)}
      {onDelete && <DeleteStanleyMessage onDelete={() => onDelete(m.id)} />}
    </li>
  )
}

/** One message. Memoised: it re-renders only when its own message or the few things it shows change, not on every keystroke in the composer or every refresh of the thread. */
export const MessageRow = memo(function MessageRow({ m, mine, shipTime, conversationId, kind, peerName, ackBusy, onAck, onChanged, onBlocked, canAct = false, onReact, onReply, onJump, onEdit, onDelete, canPin, pinned, onPin, held, onHold, onUse, ask }: MessageRowProps) {
  if (m.system) {
    // A change of group status: someone joined (green), left or was removed (amber), or a plain note such as Stanley's welcome (blue).
    const change = /\bjoined\b/i.test(m.text) ? 'joined' : /\b(left|removed)\b/i.test(m.text) ? 'gone' : 'note'
    const Icon = change === 'joined' ? UserPlus : change === 'gone' ? UserMinus : Info
    return <li className={`chat-msg chat-msg--system chat-msg--system-${change}${m.mentionsYou ? ' chat-msg--mention' : ''}`}><p className="chat-msg__meta"><img className="chat-msg__stanley" src={stanleyPicture} alt="" width={28} height={28} /><strong>{t('stanley.chat.comment')}</strong><span className="chat-msg__time">{shipTime(m.at)}</span></p>
      <div className="chat-msg__system-text"><Icon aria-hidden="true" /><MessageWords text={m.text} mentionsYou={m.mentionsYou} /></div></li>
  }
  if (m.stanley) {
    // Stanley's own message: his name and the voice it was sent under, nothing to report, block or receipt.
    const n = m.notice
    if (!n) {
      return (
        <li className={m.mentionsYou ? 'chat-msg chat-msg--stanley chat-msg--mention' : 'chat-msg chat-msg--stanley'}>
          <p className="chat-msg__meta"><GreetFace name="Stanley"><img className="chat-msg__stanley" src={stanleyPicture} alt="" width={28} height={28} /></GreetFace><strong>{t('stanley.chat.comment')}</strong> <span className="muted chat-msg__time">{shipTime(m.at)}</span></p>
          <MessageWords text={m.text} mentionsYou={m.mentionsYou} />
          {ask && <GroupStanleyPills question={ask} />}
          {kind === 'stanley' && m.text.trim() !== '' && <ShareButton item={stanleyAnswerItem(m.text)} />}
          {onDelete && kind === 'stanley' && <DeleteStanleyMessage onDelete={() => onDelete(m.id)} />}
        </li>
      )
    }
    return <NoticeRow m={m} n={n} shipTime={shipTime} conversationId={conversationId} ackBusy={ackBusy} onAck={onAck} onChanged={onChanged} onDelete={kind === 'stanley' ? onDelete : undefined} />
  }
  if (m.deleted) {
    // Deleted for everyone: the fact and who and when, nothing of what it said.
    return <li id={`msg-${m.id}`} className="chat-msg chat-msg--deleted"><p className="muted"><strong>{m.from === mine ? t('chat.you') : (m.fromName ?? '')}</strong> · {t('conv.deleted')} · {shipTime(m.at)}</p></li>
  }
  return <PersonMessage m={m} mine={mine} shipTime={shipTime} conversationId={conversationId} kind={kind} peerName={peerName} ackBusy={ackBusy} onAck={onAck} onChanged={onChanged} onBlocked={onBlocked} canAct={canAct} onReact={onReact} onReply={onReply} onJump={onJump} onEdit={onEdit} onDelete={onDelete} canPin={canPin} pinned={pinned} onPin={onPin} held={held} onHold={onHold} onUse={onUse} />
})

/** A person's message: the quote of what it answers, the text or photo, the chips, and the React and Reply buttons (a long press with a finger opens the reactions too). */
export function PersonMessage({ m, mine, shipTime, conversationId, kind, peerName, ackBusy, onAck, onChanged, onBlocked, canAct, onReact, onReply, onJump, onEdit, onDelete, canPin = false, pinned = 0, onPin, held, onHold, onUse }: MessageRowProps) {
  const own = m.from === mine
  // A typed card or place is drawn from the server's own fields; an older plan card travels as text with a marker.
  const typed = isTyped(m) && m.card ? m.card : null
  const card = !typed && m.text ? parsePlanCard(m.text) : null
  const bundle = m.kind === 'bundle' ? parseBundle(m.bundle) : null
  const pinning = pinOffer(m, canPin, pinned)
  const mlevel = urgencyOf(m)
  const [picking, setPicking] = useState(false)
  const reactButton = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (picking) { const f = keepCardInView(reactButton.current); return () => { if (f !== undefined) cancelAnimationFrame(f) } } }, [picking])
  const press = useLongPress(() => { if (canAct && onReact) setPicking(true) })
  const closePicker = () => { setPicking(false); reactButton.current?.focus() }
  const you = t('conv.youLower')
  const youCap = t('chat.you')
  return (
    // A long press is a shortcut for touch; the React and Reply buttons below do the same for keyboard and screen reader.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <li id={`msg-${m.id}`} tabIndex={-1} {...press} className={['chat-msg', own && 'chat-msg--mine', m.mentionsYou && 'chat-msg--mention', m.pinned && 'chat-msg--pinned', mlevel !== 'normal' && `chat-msg--${mlevel}`].filter(Boolean).join(' ')}>
      {m.replyTo && <ReplyQuote q={m.replyTo} you={youCap} onJump={onJump} />}
      {mlevel !== 'normal' && <p className="chat-msg__level"><UrgencyTag level={mlevel} /></p>}
      <p className="chat-msg__meta">{own ? <MyChatAvatar small /> : <GreetFace name={m.fromName ?? ''}><ChatAvatar avatar={m.avatar} name={m.fromName ?? ''} small /></GreetFace>}<strong>{own ? t('chat.you') : (m.fromName ?? '')}</strong> <span className="muted chat-msg__time">{shipTime(m.at)}</span>{m.edited && <> <span className="muted">· {t('conv.edited')}</span></>}{m.pinned && <> <span className="muted">· {t('pin.pinned')}</span></>}{m.viaSms && <> <span className="muted">· {t('conv.viaSms')}</span></>}</p>
      {isPoll(m) ? <PollMessage conversationId={conversationId} message={m} canAct={canAct === true} onChanged={onChanged ?? noop} held={held} onHold={onHold} />
        : m.kind === 'board' && m.board ? <BoardMessage conversationId={conversationId} message={m} canAct={canAct === true} onChanged={onChanged ?? noop} />
        : isPlan(m) ? <PlanMessage conversationId={conversationId} message={m} canAct={canAct === true} held={held} onHold={onHold} />
        : bundle ? <BundleCard bundle={bundle} outcome={{ conversationId, message: m, canAct: canAct === true }} />
        : typed ? <CardMessage card={typed} /> : m.text && (card ? <PlanCardView card={card} /> : <MessageWords text={m.text} mentionsYou={m.mentionsYou} />)}
      {photoCountOf(m) > 0 && <MessagePhotos conversationId={conversationId} message={m} name={m.fromName ?? ''} you={t('chat.you')} />}
      {m.reactions && m.reactions.length > 0 && (
        <ul className="chat-reactions" aria-label={t('conv.reactions')}>
          {m.reactions.map((r) => <ReactionChip key={r.emoji} r={r} you={you} disabled={!canAct || !onReact} onPick={() => onReact?.(m.id, r.emoji)} />)}
        </ul>
      )}
      {canAct && canTarget(m) && (() => {
        const lead = (
          <>
            <button ref={reactButton} type="button" className="chat-act chat-act--icon" aria-expanded={picking} aria-label={t('conv.react')} title={t('conv.react')} onClick={() => setPicking((v) => !v)}><Smile aria-hidden="true" /></button>
            <button type="button" className="chat-act chat-act--icon" aria-label={t('conv.reply')} title={t('conv.reply')} onClick={() => onReply?.(m)}><ReplyIcon aria-hidden="true" /></button>
            {pinning && onPin && <button type="button" className="chat-act chat-act--icon" aria-label={t(pinning === 'pin' ? 'pin.pin' : 'pin.unpin')} title={t(pinning === 'pin' ? 'pin.pin' : 'pin.unpin')} onClick={() => onPin(m.id, pinning === 'pin')}>{pinning === 'pin' ? <PinIcon aria-hidden="true" /> : <PinOff aria-hidden="true" />}</button>}
            <StanleyMessageActions conversationId={conversationId} message={m} mine={mine} onPosted={onChanged ?? noop} onUse={onUse} onBlocked={onBlocked} />
            <CoordinatorButton message={m} />
            {!own && <MessageSafety messageId={m.id} from={m.from} name={m.fromName} onBlocked={onBlocked} />}
            {!own && (kind === 'room' || kind === 'group') && <FlagToStaff messageId={m.id} />}
          </>
        )
        return own && onEdit && onDelete
          ? <OwnChange m={m} onEdit={onEdit} onDelete={onDelete} lead={lead} />
          : <div className="chat-msg__tools">{lead}</div>
      })()}
      {picking && onReact && (
        <ReactionPicker held={myReaction(m.reactions)} onPick={(emoji) => { onReact(m.id, emoji); closePicker() }} onClose={closePicker} />
      )}
      {own && deliveryOf(m) !== 'sent' && <p className="muted">{t(({ read: 'conv.read', delivered: 'conv.delivered' } as const)[deliveryOf(m) as 'read' | 'delivered'])}</p>}
      {own && mlevel === 'urgent' && (
        <p className="muted">{ackedCount(m) === 0 ? t('urgent.notAcked') : kind === 'direct' ? t('urgent.ackedBy', { names: peerName }) : t('urgent.ackedCount', { count: ackedCount(m) })}</p>
      )}
      {!own && mlevel === 'urgent' && (m.acked
        ? <p className="muted">{t('urgent.youAcked')}</p>
        : <Button disabled={ackBusy} onClick={() => onAck(m.id)}>{t('urgent.gotIt')}</Button>)}
    </li>
  )
}

/** The quote above a reply. A tap goes to the original when it is on screen; one the reader may not read any more shows only "Message removed". */
export function ReplyQuote({ q, you, onJump }: { q: ChatQuote; you: string; onJump?: (messageId: string) => void }) {
  const who = q.mine ? you : q.fromName
  const body = <>{who && <strong>{who}</strong>} <span>{q.text}</span></>
  if (!q.id || q.removed) return <p className="chat-quote chat-quote--gone muted">{body}</p>
  const target = q.id
  const jump = () => {
    const el = document.getElementById(`msg-${target}`)
    if (!el) { onJump?.(target); return }   // on an older page: the thread reads back to it
    el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    el.focus({ preventScroll: true })
  }
  return <button type="button" className="chat-quote" aria-label={`${t('conv.quoteJump')}. ${quoteSummary(q, you)}`} onClick={jump}>{body}</button>
}

/** One chip under a message: the emoji and its count, pressed when it is yours. Tapping it adds or takes away your reaction. */
export function ReactionChip({ r, you, disabled, onPick }: { r: ChatReaction; you: string; disabled: boolean; onPick: () => void }) {
  return (
    <li>
      <button type="button" className="reaction-chip" aria-pressed={r.mine} aria-label={chipLabel(r, you)} disabled={disabled} onClick={onPick}>
        <span aria-hidden="true">{r.emoji} {r.count}</span>
      </button>
    </li>
  )
}

/** The six reactions. Focus moves in when it opens; Escape closes it and returns focus to the React button. */
export function ReactionPicker({ held, onPick, onClose }: { held: string | null; onPick: (emoji: string) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { (box.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ?? box.current?.querySelector<HTMLButtonElement>('button'))?.focus() }, [])
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape is a shortcut for a group whose buttons all work by themselves
    <div ref={box} className="chat-picker" role="group" aria-label={t('conv.reactPick')} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}>
      {REACTIONS.map((emoji) => (
        <button key={emoji} type="button" className="chat-picker__btn" aria-pressed={held === emoji} aria-label={t('conv.reactWith', { emoji })} onClick={() => onPick(emoji)}>
          <span aria-hidden="true">{emoji}</span>
        </button>
      ))}
    </div>
  )
}

/** The typing bubble: three dots that move (and sit still under reduced motion) and the words. The words are read once per burst through the thread's polite status, not here. */
export function TypingLine({ names }: { names: readonly string[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const active = names.length > 0
  // The card is forced fully into view when it appears, so it is never cut off at the edge of the thread or the screen.
  useEffect(() => { if (active) ref.current?.scrollIntoView({ block: 'nearest' }) }, [active])
  if (!active) return null
  return (
    <div className="chat-msg chat-typing-card" ref={ref}>
      <p className="chat-msg__meta">
        {names.length === 1 && <ChatAvatar avatar={undefined} name={names[0]} small />}
        <strong>{names.length === 1 ? names[0] : t('conv.typing.many')}</strong>
        <span className="chat-typing__dots" aria-hidden="true"><i /><i /><i /></span>
      </p>
      <span className="visually-hidden">{typingText(names)}</span>
    </div>
  )
}

/**
 * Edit and Delete under your own message, only while the 15-minute window is open. The window closes live: the buttons go away and, if you were in the middle of a change, a message says it is too late.
 * Delete asks first, because it is for everyone. Escape closes the editor and focus goes back to the button that opened it.
 */
export function OwnChange({ m, onEdit, onDelete, lead }: { lead: ReactNode; m: ChatMessage; onEdit: (messageId: string, text: string) => Promise<void>; onDelete: (messageId: string) => Promise<void> }) {
  const now = useNow()
  const open = windowLeft(m.at, now) > 0
  const [mode, setMode] = useState<'idle' | 'edit' | 'delete'>('idle')
  const [draft, setDraft] = useState(m.text)
  const [problem, setProblem] = useState<ChangeProblem | null>(null)
  const [busy, setBusy] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => { if (mode !== 'idle' || problem) { const f = keepCardInView(root.current); return () => { if (f !== undefined) cancelAnimationFrame(f) } } }, [mode, problem])
  const back = (selector: string) => setTimeout(() => root.current?.querySelector<HTMLElement>(selector)?.focus(), 0)
  const close = (selector: string) => { setMode('idle'); setProblem(null); back(selector) }
  const run = async (job: () => Promise<void>, after: string) => {
    setBusy(true)
    setProblem(null)
    try { await job(); setMode('idle'); back(after) } catch (e) { setProblem(isApiError(e) ? changeProblem(e.code, e.message) : 'other') } finally { setBusy(false) }
  }
  if (!open) return <>{<div className="chat-msg__tools">{lead}</div>}{mode !== 'idle' || problem === 'tooLate' ? <p role="status" className="muted">{t('conv.tooLate')}</p> : null}</>
  return (
    <div ref={root} className="chat-msg__actions-wrap">
      <div className="chat-msg__tools">
        {lead}
        {mode === 'idle' && canEdit(m) && <button type="button" className="chat-act chat-act--icon" data-act="edit" aria-label={t('conv.edit')} title={t('conv.edit')} onClick={() => { setDraft(m.text); setMode('edit'); back('textarea') }}><Pencil aria-hidden="true" /></button>}
        {mode === 'idle' && <button type="button" className="chat-act chat-act--icon" data-act="delete" aria-label={t('conv.delete')} title={t('conv.delete')} onClick={() => setMode('delete')}><Trash2 aria-hidden="true" /></button>}
      </div>
      {mode === 'edit' && (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape is a shortcut; Cancel does the same
        <form className="chat-edit" onSubmit={(e) => { e.preventDefault(); void run(() => onEdit(m.id, draft.trim()), '[data-act="edit"]') }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close('[data-act="edit"]') } }}>
          <TextArea label={t('conv.editLabel')} value={draft} rows={2} maxLength={MAX_TEXT} autoComplete="off" onChange={(e) => { setDraft(e.target.value); setProblem(null) }} />
          <div className="button-row">
            <Button type="submit" disabled={busy || !draft.trim()}>{t('conv.editSave')}</Button>
            <Button variant="secondary" onClick={() => close('[data-act="edit"]')}>{t('conv.editCancel')}</Button>
          </div>
        </form>
      )}
      {mode === 'delete' && (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape is a shortcut; Keep it does the same
        <div role="group" aria-label={t('conv.deleteAsk')} className="chat-edit" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close('[data-act="delete"]') } }}>
          <p>{t('conv.deleteAsk')}</p>
          <div className="button-row">
            <Button disabled={busy} onClick={() => void run(() => onDelete(m.id), '[data-act="delete"]')}>{t('conv.deleteYes')}</Button>
            <Button variant="secondary" onClick={() => close('[data-act="delete"]')}>{t('conv.deleteNo')}</Button>
          </div>
        </div>
      )}
      {problem && problem !== 'tooLate' && <p role="alert" className="field__error">{t(mode === 'delete' ? 'conv.deleteFailed' : PROBLEM_KEY[problem])}</p>}
      {problem === 'tooLate' && <p role="alert" className="field__error">{t('conv.tooLate')}</p>}
    </div>
  )
}
