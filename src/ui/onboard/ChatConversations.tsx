import type { ReactNode } from 'react'
import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import stanleyPicture from '../../assets/stanley-small.png'
import { useStanleyAsk, useStanleyBusy } from '../ai/useStanleyAsk'
import { GroupStanleyPills } from '../ai/GroupStanleyPills'
import { StanleyReply } from '../ai/StanleyReply'
import { getStanleyThread, subscribeStanley } from '../../ai/stanley'
import { copyAge, isStanleyChat, needsYou, noticeBody, noticeHeadline, noticeState, pushPrompt, mayAsk, questionFrom, safeNoticePath, startsDay, threadItems } from '../../domain/stanleyThread'
import type { ChatConversation, ChatKeep, ChatMessage, ChatPin, ChatRsvp, ChatQuote, ChatReaction, ChatStanleyTap, GroupStanley, ChatThread, ChatUrgency } from '../../api/chatTypes'
import { isApiError } from '../../api/errors'
import { chatStorage } from '../../data/chatStorage'
import { optimistic } from '../../data/optimistic'
import {
  canTarget, conversationFromSearch, messageFromSearch, deliveryOf, dividerBefore, incomingSince, isNearBottom, lastLine, MAX_TEXT, mergeMessages, newClientId, pendingFor, sendProblem, withLatest, withOlder,
  QUICK_REPLY_KEYS, quoteSummary, type PendingMessage, type SendProblem,
} from '../../domain/chatThread'
import { chipLabel, myReaction, nextReaction, REACTIONS, readReactionJob, reactionJob, setMyReaction, withReactions, type ReactionJob } from '../../domain/chatReactions'
import { readDraft, saveDraft } from '../../domain/chatDrafts'
import { insertMention, isTyped, mentionedIds, mentionQuery, pinOffer, type MentionPerson } from '../../domain/chatCards'
import { announceTyping, canEdit, changeProblem, isMuted, isSameConversation, MUTE_LENGTHS, muteFor, shouldSendTyping, splitArchived, TYPING_EXPIRE_MS, typingNames, windowLeft, type ChangeProblem, type MuteLength } from '../../domain/chatControl'
import { REPORT_REASONS, type ChatReportReason } from '../../domain/services'
import { useLongPress } from '../../hooks/useLongPress'
import { ashoreNames } from '../../domain/chatSms'
import { dndChoices, dndEndsAt } from '../../domain/chatDnd'
import { useChatDnd } from '../../hooks/useChatDnd'
import { keepDate, keptUntil } from '../../domain/chatKeep'
import { KeepSection } from './ChatKeep'
import { ackedCount, announceMode, levelsFor, sortConversations, urgencyOf } from '../../domain/chatUrgency'
import { clearChatCache, readCachedThread, readList, saveList, saveThread } from '../../domain/chatCache'
import { addPlanCard, encodePlanCard, hasPlanCard, newPlanCard, parsePlanCard, PLACE_MAX, planCardSentence, type PlanCard } from '../../domain/planCard'
import { MAX_PLAN_DAY } from '../../domain/nightsRules'
import { chatChanged, fetchChatSummary, isChatLive, useChatLive, useChatTyping } from '../../hooks/useChatSummary'
import { useAction } from '../../hooks/useAction'
import { useMemory } from '../../hooks/useMemory'
import { useMine } from '../../hooks/useMine'
import { sendWithin, useOutbox, worthRetrying } from '../../hooks/useOutbox'
import { useLatest } from '../../hooks/useLatest'
import { closeChatNotice, currentSupport } from '../../push/browser'
import { useVisibleInterval } from '../../hooks/useVisibleInterval'
import { useNow, useOwnerId, usePersona } from '../../hooks/useDemo'
import { api } from '../../runtime'
import { t, th as heading, type StringKey, headingCase } from '../../i18n'
import { Banner } from '../Banner'
import { Dialog } from '../Dialog'
import { Button, LinkButton } from '../Button'
import { Chip } from '../Chip'
import { ChatNoticeOffers } from './ChatNoticeOffers'
import { GroupStanleySwitch, MomentButtons, StanleySuggestions } from './ChatMoments'
import { OctagonAlert, TriangleAlert } from '../icons'
import { BellRing, Check, CircleCheck, EllipsisVertical, Clock, Pencil, Pin as PinIcon, PinOff, Reply as ReplyIcon, Smile, ThumbsUp, Trash2, UserMinus, UserPlus, X, Footprints, type LucideIcon } from 'lucide-react'

/** A small icon for each quick reply; the words are its label. */
const QUICK_ICONS: Record<(typeof QUICK_REPLY_KEYS)[number], LucideIcon> = { yes: Check, no: X, omw: Footprints, thanks: ThumbsUp, late: Clock, ok: CircleCheck }
import { Field, TextArea } from '../Field'
import { ActionError } from '../account/parts'
import { ClearDraft } from '../ClearDraft'
import { BlockedList, DraftPhotos, MessageSafety, PhotoAttach, type StagedPhoto } from '../aboard/ChatSafe'
import { useShipTime } from './shipTime'
import { DeleteChat, GroupDetails, NewGroup } from './ChatGroups'
import { CardMessage, MentionList, MessageWords, PinBar, ShareChooser } from './ChatCards'
import { PlanMessage, PlanTools, PollMessage } from './ChatPlanning'
import { GetPersonButton, RecapCard } from './ChatRelay'
import { HuddleDetails, StartHuddle } from './ChatHuddle'
import { CoordinatorButton, CoordinatorProvider, RemainingCard, RemindersSwitch } from './ChatCoordinator'
import { RoomDetails, RulesDialog } from './ChatRooms'
import { FlagToStaff, HostPanel } from './ChatHost'
import { ChatSearch, SaveChat } from './ChatSearch'
import { AskStanleyButton, AskStanleyNote, CatchUpButton, HelpMeReword, HelpMeWrite, PolishDraft, StanleyMessageActions, StanleyTapNote, StanleyTapProvider } from './ChatStanley'
import { askBefore, showCatchUp, unreadAfter, withAsk } from '../../domain/chatStanley'
import { MessagePhotos, PhotosGallery } from './ChatPhotos'
import { ChatAvatar, GreetFace, MyChatAvatar } from './ChatLooks'
import { subscribeGreeting, withGreeting } from '../../chat/greet'
import { EmojiPicker } from './ChatEmoji'
import { insertEmoji, wantsEmojiPicker } from '../../domain/chatEmoji'
import { chatFeedback } from '../../domain/chatFeedback'
import { playCue } from '../../sound/cues'
import { buzz, BUZZ } from '../../settings/haptics'
import { getSettings } from '../../settings/store'
import { photoCountOf } from '../../domain/chatPhotos'
import { isSearchable } from '../../domain/chatSearch'
import { isRoomChat, needsRules, roomPostState } from '../../domain/chatRooms'
import { canPost, isPlan, isPoll, readAnswerJob, type AnswerJob } from '../../domain/chatPlanning'

/**
 * Chats (docs/chat-plan.md, 4.8): the conversation list is the home of Chat, and one tap opens a conversation. The open conversation is in the address (`?c=`),
 * so back returns to the list and an alert opens the right one. Each conversation has its own history and its own unread count.
 */
export function Conversations() {
  const nav = useNavigate()
  return <ConversationList onOpen={(id) => { void nav(`/chat/c/${encodeURIComponent(id)}`) }} />
}

/** One conversation (a group, a person, a room, or Stanley) on a page of its own: `/chat/c/:id`, with `?m=` to scroll to a message. */
export function ConversationPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const open = conversationFromSearch(`c=${encodeURIComponent(id)}`)
  if (!open) return <Navigate to="/chat" replace />
  return <div className="page"><Thread key={open} id={open} jumpTo={messageFromSearch(params.toString())} onBack={() => { void nav('/chat') }} /></div>
}

/** Conversations this device has already said it received messages for (by id and last message time), so a refresh of the list does not ask again. */
const deliveredSeen = new Set<string>()

/** The list reaching the device is itself delivery: each conversation with something unread tells its senders once. Quiet on failure; the thread says it again when opened. */
function tellDelivered(list: readonly ChatConversation[]): void {
  for (const c of list) {
    if (c.unread <= 0 || isStanleyChat(c) || !c.last) continue
    const k = `${c.id}:${c.last.at}`
    if (deliveredSeen.has(k)) continue
    deliveredSeen.add(k)
    api.chatConversations.delivered(c.id).catch(() => deliveredSeen.delete(k))
  }
}

function ConversationList({ onOpen }: { onOpen: (id: string) => void }) {
  const shipTime = useShipTime()
  const now = useNow()
  const owner = useOwnerId() ?? 'none'
  // The copy from last time shows at once; the server's answer replaces it behind it.
  const [rows, setRows] = useState<ChatConversation[] | null>(() => readList(chatStorage(), owner))
  const [failed, setFailed] = useState(false)
  // Conversations with an urgent message nobody on this account has acknowledged stay at the top; the numbers come from the server so every device agrees.
  const [urgentIds, setUrgentIds] = useState<string[]>([])
  // Which chats every member agreed to keep past 30 days; a failed read only leaves the tags off.
  const [keeps, setKeeps] = useState<readonly ChatKeep[]>([])
  const load = useCallback(() => {
    fetchChatSummary().then((s) => setUrgentIds(s.urgentConversations), () => undefined)
    api.chatConnections.keeps().then(setKeeps, () => undefined)
    api.chatConversations.list().then(
      (list) => { setRows(list); setFailed(false); saveList(chatStorage(), owner, list); tellDelivered(list) },
      () => setFailed(true),
    )
  }, [owner])
  // oxlint-disable-next-line react/set-state-in-effect -- loading from the server is the external system this effect synchronizes with
  useEffect(() => { load() }, [load])
  useChatLive(load)
  // The live connection says when something changed; reading on a timer is only the fallback while it is down.
  useVisibleInterval(() => { if (!isChatLive()) load() }, 30_000)
  const [making, setMaking] = useState(false)
  // The chat whose people the guest is managing (invite, remove), and the one they are about to delete: only chats they started.
  const [managing, setManaging] = useState<ChatConversation | null>(null)
  const [deleting, setDeleting] = useState<ChatConversation | null>(null)
  return (
    <section aria-labelledby="conv-h">
      {managing && (managing.kind === 'huddle'
        ? <HuddleDetails id={managing.id} onClose={() => setManaging(null)} onLeft={() => { setManaging(null); load() }} />
        : <GroupDetails id={managing.id} onClose={() => { setManaging(null); load() }} onChanged={load} onLeft={() => { setManaging(null); load() }} />)}
      {deleting && <DeleteChat chat={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); load(); chatChanged() }} />}
      <h2 id="conv-h">{heading('conv.title')}</h2>
      {making && <NewGroup onClose={() => setMaking(false)} onCreated={(g) => { setMaking(false); onOpen(g.id) }} />}
      {failed && rows && <Banner kind="offline" title={t('conv.stale')} action={<Button variant="secondary" onClick={load}>{t('ref.retry')}</Button>} />}
      {failed && !rows && <Banner kind="offline" title={t('conv.offline')} action={<Button variant="secondary" onClick={load}>{t('ref.retry')}</Button>} />}
      {!rows && !failed && <p role="status" className="muted">{t('account.loading')}</p>}
      {rows && (rows.length === 0 ? <p>{t('conv.none')}</p> : (() => {
        const { shown, archived } = splitArchived(sortConversations(rows, urgentIds), urgentIds)
        return (
          <>
            <ul className="conv-list" aria-label={t('conv.title')}>
              {shown.map((c) => <ConversationItem key={c.id} c={c} urgentIds={urgentIds} onOpen={onOpen} onManage={setManaging} onDelete={setDeleting} shipTime={shipTime} now={now} keptDay={keptUntil(keeps, c.id)} />)}
            </ul>
            {archived.length > 0 && (
              <details className="conv-archived">
                <summary>{headingCase(t('conv.archivedTitle', { count: archived.length }))}</summary>
                <ul className="conv-list" aria-label={t('conv.archivedTitle', { count: archived.length })}>
                  {archived.map((c) => <ConversationItem key={c.id} c={c} urgentIds={urgentIds} onOpen={onOpen} onManage={setManaging} onDelete={setDeleting} shipTime={shipTime} now={now} keptDay={keptUntil(keeps, c.id)} />)}
                </ul>
              </details>
            )}
          </>
        )
      })())}
      {rows && <AwayPeople rows={rows} onChange={(id, on) => setRows((cur) => (cur ? cur.map((c) => (c.id === id ? { ...c, notifyAway: on } : c)) : cur))} />}
      <p><Button variant="secondary" onClick={() => setMaking(true)}>{t('cgroup.new')}</Button></p>
      <StartHuddle />
      <DoNotDisturb />
    </section>
  )
}

/**
 * "Tell them when I go ashore": the people I chat with one to one, each with a tick. A tick is the same switch as the one in that chat's Options (so the same rules apply on the server: only people
 * I am connected with, no one who has blocked me, nothing but "left the ship" and "back on board"). It is off for everyone until I tick them. Collapsed, so it stays out of the way.
 */
function AwayPeople({ rows, onChange }: { rows: readonly ChatConversation[]; onChange: (id: string, on: boolean) => void }) {
  const people = rows.filter((c) => c.kind === 'direct' && !c.closed)
  const [error, setError] = useState<string | null>(null)
  const toggle = useAction(async (c: ChatConversation) => {
    const on = c.notifyAway !== true
    setError(null)
    try {
      await optimistic(() => onChange(c.id, on), () => api.chatConversations.notifyAway(c.id, on), () => onChange(c.id, !on))
    } catch (e) {
      setError(isApiError(e) && e.code === 'forbidden' ? t('away.people.supervised') : t('away.people.failed'))
    }
  })
  if (people.length === 0) return null
  const ticked = people.filter((c) => c.notifyAway === true).length
  return (
    <details className="chat-more chat-more--tools chat-away">
      <summary>{headingCase(t('away.people.title'))}{ticked > 0 ? ` (${ticked})` : ''}</summary>
      <p className="muted">{t('away.people.hint')}</p>
      <ul className="plain-bullets chat-away__list" aria-label={t('away.people.title')}>
        {people.map((c) => (
          <li key={c.id}>
            <label className="choice">
              <input type="checkbox" checked={c.notifyAway === true} disabled={toggle.busy} onChange={() => void toggle.run(c)} />
              <ChatAvatar avatar={c.avatar} name={c.name} small />
              <span>{c.name}</span>
            </label>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="field__error">{error}</p>}
    </details>
  )
}

/** One row of the list: who, the last line, an urgency word, the mute and closed tags, and the unread count. */
/** The numbers on a card: when it was started and by whom, how many are in it, and when each side last wrote. */
function ChatStats({ c, shipTime }: { c: ChatConversation; shipTime: (at: number) => string }) {
  const lines = [
    c.startedAt ? (c.ownerName && !c.permanent ? t('conv.stat.startedBy', { time: shipTime(c.startedAt), name: c.ownerName }) : t('conv.stat.started', { time: shipTime(c.startedAt) })) : null,
    t('conv.stat.people', { count: c.members.length + 1 }),
    c.lastMineAt ? t('conv.stat.mine', { time: shipTime(c.lastMineAt) }) : t('conv.stat.mineNever'),
    c.lastTheirsAt ? t('conv.stat.theirs', { time: shipTime(c.lastTheirsAt) }) : t('conv.stat.theirsNever'),
  ].filter(Boolean)
  return <span className="conv__stats muted">{lines.join(' · ')}</span>
}

function ConversationItem({ c, urgentIds, onOpen, onManage, onDelete, shipTime, now, keptDay }: { c: ChatConversation; urgentIds: readonly string[]; onOpen: (id: string) => void; onManage: (c: ChatConversation) => void; onDelete: (c: ChatConversation) => void; shipTime: (at: number) => string; now: number; keptDay: number | null }) {
  const level: ChatUrgency = urgentIds.includes(c.id) ? 'urgent' : urgencyOf(c.last) === 'important' && c.unread > 0 && !c.last?.mine ? 'important' : 'normal'
  const muted = isMuted(c, now)
  const tags = [muted && (c.mutedUntil ? t('conv.mutedUntil', { time: shipTime(c.mutedUntil) }) : t('conv.muted')), c.closed && t('conv.closed'), keptDay !== null && t('keep.tag', { date: keepDate(keptDay) })].filter(Boolean)
  return (
    <li className="conv-item">
      <button type="button" className={[c.unread > 0 ? 'conv conv--unread' : 'conv', level !== 'normal' && `conv--${level}`, c.owner && 'conv--tools'].filter(Boolean).join(' ')} onClick={() => onOpen(c.id)}>
        {isStanleyChat(c)
          ? <img className="conv__avatar conv__avatar--stanley" src={stanleyPicture} alt="" width="44" height="44" />
          : c.ownerName ? <ChatAvatar avatar={c.ownerAvatar} name={c.ownerName} /> : <ChatAvatar avatar={c.avatar} name={c.name} />}
        <span className="conv__body">
          <span className="conv__top">
            <strong>{c.name}</strong>
            {c.last && <span className="muted conv__time">{shipTime(c.last.at)}</span>}
          </span>
          {level !== 'normal' && <UrgencyTag level={level} />}
          <span className="conv__last muted">{lastLine(c, t('conv.you'), t('conv.photo')) || '\u00a0'}</span>
          {tags.length > 0 && <span className="conv__tags muted">{tags.join(' · ')}</span>}
          {!c.permanent && c.kind !== 'stanley' && !c.room && <ChatStats c={c} shipTime={shipTime} />}
        </span>
        {c.unread > 0 && (
          <span className="conv__unread">
            <span aria-hidden="true">{c.unread}</span>
            <span className="visually-hidden">{t('conv.unread', { count: c.unread })}</span>
          </span>
        )}
      </button>
      {c.owner && (
        <span className="conv__tools" role="group" aria-label={t('conv.tools.label', { name: c.name })}>
          <button type="button" className="conv__tool" onClick={() => onManage(c)} aria-label={t('conv.tool.invite', { name: c.name })} title={t('conv.tool.invite', { name: c.name })}><UserPlus aria-hidden="true" /></button>
          <button type="button" className="conv__tool" onClick={() => onManage(c)} aria-label={t('conv.tool.members', { name: c.name })} title={t('conv.tool.members', { name: c.name })}><UserMinus aria-hidden="true" /></button>
          <button type="button" className="conv__tool conv__tool--danger" onClick={() => onDelete(c)} aria-label={t('conv.tool.delete', { name: c.name })} title={t('conv.tool.delete', { name: c.name })}><Trash2 aria-hidden="true" /></button>
        </span>
      )}
    </li>
  )
}

/** The level as an icon and a word, never colour alone. */
/** One-tap do not disturb: an hour or until morning, shown clearly while on, and it ends by itself. Urgent messages still come through, and the screen says so. */
function DoNotDisturb() {
  const { active, until, busy, failed, set } = useChatDnd()
  return (
    <div className={`dnd${active ? ' dnd--on' : ''}`} role="group" aria-labelledby="dnd-h">
      <p id="dnd-h" className="dnd__title">{t(active ? 'dnd.stateOn' : 'dnd.stateOff', { time: dndEndsAt(until) })}</p>
      <p className="muted">{t('dnd.hint')}</p>
      <div className="dnd__choices">
        {dndChoices(active).map((m) => <Button key={m} variant="secondary" disabled={busy} onClick={() => set(m)}>{t(`dnd.${m}`)}</Button>)}
      </div>
      {failed && <p role="alert" className="field__error">{t('dnd.failed')}</p>}
    </div>
  )
}

function UrgencyTag({ level }: { level: Exclude<ChatUrgency, 'normal'> }) {
  const Icon = level === 'urgent' ? OctagonAlert : TriangleAlert
  return <span className={`urgency-tag urgency-tag--${level}`}><Icon aria-hidden="true" /> <span>{t(level === 'urgent' ? 'urgent.label' : 'important.label')}</span></span>
}

/** After a card grows (a delete or edit panel, the reaction picker, an error), bring the whole card into view in the history; nothing moves if it already fits. */
const keepCardInView = (from: Element | null | undefined): number | undefined => {
  const card = from?.closest('.chat-msg')
  if (!card) return undefined
  return window.requestAnimationFrame(() => card.scrollIntoView({ block: 'nearest', behavior: 'auto' }))
}
const prefersReducedMotion = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Whether the message history (its own scrolling box) is at its end. */
const nearBottom = (box: HTMLElement | null): boolean => (box ? isNearBottom(box.scrollTop, box.clientHeight, box.scrollHeight) : true)

type Phase = 'loading' | 'ready' | 'error' | 'gone'

/** One conversation: the latest 30 messages, older ones on request, a composer that never blocks typing, and live arrival that does not move what the guest is reading. */
/** Shown for the moment a thread the guest had open is deleted or they are removed from it: it clears the copy kept on this device, tells the list, and sends them to the Chat page with a notice. */
function GoneFromChat({ id, owner, onBack }: { id: string; owner: string; onBack: () => void }) {
  const nav = useNavigate()
  useEffect(() => {
    clearChatCache(chatStorage(), owner, [id])
    chatChanged()
    void nav('/chat?gone=1', { replace: true })
  }, [id, owner, nav])
  return (
    <section>
      <Button variant="tertiary" onClick={onBack}>{t('conv.back')}</Button>
      <Banner kind="info" title={t('conv.gone')} />
    </section>
  )
}

function Thread({ id, onBack, jumpTo }: { id: string; onBack: () => void; jumpTo?: string | null }) {
  // A private chat just started opens straight on its invite (`?invite=1`), since inviting people is the next thing to do.
  const [threadParams] = useSearchParams()
  const me = usePersona()
  const supervisedChild = me?.child === true
  const now = useNow()
  const ownerId = useOwnerId()
  const shipTime = useShipTime()
  const owner = ownerId ?? 'none'
  // The copy from last time (text only) shows at once; the server's answer replaces it behind it.
  const [cached] = useState(() => readCachedThread(chatStorage(), owner, id))
  // When the server last answered for this thread (epoch ms): the age an offline copy shows. A fresh answer replaces it.
  const [fetchedAt, setFetchedAt] = useState<number | undefined>(cached?.savedAt)
  const [phase, setPhase] = useState<Phase>(cached ? 'ready' : 'loading')
  const [offline, setOffline] = useState(false)
  const [conversation, setConversation] = useState<ChatConversation | null>(cached?.conversation ?? null)
  const [messages, setMessages] = useState<ChatMessage[]>(cached?.messages ?? [])
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? false)
  const [chip, setChip] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [alertText, setAlertText] = useState('')
  const [mayUrgent, setMayUrgent] = useState(cached?.mayUrgent ?? false)
  const [level, setLevel] = useState<ChatUrgency>('normal')
  const [blockedVersion, setBlockedVersion] = useState(0)
  const [details, setDetails] = useState(threadParams.get('invite') === '1')
  const [askRules, setAskRules] = useState(false)
  // The first message you had not read when this thread opened: the divider stays where it was even after reading clears it.
  const [firstUnread, setFirstUnread] = useState<string | null>(null)
  const [jumped, setJumped] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [draftPhotos, setDraftPhotos] = useState<StagedPhoto[]>([])
  // Whether Stanley's help (catch me up, make a plan, plain words) is on here; asked once per conversation, and only where it can ever be on.
  const [tap, setTap] = useState<ChatStanleyTap | undefined>(undefined)
  const tapKind = conversation?.kind
  useEffect(() => {
    if (tapKind !== 'party' && tapKind !== 'direct' && tapKind !== 'group') return
    let live = true
    api.chatConversations.stanleyTap(id).then((x) => { if (live) setTap(x) }, () => undefined)
    return () => { live = false }
  }, [id, tapKind])
  // Phase 11: whether the caller is an admin of this made group and Stanley may help in it (the tally and reminder buttons). Asked once per group.
  const [groupStanley, setGroupStanley] = useState<{ data: GroupStanley | null }>({ data: null })
  useEffect(() => {
    if (tapKind !== 'group') return
    let live = true
    api.chatConversations.groupStanley(id).then((x) => { if (live) setGroupStanley({ data: x }) }, () => undefined)
    return () => { live = false }
  }, [id, tapKind])
  const [pins, setPins] = useState<ChatPin[]>(cached?.pins ?? [])
  const [ashore, setAshore] = useState(() => ashoreNames(cached?.ashore))
  // Who is back on the ship, from people who chose to tell this chat. Never kept on the device: presence is only worth showing when it is fresh.
  const [back, setBack] = useState('')
  // Who is typing now (never stored; each name drops off six seconds after the last nudge) and whether this guest shows and sees it.
  const [typers, setTypers] = useState<string[]>([])
  const typingSettings = useMine(() => api.chatConnections.settings())
  const typingOn = typingSettings.data?.typing !== false
  const typingSentAt = useRef<number | null>(null)
  const dnd = useChatDnd().active
  // The latest values for the arrival effect, which must not re-run when they change.
  const feelRef = useRef({ muted: false, dnd: false })
  useEffect(() => { feelRef.current = { muted: conversation !== null && isMuted(conversation, Date.now()), dnd } })
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [emojiOk] = useState(() => typeof window !== 'undefined' && wantsEmojiPicker(!!window.matchMedia?.('(pointer: fine)').matches, !!window.matchMedia?.('(hover: hover)').matches))
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typersRef = useRef<string[]>([])
  const end = useRef<HTMLDivElement>(null)
  const lastSeen = useRef<string | null>(null)
  const lastRead = useRef<string | null>(null)
  const first = useRef(true)
  const mine = me?.id ?? ''

  const latestAnswer = useRef<ChatThread | null>(null)
  const load = useCallback(async () => {
    try {
      const th = await api.chatConversations.thread(id)
      setConversation(th.conversation)
      setAshore(ashoreNames(th.ashore))
      setBack(ashoreNames(th.back))
      setMayUrgent(th.mayUrgent === true)
      setPins(th.pins ?? [])
      latestAnswer.current = th
      setFetchedAt(Date.now())
      // The first live answer replaces the copy; later ones refresh the latest page and keep older pages already loaded.
      setMessages((cur) => (first.current ? th.messages : withLatest(cur, th.messages)))
      if (first.current) { setHasMore(th.hasMore); setFirstUnread(th.firstUnread ?? null); first.current = false }
      setOffline(false)
      setPhase('ready')
    } catch (e) {
      if (isApiError(e) && e.code === 'notFound') setPhase('gone')
      else { setOffline(true); setPhase((p) => (p === 'ready' ? p : 'error')) }
    }
  }, [id])
  // The on-device copy is written after the messages settle (a burst of nudges is one write), not inside the state update.
  useEffect(() => {
    const th = latestAnswer.current
    if (phase !== 'ready' || !th) return
    const h = setTimeout(() => saveThread(chatStorage(), owner, id, { ...th, messages }, fetchedAt), 400)
    return () => clearTimeout(h)
  }, [phase, messages, owner, id, fetchedAt])
  // oxlint-disable-next-line react/set-state-in-effect -- loading from the server is the external system this effect synchronizes with
  useEffect(() => { void load() }, [load])
  useChatLive(() => void load())
  useVisibleInterval(() => { if (!isChatLive()) void load() }, 30_000)
  // A typing nudge asks who is typing; the answer lasts six seconds unless another nudge renews it. A polite announcement is made once per burst, not on every nudge.
  const showTypers = useCallback((names: string[]) => {
    if (announceTyping(typersRef.current, names)) setAnnounce(typingText(names))
    typersRef.current = names
    setTypers(names)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = names.length > 0 ? setTimeout(() => { typersRef.current = []; setTypers([]) }, TYPING_EXPIRE_MS) : null
  }, [])
  useChatTyping((hex) => {
    if (!isSameConversation(id, hex) || !typingOn || conversation?.kind === 'stanley') return
    api.chatConversations.typingNow(id).then(showTypers, () => undefined)
  })
  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current) }, [])

  const logBox = useRef<HTMLDivElement>(null)
  const toEnd = useCallback(() => { const b = logBox.current; if (b) b.scrollTo({ top: b.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); setChip(false) }, [])

  // New arrivals follow the guest only when they are already at the bottom; otherwise a chip says so and nothing moves. Focus is never touched.
  const wasNear = useRef(true)
  const userScrolled = useRef(false)
  useEffect(() => {
    const box = logBox.current
    if (!box) return
    const onScroll = () => { userScrolled.current = true; wasNear.current = nearBottom(box); if (wasNear.current) setChip(false) }
    box.addEventListener('scroll', onScroll, { passive: true })
    return () => box.removeEventListener('scroll', onScroll)
  }, [phase])
  useEffect(() => {
    if (phase !== 'ready') return
    const incoming = incomingSince(lastSeen.current, messages, mine)
    const wasFirst = lastSeen.current === null
    lastSeen.current = messages[messages.length - 1]?.id ?? null
    // oxlint-disable-next-line react/set-state-in-effect -- the first page arrived from the server: show its end
    if (wasFirst) { if (messages.length > 0) toEnd(); return }
    if (incoming) {
      // oxlint-disable-next-line react/set-state-in-effect -- their message ends their "is typing"
      if (typersRef.current.length > 0) { typersRef.current = []; setTypers([]) }
      // oxlint-disable-next-line react/set-state-in-effect -- a message that just arrived from the server is announced once and may raise the chip
      if (announceMode(urgencyOf(incoming)) === 'assertive') setAlertText(t('urgent.incoming', { name: incoming.fromName ?? '' }))
      else setAnnounce(t('conv.incoming', { name: incoming.fromName ?? '' }))
      if (wasNear.current) toEnd(); else setChip(true)
      // A soft sound and buzz when the guest asked for them (off by default; never in a muted chat, calm mode or do not disturb).
      const s = getSettings()
      const feel = chatFeedback(s, { ...feelRef.current, urgency: urgencyOf(incoming) })
      if (feel.sound) playCue('confirm', { ...s, sounds: true })
      if (feel.buzz) buzz(s, BUZZ.tick)
    }
  }, [phase, messages, mine, toEnd])

  // Reading clears the unread count on every device. Only while the page is in front, and only when something new has arrived.
  useEffect(() => {
    const last = messages[messages.length - 1]?.id ?? null
    if (phase !== 'ready' || !last || last === lastRead.current || document.visibilityState !== 'visible') return
    lastRead.current = last
    void api.chatConversations.read(id).then(chatChanged, () => { lastRead.current = null })
    void closeChatNotice(id)
  }, [phase, messages, id])

  // Older messages load when the guest scrolls to the top (and by the button, for keyboard and screen reader use). The page keeps its place as they are added above.
  const anchor = useRef<{ height: number; y: number } | null>(null)
  const loadingOlder = useRef(false)
  const older = useAction(async () => {
    const before = messages[0]?.id
    if (!before || loadingOlder.current) return
    loadingOlder.current = true
    try {
      const th = await api.chatConversations.thread(id, before)
      anchor.current = { height: logBox.current?.scrollHeight ?? 0, y: logBox.current?.scrollTop ?? 0 }
      setMessages((cur) => withOlder(cur, th.messages))
      setHasMore(th.hasMore)
    } finally { loadingOlder.current = false }
  })
  const runOlder = useLatest(() => void older.run())
  const top = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = top.current
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting && userScrolled.current) runOlder() }, { root: logBox.current })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, runOlder])
  useLayoutEffect(() => {
    const a = anchor.current
    if (!a) return
    anchor.current = null
    const b = logBox.current
    if (b) b.scrollTop = a.y + (b.scrollHeight - a.height)
  }, [messages])

  // This device has what others sent: say so once per newest message from someone else, so their screens can show Delivered. Quiet on failure.
  const deliveredTo = useRef<string | null>(null)
  useEffect(() => {
    if (phase !== 'ready' || offline || conversation?.kind === 'stanley') return
    const latest = [...messages].reverse().find((x) => x.from !== mine && canTarget(x))?.id ?? null
    if (!latest || latest === deliveredTo.current) return
    deliveredTo.current = latest
    api.chatConversations.delivered(id).catch(() => { deliveredTo.current = null })
  }, [phase, offline, messages, mine, id, conversation?.kind])

  // A quote whose original is on an older page: read older pages (up to ten) until it is on screen, then go to it. Gives up quietly when it is not there.
  const pendingJump = useRef<string | null>(null)
  const jump = useAction(async (target: string) => {
    if (loadingOlder.current) return
    loadingOlder.current = true
    pendingJump.current = target
    try {
      let before = messages[0]?.id
      for (let page = 0; page < 10 && before; page++) {
        const th = await api.chatConversations.thread(id, before)
        setMessages((cur) => withOlder(cur, th.messages))
        setHasMore(th.hasMore)
        if (th.messages.some((x) => x.id === target) || !th.hasMore) break
        before = th.messages[0]?.id
      }
    } finally {
      loadingOlder.current = false
      // The page that holds it has rendered by now or never will: whichever, stop waiting.
      setTimeout(() => { pendingJump.current = null }, 0)
    }
  })
  const runJump = useLatest((target: string) => void jump.run(target))
  useEffect(() => {
    const target = pendingJump.current
    const el = target ? document.getElementById(`msg-${target}`) : null
    if (!el) return
    pendingJump.current = null
    el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    el.focus({ preventScroll: true })
  }, [messages])

  const form = useRef<HTMLFormElement>(null)
  const runReply = useLatest((m: ChatMessage) => { setReplyTo(m); form.current?.querySelector('textarea')?.focus() })
  const jumpToUnread = () => {
    const el = document.getElementById('chat-unread')
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    el.focus({ preventScroll: true })
    setJumped(true)
  }

  const ack = useAction(async (messageId: string) => {
    await api.chatConversations.ack(id, messageId)
    chatChanged()
    await load()
  })

  // Stable, so a keystroke in the composer does not re-render the messages above it.
  const runAck = useLatest((messageId: string) => void ack.run(messageId))
  const runChanged = useLatest(() => void load())
  const onBlocked = useLatest(() => { void load(); setBlockedVersion((v) => v + 1) })

  const mute = useAction(async (on: boolean, length?: MuteLength) => {
    const before = conversation
    await optimistic(() => setConversation((c) => (c ? { ...c, muted: on, mutedUntil: undefined } : c)), () => api.chatConversations.mute(id, on, length ? muteFor(length) : undefined), () => setConversation((c) => (c && before ? { ...c, muted: before.muted, mutedUntil: before.mutedUntil } : c)))
    void load()   // a timed mute's end comes from the server
  })
  const archive = useAction(async (on: boolean) => {
    await api.chatConversations.archive(id, on)
    chatChanged()
    if (on) onBack()
    else void load()
  })
  // Edit and delete: the row shows its own problem, so these throw; on success the message is changed on screen at once and the thread is read again.
  const edit = async (messageId: string, body: string) => {
    const sent = await api.chatConversations.edit(id, messageId, body)
    setMessages((cur) => cur.map((x) => (x.id === messageId ? { ...x, text: sent.text, edited: sent.edited } : x)))
    setAnnounce(t('conv.editedAnnounce'))
    void load()
  }
  const remove = async (messageId: string) => {
    await api.chatConversations.remove(id, messageId)
    setMessages((cur) => cur.map((x) => (x.id === messageId ? { ...x, text: '', deleted: true, photo: undefined, hasPhoto: undefined, photoCount: undefined, reactions: undefined, replyTo: undefined } : x)))
    setAnnounce(t('conv.deletedAnnounce'))
    void load()
  }
  const runEdit = useLatest((messageId: string, body: string) => edit(messageId, body))
  const runRemove = useLatest((messageId: string) => remove(messageId))

  // Phase 3: pins (up to three). The bar comes back from the server; the message is marked at once.
  const pin = useAction(async (messageId: string, on: boolean) => {
    const bar = await api.chatConversations.pin(id, messageId, on)
    setPins(bar)
    setMessages((cur) => cur.map((x) => (x.id === messageId ? { ...x, pinned: on } : x)))
    setAnnounce(t(on ? 'pin.announce.on' : 'pin.announce.off'))
    void load()
  })
  const runPin = useLatest((messageId: string, on: boolean) => void pin.run(messageId, on))
  const goToPin = useLatest((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`)
    if (!el) { runJump(messageId); return }   // on an older page: the thread reads back to it
    el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    el.focus({ preventScroll: true })
  })
  // A search result opens its chat and goes to the message once the thread is ready (older pages are read when it is not on the first).
  const jumpedTo = useRef<string | null>(null)
  useEffect(() => {
    if (!jumpTo || phase !== 'ready' || jumpedTo.current === jumpTo) return
    jumpedTo.current = jumpTo
    goToPin(jumpTo)
  }, [jumpTo, phase, goToPin])
  const mentionsOnly = useAction(async (on: boolean) => {
    await optimistic(() => setConversation((c) => (c ? { ...c, mentionsOnly: on || undefined } : c)), () => api.chatConversations.mentionsOnly(id, on), () => setConversation((c) => (c ? { ...c, mentionsOnly: on ? undefined : true } : c)))
  })

  const notifyAway = useAction(async (on: boolean) => {
    await optimistic(() => setConversation((c) => (c ? { ...c, notifyAway: on } : c)), () => api.chatConversations.notifyAway(id, on), () => setConversation((c) => (c ? { ...c, notifyAway: !on } : c)))
  })

  // ---- Sending ----
  // A half-typed message is kept on this device for this conversation, so leaving does not lose it.
  const [text, setText] = useState(() => readDraft(chatStorage(), owner, id))
  useEffect(() => { saveDraft(chatStorage(), owner, id, text) }, [text, owner, id])
  const [problem, setProblem] = useState<SendProblem | null>(null)
  // Phase 3: the `@word` being typed offers the people in this conversation; Escape puts the offer away until the next `@`.
  const [caret, setCaret] = useState(0)
  const [mentionOff, setMentionOff] = useState(false)
  const people: MentionPerson[] = conversation?.people ?? []
  const typedMention = mentionOff || people.length === 0 ? null : mentionQuery(text, caret)
  const [full, setFull] = useState(false)
  const [sending, setSending] = useState<PendingMessage[]>([])
  // A new card at the end (sent, still sending, or arrived) always brings the end of the history into view, so it is fully visible; loading older messages does not change the last one, so it never jumps.
  const lastMessageId = messages[messages.length - 1]?.id
  // In Stanley's chat the questions and answers are held on the device, not in `messages`; a new one (or the waiting dots) should also bring the end into view.
  const deviceTurns = useSyncExternalStore(subscribeStanley, getStanleyThread).length
  const stanleyWaiting = useStanleyBusy()
  useEffect(() => {
    if (phase !== 'ready') return
    const box = logBox.current
    if (!box) return
    const down = () => { box.scrollTop = box.scrollHeight }
    down()
    const frame = requestAnimationFrame(down)
    // A card can grow after it first appears (its text and buttons settle, or its real height replaces the placeholder size), so keep following the end for a moment.
    const list = box.querySelector('ol')
    const watcher = typeof ResizeObserver === 'undefined' || !list ? null : new ResizeObserver(down)
    watcher?.observe(list as Element)
    const stop = window.setTimeout(() => watcher?.disconnect(), 1500)
    return () => { cancelAnimationFrame(frame); window.clearTimeout(stop); watcher?.disconnect() }
  }, [phase, lastMessageId, sending.length, deviceTurns, stanleyWaiting])
  const outbox = useOutbox(ownerId ?? 'none', 'chat', (p) => {
    const answer = readAnswerJob(p)
    if (answer) return answer.kind === 'vote' ? api.chatConversations.vote(answer.conversation, answer.messageId, Number(answer.value)) : api.chatConversations.rsvp(answer.conversation, answer.messageId, answer.value as ChatRsvp)
    const job = readReactionJob(p)
    if (job) return api.chatConversations.setReaction(job.conversation, job.messageId, job.emoji)
    return p.conversation ? api.chatConversations.send(p.conversation, p.text, p.clientId, (p.urgency as ChatUrgency | undefined) || undefined, p.replyTo || undefined, p.mentions ? p.mentions.split(',') : undefined) : Promise.resolve()
  }, () => void load())
  // Reactions held for signal are laid over the thread, so the chip stays as the guest left it until the server has it.
  const heldReactions = outbox.items.map((x) => readReactionJob(x.payload)).filter((j): j is ReactionJob => j !== null && j.conversation === id)
  // Votes and plan answers held for signal, by message: laid over the counts until the server has them.
  const heldAnswers = new Map(outbox.items.map((x) => readAnswerJob(x.payload)).filter((j): j is AnswerJob => j !== null && j.conversation === id).map((j) => [j.messageId, j.value]))
  const holdAnswer = useLatest((job: Record<string, string>) => outbox.hold(job))
  // A reaction shows at once. With signal the server's answer replaces it; without, the tap is held and sent when the phone is back (it says exactly what is wanted, so replaying it is safe).
  const react = useAction(async (messageId: string, picked: string) => {
    const current = messages.find((x) => x.id === messageId)
    const wanted = nextReaction(current ? heldReactions.reduce((r, j) => (j.messageId === messageId ? setMyReaction(r, j.emoji) : r), current.reactions) : undefined, picked)
    setMessages((cur) => cur.map((x) => (x.id === messageId ? withReactions(x, setMyReaction(x.reactions, wanted)) : x)))
    try {
      const chips = await sendWithin(api.chatConversations.setReaction(id, messageId, wanted))
      setMessages((cur) => cur.map((x) => (x.id === messageId ? withReactions(x, chips) : x)))
      setAnnounce(wanted ? t('conv.youReacted', { emoji: wanted }) : t('conv.reactionRemoved'))
    } catch (e) {
      if (worthRetrying(e) && outbox.hold(reactionJob(id, messageId, wanted))) { setAnnounce(t('conv.reactionQueued')); return }
      void load()
      throw e
    }
  })
  const runReact = useLatest((messageId: string, emoji: string) => void react.run(messageId, emoji))
  // A quick reply sends its own words and leaves the box (and any draft in it) alone.
  // Puts a draft or suggestion in the message box and the caret at its end. Nothing is sent: the guest changes it and presses Send.
  const putInBox = (draft: string) => {
    const next = draft.slice(0, MAX_TEXT)
    setText(next)
    setCaret(next.length)
    const box = form.current?.querySelector('textarea')
    requestAnimationFrame(() => { box?.focus(); box?.setSelectionRange(next.length, next.length) })
  }
  const runUse = useLatest((draft: string) => putInBox(draft))
  // Tapping someone else's picture: "Hey Name, " goes in an empty box, which scrolls into view and takes the focus.
  const runGreet = useLatest((name: string) => {
    const box = form.current?.querySelector('textarea')
    if (!box) return
    const next = withGreeting(text, name).slice(0, MAX_TEXT)
    if (next !== text) { setText(next); setCaret(next.length) }
    box.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    requestAnimationFrame(() => { box.focus({ preventScroll: true }); box.setSelectionRange(next.length, next.length) })
  })
  useEffect(() => subscribeGreeting(runGreet), [runGreet])
  // Photos attached to the draft go out together with its words when the guest presses Send.
  const sendDraftPhotos = useAction(async () => {
    const [first, ...more] = draftPhotos
    if (!first) return
    await api.chatConversations.sendPhoto(id, { ...first, caption: text.trim(), ...(more.length > 0 ? { more } : {}) })
    setDraftPhotos([])
    setText('')
    setReplyTo(null)
    setLevel('normal')
    wasNear.current = true
    void load()
  })
  const cancelDraft = () => { setText(''); setDraftPhotos([]); setReplyTo(null); setLevel('normal'); setProblem(null) }
  const submit = async (quick?: string) => {
    if (quick === undefined && draftPhotos.length > 0) { void sendDraftPhotos.run(); return }
    const body = (quick ?? text).trim()
    if (!body) return
    setProblem(null)
    // A room asks for its rules on the first post; the words stay in the box meanwhile.
    if (conversation && needsRules(conversation)) { setAskRules(true); return }
    setFull(false)
    const clientId = newClientId()
    const sendLevel = mayUrgent || level !== 'urgent' ? level : 'normal'
    const answering = replyTo?.id ?? ''
    const named = quick === undefined ? mentionedIds(body, people) : []
    setReplyTo(null)
    if (quick === undefined) { setLevel('normal'); setText('') }   // each message chooses again: a habit of urgent would stop meaning anything; typing is never blocked
    setSending((s) => [...s, { id: clientId, text: body, state: 'sending' }])
    try {
      const sent = await sendWithin(api.chatConversations.send(id, body, clientId, sendLevel, answering || undefined, named.length > 0 ? named : undefined))
      setMessages((cur) => mergeMessages(cur, [sent]))
      wasNear.current = true
    } catch (e) {
      if (worthRetrying(e)) {
        if (!outbox.hold({ conversation: id, text: body, clientId, urgency: sendLevel, replyTo: answering, mentions: named.join(',') })) { if (quick === undefined) { setText((cur) => cur || body); setLevel(sendLevel) } setFull(true) }
      } else {
        // The text stays in the box so the guest does not lose it (a quick reply was never in the box). A reply to a message that is gone is sent as a plain message next time.
        const why = isApiError(e) ? sendProblem(e.code, e.message) : 'other'
        // A held post is with the team now, so the box is not given the words back; everything else keeps them.
        if (quick === undefined && why !== 'held') { setText((cur) => cur || body); setLevel(why === 'urgency' ? 'normal' : sendLevel) }
        setProblem(why)
        if (isApiError(e) && e.code === 'notFound') setPhase('gone')
      }
    } finally {
      setSending((s) => s.filter((x) => x.id !== clientId))
    }
  }

  if (phase === 'gone') {
    // Deleted, or the guest was removed: the thread is closed at once (back to the list, which no longer has it) and the copy kept on this device goes.
    return <GoneFromChat id={id} owner={owner} onBack={onBack} />
  }
  const dividerId = dividerBefore(messages, firstUnread)
  const shownMessages = heldReactions.length === 0 ? messages : messages.map((m) => heldReactions.reduce((acc, j) => (j.messageId === m.id ? withReactions(acc, setMyReaction(acc.reactions, j.emoji)) : acc), m))
  const queued = pendingFor(id, outbox.items).filter((q) => !messages.some((m) => m.id === q.id))
  const bubbles: PendingMessage[] = [...sending, ...queued.filter((q) => !sending.some((s) => s.id === q.id))]
  const name = conversation?.name ?? ''
  const permanent = conversation !== null && isStanleyChat(conversation)
  const room = conversation !== null && isRoomChat(conversation) ? conversation : null
  // Offline, the copy says how old it is, so a guest reads "As of 3:10" rather than taking old notices for current ones.
  const age = copyAge(fetchedAt, shipTime)
  const staleTitle = permanent && age ? `${t('conv.stale')} ${t('stanley.notice.asOf', { time: age })}` : t('conv.stale')
  return (
    <StanleyTapProvider value={tap}>
    <CoordinatorProvider value={(conversation?.kind === 'group' || conversation?.kind === 'huddle') && groupStanley.data ? { groupId: id, state: groupStanley.data } : null}>
    <section aria-labelledby="thread-h">
      <h2 id="thread-h"><span className="person-line">{conversation?.kind === 'direct' && <ChatAvatar avatar={conversation.avatar} name={name} />}{name}</span></h2>
      {permanent && <p className="muted" role="note">{t('stanley.chat.permanent')}</p>}
      {conversation && conversation.kind !== 'direct' && !permanent && !room && (
        <p className="muted">{conversation.members.length > 0 ? t('conv.members', { names: conversation.members.join(', ') }) : t('conv.alone')}</p>
      )}
      {conversation?.kind === 'huddle' && (
        <div className="stack">
          {conversation.members.length === 0 && <p className="muted">{t('chuddle.alone')}</p>}
          <p><Button onClick={() => setDetails(true)}>{t('chuddle.invitePeople')}</Button></p>
        </div>
      )}
      {back && !offline && <p className="muted">{t('conv.backOnShip', { names: back })}</p>}
      {ashore && <p className="muted">{t('conv.ashore', { names: ashore })}</p>}
      {conversation?.guardianCanRead && <p className="muted" role="note">{t('conv.guardian')}</p>}
      {room?.room && <RoomNotes room={room} />}
      {details && room && <RoomDetails conversation={room} onClose={() => setDetails(false)} onLeft={() => { setDetails(false); onBack() }} />}
      {askRules && room && <RulesDialog conversation={room} onClose={() => setAskRules(false)} onAccepted={() => { setAskRules(false); setConversation((c) => (c?.room ? { ...c, room: { ...c.room, rulesAccepted: true } } : c)); setAnnounce(t('room.rulesAccepted')); void load() }} />}
      {details && conversation?.kind === 'huddle' && <HuddleDetails id={id} onClose={() => setDetails(false)} onLeft={() => { setDetails(false); onBack() }} />}
      {details && !room && conversation?.kind !== 'huddle' && <GroupDetails id={id} onClose={() => setDetails(false)} onChanged={() => void load()} onLeft={() => { setDetails(false); onBack() }} />}
      <p role="status" className="visually-hidden">{announce}</p>
      <p role="alert" className="visually-hidden">{alertText}</p>
      {phase === 'loading' && <p role="status" className="muted">{t('account.loading')}</p>}
      {offline && phase === 'ready' && <Banner kind="offline" title={staleTitle} action={<Button variant="secondary" onClick={() => void load()}>{t('ref.retry')}</Button>} />}
      {phase === 'error' && <Banner kind="offline" title={t('conv.offline')} action={<Button variant="secondary" onClick={() => void load()}>{t('ref.retry')}</Button>} />}
      {permanent && <p className="muted" role="note">{t('stanley.chat.neverAsk')}</p>}
      {permanent && supervisedChild && <p className="muted" role="note">{t('stanley.chat.noticeOnly')}</p>}
      {permanent && <PushPromptNote prompt={pushPrompt(currentSupport(), supervisedChild, messages.some((m) => m.notice !== undefined && m.acked === false && noticeState(m, now) === 'active'))} />}
      {permanent && <NeedsYouStrip messages={messages} ackBusy={ack.busy} onAck={runAck} />}
      {hasMore && <Button variant="secondary" className="chat-jump" disabled={older.busy} onClick={() => void older.run()}>{t('conv.earlier')}</Button>}
      <ActionError error={older.error} />
      {dividerId && !jumped && <Button variant="secondary" className="chat-jump" onClick={jumpToUnread}>{t('conv.jumpUnread')}</Button>}
      {phase === 'ready' && messages.length === 0 && bubbles.length === 0 && <p>{t('chat.none')}</p>}
      {!permanent && <PinBar pins={pins} canPin={conversation?.canPin === true} busy={pin.busy} onGo={goToPin} onUnpin={(messageId) => void pin.run(messageId, false)} />}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling region must take focus so the keyboard can scroll it */}
      <div ref={logBox} className="chat-scroll" tabIndex={0} role="region" aria-label={t('conv.messages', { name })}>
      <div ref={top} />
      <ol className="chat-log" aria-label={t('conv.messages', { name })}>
        {permanent
          ? <StanleyItems messages={messages} mine={mine} shipTime={shipTime} conversationId={id} ackBusy={ack.busy} onAck={runAck} onChanged={runChanged} onBlocked={onBlocked} />
          : shownMessages.map((m, at) => (
            <Fragment key={m.id}>
              {m.id === dividerId && <li id="chat-unread" className="chat-divider" tabIndex={-1} aria-label={t('conv.newMessagesDivider')}><span>{t('conv.newMessagesDivider')}</span></li>}
              <MessageRow m={m} mine={mine} shipTime={shipTime} conversationId={id} kind={conversation?.kind} peerName={conversation?.name ?? ''} ackBusy={ack.busy} onAck={runAck} onBlocked={onBlocked}
                canAct={!conversation?.closed} onReact={runReact} onReply={runReply} onJump={runJump} onEdit={runEdit} onDelete={runRemove} canPin={conversation?.canPin === true} pinned={pins.length} onPin={runPin} held={heldAnswers.get(m.id)} onHold={holdAnswer} onUse={runUse} ask={askBefore(shownMessages, at)} />
            </Fragment>
          ))}
        {bubbles.map((b) => (
          <li key={b.id} className="chat-msg chat-msg--mine chat-msg--pending">
            <p>{b.text}</p>
            <p className="muted">{t(b.state === 'sending' ? 'conv.sending' : 'conv.waiting')}</p>
          </li>
        ))}
      </ol>
      <TypingLine names={typers} />
      <div ref={end} />
      </div>
      {chip && <div className="chat-chip"><Button variant="secondary" onClick={toEnd}>{t('conv.newMessages')}</Button></div>}
      {permanent && phase === 'ready' && mayAsk(supervisedChild) && <AskStanley />}
      {!permanent && (conversation?.closed ? <Banner kind="info" title={t('conv.closed')}><p>{t('conv.closedBody')}</p></Banner> : phase === 'ready' && room && roomPostState(room) !== 'open' ? <p className="muted" role="note">{t(roomClosedKey(roomPostState(room)))}</p> : phase === 'ready' && !room && !canPost(conversation) ? <p className="muted" role="note">{t('announce.only')}</p> : phase === 'ready' && (
        <>
        <form ref={form} className="composer composer--chat" onSubmit={(e) => { e.preventDefault(); void submit() }}>
          {replyTo?.id && (
            <div className="chat-replying" role="group" aria-label={t('conv.replyingTo', { who: replyTo.from === mine ? t('chat.you') : (replyTo.fromName ?? '') })}>
              <p className="chat-replying__text"><strong>{t('conv.replyingTo', { who: replyTo.from === mine ? t('chat.you') : (replyTo.fromName ?? '') })}</strong><span className="muted"> {replyTo.text || t('conv.photo')}</span></p>
              <Button variant="tertiary" onClick={() => setReplyTo(null)}>{t('conv.replyCancel')}</Button>
            </div>
          )}
          {!room && <details className="chat-more chat-more--inline">
          <summary>{headingCase(t('urgent.pick'))}</summary>
          <fieldset className="urgency-pick">
            <legend className="visually-hidden">{t('urgent.pick')}</legend>
            {levelsFor(mayUrgent).map((l) => (
              <label key={l} className="urgency-pick__option">
                <input type="radio" name="urgency" value={l} checked={level === l} onChange={() => setLevel(l)} /> {t(`urgent.level.${l}`)}
              </label>
            ))}
            <p className="muted">{t(`urgent.explain.${level}`)}</p>
          </fieldset>
          </details>}
          <TextArea clear={false} label={t('chat.message')} value={text} rows={3} maxLength={MAX_TEXT} autoComplete="off"
            onChange={(e) => {
              setText(e.target.value)
              setCaret(e.target.selectionStart ?? e.target.value.length)
              setMentionOff(false)
              if (problem) setProblem(null)
              // Tell the others, at most every three seconds, only while there is something written and the guest has the indicator on.
              const tick = Date.now()
              if (typingOn && !room && e.target.value.trim() && shouldSendTyping(typingSentAt.current, tick)) { typingSentAt.current = tick; api.chatConversations.typing(id).catch(() => { typingSentAt.current = null }) }
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit() } else if (e.key === 'Escape' && typedMention) { e.preventDefault(); setMentionOff(true) } }}
            onKeyUp={(e) => setCaret(e.currentTarget.selectionStart ?? 0)} onClick={(e) => setCaret(e.currentTarget.selectionStart ?? 0)} />
          <details className="chat-more chat-more--inline">
            <summary>{headingCase(t('conv.writeMore'))}</summary>
          {emojiOk && (
            <>
              <Button type="button" variant="tertiary" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((o) => !o)}>{t('emoji.button')}</Button>
              {emojiOpen && <EmojiPicker onClose={() => { setEmojiOpen(false); form.current?.querySelector('textarea')?.focus() }} onPick={(emoji) => {
                const box = form.current?.querySelector('textarea')
                const next = insertEmoji(text, box?.selectionStart ?? text.length, box?.selectionEnd ?? text.length, emoji, MAX_TEXT)
                setText(next.text)
                setCaret(next.caret)
                setEmojiOpen(false)
                box?.focus()
                requestAnimationFrame(() => box?.setSelectionRange(next.caret, next.caret))
              }} />}
            </>
          )}
          <AskStanleyButton onAsk={() => {
            const next = withAsk(text).slice(0, MAX_TEXT)
            setText(next)
            setCaret(next.length)
            const box = form.current?.querySelector('textarea')
            requestAnimationFrame(() => { box?.focus(); box?.setSelectionRange(next.length, next.length) })
          }} />
          <AskStanleyNote text={text} />
          {tap?.available && <HelpMeWrite onUse={putInBox} />}
          <PolishDraft text={text} onUse={putInBox} />
          </details>
          {typedMention && (
            <MentionList people={people} query={typedMention.query} onPick={(person) => {
              const next = insertMention(text, caret, typedMention.start, person)
              setText(next.text)
              setCaret(next.caret)
              const box = form.current?.querySelector('textarea')
              box?.focus()
              requestAnimationFrame(() => box?.setSelectionRange(next.caret, next.caret))
            }} />
          )}
          {problem && <p role="alert" className="field__error">{t(problem === 'blocked' ? 'conv.blocked' : problem === 'contact' ? 'conv.contact' : problem === 'gone' ? 'conv.gone' : problem === 'urgency' ? 'urgent.denied' : problem === 'urgencyLimit' ? 'urgent.limit' : problem === 'rate' ? 'conv.rate' : (['staffOnly', 'muted', 'slow', 'held', 'rules', 'emergency'] as const).some((r) => r === problem) ? `room.problem.${problem}` as StringKey : 'conv.failed')}</p>}
          {problem && problem !== 'blocked' && problem !== 'urgency' && problem !== 'urgencyLimit' && problem !== 'held' && <p className="muted">{t('chat.kept')}</p>}
          <HelpMeReword problem={problem} text={text} onUse={putInBox} />
          {full && <p role="alert" className="field__error">{t('outbox.full')}</p>}
          {!room && conversation?.kind !== 'huddle' ? <PhotoAttach photos={draftPhotos} onChange={setDraftPhotos}><Button type="submit" disabled={(!text.trim() && draftPhotos.length === 0) || sendDraftPhotos.busy}>{t('chat.send')}</Button></PhotoAttach> : <div className="composer__actions"><Button type="submit" disabled={(!text.trim() && draftPhotos.length === 0) || sendDraftPhotos.busy}>{t('chat.send')}</Button></div>}
          <ClearDraft show={text.trim() !== '' || draftPhotos.length > 0} onClear={cancelDraft} />
          <DraftPhotos photos={draftPhotos} onChange={setDraftPhotos} />
          <ActionError error={sendDraftPhotos.error} />
          {!room && <div role="group" aria-label={t('conv.quick')} className="chat-quick">
            {QUICK_REPLY_KEYS.map((k) => { const Icon = QUICK_ICONS[k]; return <button key={k} type="button" className="chat-quick__btn" aria-label={t(`conv.quick.${k}`)} title={t(`conv.quick.${k}`)} onClick={() => void submit(t(`conv.quick.${k}`))}><Icon aria-hidden="true" /></button> })}
          </div>}
        </form>
        {!room && <ShareChooser conversation={conversation!} onSent={(sent) => { setMessages((cur) => mergeMessages(cur, [sent])); wasNear.current = true; void load() }} />}
        {!room && conversation!.kind !== 'direct' && <PlanTools conversation={conversation!} onSent={(sent) => { setMessages((cur) => mergeMessages(cur, [sent])); wasNear.current = true; void load() }} />}
        </>
      ))}
      {conversation && permanent && <StanleyNotices />}
      <ActionError error={mute.error} />
      <ActionError error={archive.error} />
      <ActionError error={notifyAway.error} />
      {pin.error && <p role="alert" className="field__error">{t(pin.error.message === 'pinsFull' ? 'pin.full' : pin.error.code === 'forbidden' ? 'pin.denied' : 'pin.failed')}</p>}
      <ActionError error={mentionsOnly.error} />
      <ActionError error={ack.error} />
      <ActionError error={jump.error} />
      {react.error && <p role="alert" className="field__error">{t('conv.reactFailed')}</p>}
      {!permanent && <details className="chat-more chat-more--tools">
        <summary>{headingCase(t('conv.tools'))}</summary>
      {conversation?.kind === 'group' && <Button variant="secondary" onClick={() => setDetails(true)}>{t('cgroup.details')}</Button>}
      {conversation?.kind === 'huddle' && <Button variant="secondary" onClick={() => setDetails(true)}>{t('chuddle.details')}</Button>}
      {room && <Button variant="secondary" onClick={() => setDetails(true)}>{t(room.kind === 'channel' ? 'room.channelDetails' : 'room.details')}</Button>}
      {conversation && !permanent && phase === 'ready' && (
        <ChatMenu conversation={conversation} messages={messages} now={now} busy={mute.busy || archive.busy} onMute={(on, length) => void mute.run(on, length)} onArchive={(on) => void archive.run(on)} onBlocked={onBlocked} onFind={goToPin} />
      )}
      {conversation && !permanent && !room && phase === 'ready' && <StanleyTapNote conversationId={id} tap={tap} onChanged={setTap} />}
      {conversation && !permanent && !room && phase === 'ready' && !offline && showCatchUp(tap, unreadAfter(messages, firstUnread, mine)) && <CatchUpButton conversationId={id} />}
      {conversation && !permanent && !room && <Options conversation={conversation} messages={messages} awayBusy={notifyAway.busy} onAway={(on) => void notifyAway.run(on)} mentionsBusy={mentionsOnly.busy} onMentionsOnly={(on) => void mentionsOnly.run(on)} onSent={() => void load()} blockedVersion={blockedVersion} reload={() => void load()} />}
      </details>}
    </section>
    </CoordinatorProvider>
    </StanleyTapProvider>
  )
}

/**
 * The permanent Stanley chat's log: the notices and lines the server holds, and the questions and answers held on this device, in time order. A second device shows the notices only.
 * The device's history is the Ask dialog's, so a question asked there appears here and the other way round.
 */
function StanleyItems({ messages, mine, shipTime, conversationId, ackBusy, onAck, onChanged, onBlocked }: {
  messages: ChatMessage[]; mine: string; shipTime: (at: number) => string; conversationId: string; ackBusy: boolean; onAck: (messageId: string) => void; onChanged: () => void; onBlocked: () => void
}) {
  const device = useSyncExternalStore(subscribeStanley, getStanleyThread)
  const waiting = useStanleyBusy()
  // The server's "I'm now speaking for ..." lines are left out: the cards no longer name the ship, so a change of voice needs no marker.
  const items = threadItems(messages.filter((m) => !m.system), device)
  const dots = waiting ? <li key="waiting" className="chat-msg chat-msg--answer"><p className="chat-msg__meta"><img className="chat-msg__stanley" src={stanleyPicture} alt="" width={28} height={28} /><strong>{t('stanley.chat.reply')}</strong></p><p role="status" className="muted stanley__typing"><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><span className="visually-hidden">{t('stanley.typing')}</span></p></li> : null
  const rows = items.map((item, i) => {
    const heading = startsDay(items, i) ? <li key={`h:${item.key}`} className="chat-day"><h3>{new Date(item.at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</h3></li> : null
    const row = ((): ReactNode => {
    if (item.kind === 'server') return <MessageRow key={item.key} m={item.message} mine={mine} shipTime={shipTime} conversationId={conversationId} kind="stanley" peerName="" ackBusy={ackBusy} onAck={onAck} onChanged={onChanged} onBlocked={onBlocked} />
    const asked = item.kind === 'question'
    return (
      <li key={item.key} className={asked ? 'chat-msg chat-msg--mine' : 'chat-msg chat-msg--answer'}>
        <p className="chat-msg__meta">{asked ? <MyChatAvatar small /> : <GreetFace name="Stanley"><img className="chat-msg__stanley" src={stanleyPicture} alt="" width={28} height={28} /></GreetFace>}<strong>{asked ? t('stanley.chat.asked') : t('stanley.chat.reply')}</strong> <span className="muted">{shipTime(item.at)}</span></p>
        {asked ? <p>{item.text}</p> : <StanleyReply m={item.turn} />}
      </li>
    )
    })()
    return <Fragment key={item.key}>{heading}{row}</Fragment>
  })
  return <>{rows}{dots}</>
}

const LANE_KEY = { critical: 'stanley.notice.lane.critical', important: 'stanley.notice.lane.important', reminder: 'stanley.notice.lane.reminder', info: 'stanley.notice.lane.info', suggestion: 'stanley.notice.lane.suggestion' } as const

/** The strip at the top of Stanley's thread: critical and important notices still waiting for Got it, so a guest who scrolled past forty messages still sees what is outstanding. */
function NeedsYouStrip({ messages, ackBusy, onAck }: { messages: ChatMessage[]; ackBusy: boolean; onAck: (messageId: string) => void }) {
  const now = useNow()
  const waiting = needsYou(messages, now)
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
function PushPromptNote({ prompt }: { prompt: ReturnType<typeof pushPrompt> }) {
  if (prompt === null) return null
  return prompt === 'ask'
    ? <Banner kind="info" title={t('stanley.chat.pushAskTitle')} action={<LinkButton to="/me/notifications">{t('stanley.chat.pushAskLink')}</LinkButton>}><p>{t('stanley.chat.pushAskBody')}</p></Banner>
    : <Banner kind="info" title={t('stanley.chat.pushDeclinedTitle')}><p>{t('stanley.chat.pushDeclinedBody')}</p></Banner>
}

/** The free-text box. The question is asked and answered right here, on the chat page: it and the answer land in the thread above (the same in-memory thread his dialog uses), with waiting dots until it does. */
function AskStanley() {
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
function StanleyNotices() {
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

/** A relayed notice. It reads the clock itself, so a copy held on the device stops showing Got it and the actions when its time passes, even offline. */
function NoticeRow({ m, n, shipTime, conversationId, ackBusy, onAck, onChanged }: { m: ChatMessage; n: NonNullable<ChatMessage['notice']>; shipTime: (at: number) => string; conversationId: string; ackBusy: boolean; onAck: (messageId: string) => void; onChanged?: () => void }) {
  const now = useNow()
  // Its lane in words (never by colour alone), the text, why it may no longer apply, a link into the app and Got it where it asks for one.
  const state = noticeState(m, now)
  const link = state === 'active' ? safeNoticePath(n.path) : null
  const body = noticeBody(m.text)
  return (
    <li className={`chat-msg chat-msg--stanley chat-msg--lane-${n.lane}${state === 'active' ? '' : ' chat-msg--spent'}${m.acked === true ? ' chat-msg--seen' : ''}`}>
      {m.acked !== true && <p className="chat-msg__level"><strong>{t(LANE_KEY[n.lane])}</strong></p>}
      <p className="chat-msg__meta"><GreetFace name="Stanley"><img className="chat-msg__stanley" src={stanleyPicture} alt="" width={28} height={28} /></GreetFace><strong>{t('stanley.chat.notification')}</strong> <span className="muted">{shipTime(m.at)}</span></p>
      <p><strong>{noticeHeadline(m.text)}</strong></p>
      {body && <p>{body}</p>}
      {state !== 'active' && <p className="muted">{t(state === 'superseded' ? (n.lane === 'suggestion' ? 'stanley.moment.putAway' : 'stanley.notice.superseded') : 'stanley.notice.expired')}</p>}
      {link && (n.actions ?? []).length === 0 && <LinkButton to={link} variant="secondary">{t('stanley.notice.open')}</LinkButton>}
      {state === 'active' && onChanged && n.lane === 'suggestion' && <MomentButtons m={m} conversationId={conversationId} onChanged={onChanged} />}
      {state === 'active' && onChanged && <ChatNoticeOffers m={m} conversationId={conversationId} onChanged={onChanged} />}
      {state === 'active' && m.acked !== undefined && (m.acked ? <p className="muted">{t('urgent.youAcked')}</p> : <Button disabled={ackBusy} onClick={() => onAck(m.id)}>{t('urgent.gotIt')}</Button>)}
    </li>
  )
}

/** One message. Memoised: it re-renders only when its own message or the few things it shows change, not on every keystroke in the composer or every refresh of the thread. */
const MessageRow = memo(function MessageRow({ m, mine, shipTime, conversationId, kind, peerName, ackBusy, onAck, onChanged, onBlocked, canAct = false, onReact, onReply, onJump, onEdit, onDelete, canPin, pinned, onPin, held, onHold, onUse, ask }: MessageRowProps) {
  if (m.system) return <li className="chat-msg chat-msg--system"><p className="muted">{m.text} · {shipTime(m.at)}</p></li>
  if (m.stanley) {
    // Stanley's own message: his name and the voice it was sent under, nothing to report, block or receipt.
    const n = m.notice
    if (!n) {
      return (
        <li className="chat-msg chat-msg--stanley">
          <p className="chat-msg__meta"><GreetFace name="Stanley"><img className="chat-msg__stanley" src={stanleyPicture} alt="" width={28} height={28} /></GreetFace><strong>{t('stanley.chat.notification')}</strong> <span className="muted">{shipTime(m.at)}</span></p>
          <p>{m.text}</p>
          {ask && <GroupStanleyPills question={ask} />}
        </li>
      )
    }
    return <NoticeRow m={m} n={n} shipTime={shipTime} conversationId={conversationId} ackBusy={ackBusy} onAck={onAck} onChanged={onChanged} />
  }
  if (m.deleted) {
    // Deleted for everyone: the fact and who and when, nothing of what it said.
    return <li id={`msg-${m.id}`} className="chat-msg chat-msg--deleted"><p className="muted"><strong>{m.from === mine ? t('chat.you') : (m.fromName ?? '')}</strong> · {t('conv.deleted')} · {shipTime(m.at)}</p></li>
  }
  return <PersonMessage m={m} mine={mine} shipTime={shipTime} conversationId={conversationId} kind={kind} peerName={peerName} ackBusy={ackBusy} onAck={onAck} onChanged={onChanged} onBlocked={onBlocked} canAct={canAct} onReact={onReact} onReply={onReply} onJump={onJump} onEdit={onEdit} onDelete={onDelete} canPin={canPin} pinned={pinned} onPin={onPin} held={held} onHold={onHold} onUse={onUse} />
})

const noop = (): void => {}

/** A person's message: the quote of what it answers, the text or photo, the chips, and the React and Reply buttons (a long press with a finger opens the reactions too). */
function PersonMessage({ m, mine, shipTime, conversationId, kind, peerName, ackBusy, onAck, onChanged, onBlocked, canAct, onReact, onReply, onJump, onEdit, onDelete, canPin = false, pinned = 0, onPin, held, onHold, onUse }: MessageRowProps) {
  const own = m.from === mine
  // A typed card or place is drawn from the server's own fields; an older plan card travels as text with a marker.
  const typed = isTyped(m) && m.card ? m.card : null
  const card = !typed && m.text ? parsePlanCard(m.text) : null
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
      <p className="chat-msg__meta">{own ? <MyChatAvatar small /> : <GreetFace name={m.fromName ?? ''}><ChatAvatar avatar={m.avatar} name={m.fromName ?? ''} small /></GreetFace>}<strong>{own ? t('chat.you') : (m.fromName ?? '')}</strong> <span className="muted">{shipTime(m.at)}</span>{m.edited && <> <span className="muted">· {t('conv.edited')}</span></>}{m.pinned && <> <span className="muted">· {t('pin.pinned')}</span></>}{m.viaSms && <> <span className="muted">· {t('conv.viaSms')}</span></>}</p>
      {isPoll(m) ? <PollMessage conversationId={conversationId} message={m} canAct={canAct === true} onChanged={onChanged ?? noop} held={held} onHold={onHold} />
        : isPlan(m) ? <PlanMessage conversationId={conversationId} message={m} canAct={canAct === true} held={held} onHold={onHold} />
        : typed ? <CardMessage card={typed} /> : m.text && (card ? <PlanCardView card={card} /> : <MessageWords text={m.text} mentionsYou={m.mentionsYou} />)}
      {photoCountOf(m) > 0 && <MessagePhotos conversationId={conversationId} message={m} name={m.fromName ?? ''} you={t('chat.you')} />}
      {!own && <MessageSafety messageId={m.id} from={m.from} name={m.fromName} onBlocked={onBlocked} />}
      {!own && (kind === 'room' || kind === 'group') && <FlagToStaff messageId={m.id} />}
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
function ReplyQuote({ q, you, onJump }: { q: ChatQuote; you: string; onJump?: (messageId: string) => void }) {
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
function ReactionChip({ r, you, disabled, onPick }: { r: ChatReaction; you: string; disabled: boolean; onPick: () => void }) {
  return (
    <li>
      <button type="button" className="reaction-chip" aria-pressed={r.mine} aria-label={chipLabel(r, you)} disabled={disabled} onClick={onPick}>
        <span aria-hidden="true">{r.emoji} {r.count}</span>
      </button>
    </li>
  )
}

/** The six reactions. Focus moves in when it opens; Escape closes it and returns focus to the React button. */
function ReactionPicker({ held, onPick, onClose }: { held: string | null; onPick: (emoji: string) => void; onClose: () => void }) {
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

/** The words for who is typing: one name, two names, or several people. Empty when nobody is. */
function typingText(names: readonly string[]): string {
  const w = typingNames(names)
  return w.kind === 'one' ? t('conv.typing.one', { a: w.a }) : w.kind === 'two' ? t('conv.typing.two', { a: w.a, b: w.b }) : w.kind === 'many' ? t('conv.typing.many') : ''
}

/** The typing bubble: three dots that move (and sit still under reduced motion) and the words. The words are read once per burst through the thread's polite status, not here. */
function TypingLine({ names }: { names: readonly string[] }) {
  if (names.length === 0) return null
  return (
    <div className="chat-typing">
      <span className="chat-typing__dots" aria-hidden="true"><i /><i /><i /></span>
      <span>{typingText(names)}</span>
    </div>
  )
}

const PROBLEM_KEY: Record<ChangeProblem, StringKey> = {
  tooLate: 'conv.tooLate', blocked: 'conv.editBlocked', contact: 'conv.editContact', text: 'conv.editFailed', deleted: 'conv.deleted', other: 'conv.editFailed',
}

/**
 * Edit and Delete under your own message, only while the 15-minute window is open. The window closes live: the buttons go away and, if you were in the middle of a change, a message says it is too late.
 * Delete asks first, because it is for everyone. Escape closes the editor and focus goes back to the button that opened it.
 */
function OwnChange({ m, onEdit, onDelete, lead }: { lead: ReactNode; m: ChatMessage; onEdit: (messageId: string, text: string) => Promise<void>; onDelete: (messageId: string) => Promise<void> }) {
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

const MUTE_KEY: Record<MuteLength, StringKey> = { hour: 'conv.muteHour', day: 'conv.muteDay', week: 'conv.muteWeek', forever: 'conv.muteForever' }

/**
 * The chat's header menu: mute (for an hour, a day, a week or until turned back on), archive, and for the people in it Block and Report. A report goes with their latest message so the moderators can see
 * what was said; a block only hides them from you. Escape closes it and focus returns to the button.
 */
function ChatMenu({ conversation, messages, now, busy, onMute, onArchive, onBlocked, onFind }: {
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
function Options({ conversation, messages, awayBusy, onAway, mentionsBusy, onMentionsOnly, onSent, blockedVersion, reload }: {
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
      {(conversation.kind === 'group' || conversation.kind === 'huddle') && <GroupStanleySwitch groupId={conversation.id} />}
      {(conversation.kind === 'group' || conversation.kind === 'huddle') && <RemainingCard />}
      {(conversation.kind === 'group' || conversation.kind === 'huddle') && <RemindersSwitch groupId={conversation.id} />}
      {conversation.kind === 'group' && <RecapCard groupId={conversation.id} />}
      {conversation.kind === 'group' && <HostPanel conversation={conversation} />}
      {conversation.kind !== 'huddle' && (conversation.kind !== 'direct' || !conversation.closed) ? <GetPersonButton conversationId={conversation.id} messages={messages} /> : null}
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
function PlanCardSender({ conversationId, onSent }: { conversationId: string; onSent: () => void }) {
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
function RoomNotes({ room }: { room: ChatConversation }) {
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

function roomClosedKey(state: ReturnType<typeof roomPostState>): StringKey {
  return state === 'staffOnly' ? 'room.staffOnly' : state === 'muted' ? 'room.muted' : state === 'off' ? 'room.offNow' : 'room.closedNow'
}
