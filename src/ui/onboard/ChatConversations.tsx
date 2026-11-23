import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { useStanleyBusy } from '../ai/useStanleyAsk'
import { getStanleyThread, subscribeStanley } from '../../ai/stanley'
import { copyAge, isStanleyChat, noticeState, pushPrompt, mayAsk } from '../../domain/stanleyThread'
import type { ChatConversation, ChatMessage, ChatPin, ChatRsvp, ChatStanleyTap, GroupStanley, ChatThread, ChatUrgency } from '../../api/chatTypes'
import { isApiError } from '../../api/errors'
import { chatStorage } from '../../data/chatStorage'
import { optimistic } from '../../data/optimistic'
import { canTarget, conversationFromSearch, messageFromSearch, dividerBefore, incomingSince, isNearBottom, MAX_TEXT, mergeMessages, newClientId, pendingFor, sendProblem, withLatest, withOlder, QUICK_REPLY_KEYS, type PendingMessage, type SendProblem } from '../../domain/chatThread'
import { nextReaction, readReactionJob, reactionJob, setMyReaction, withReactions, type ReactionJob } from '../../domain/chatReactions'
import { readDraft, saveDraft } from '../../domain/chatDrafts'
import { insertMention, mentionedIds, mentionQuery, type MentionPerson } from '../../domain/chatCards'
import { announceTyping, isMuted, isSameConversation, muteFor, shouldSendTyping, TYPING_EXPIRE_MS, type MuteLength } from '../../domain/chatControl'
import { ashoreNames } from '../../domain/chatSms'
import { useChatDnd } from '../../hooks/useChatDnd'
import { announceMode, levelsFor, urgencyOf } from '../../domain/chatUrgency'
import { readCachedThread, saveThread } from '../../domain/chatCache'
import { chatChanged, isChatLive, useChatLive, useChatTyping } from '../../hooks/useChatSummary'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { sendWithin, useOutbox, worthRetrying } from '../../hooks/useOutbox'
import { useLatest } from '../../hooks/useLatest'
import { closeChatNotice, currentSupport } from '../../push/browser'
import { useVisibleInterval } from '../../hooks/useVisibleInterval'
import { useNow, useOwnerId, usePersona } from '../../hooks/useDemo'
import { api } from '../../runtime'
import { t, type StringKey, headingCase } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { CalendarPlus, ListChecks, Frown, Handshake, Heart, Hourglass, Laugh, MapPin, PartyPopper, Phone, Check, CircleCheck, Clock, ThumbsUp, X, Footprints, type LucideIcon } from 'lucide-react'

/** A small icon for each quick reply; the words are its label. */
/** The quick replies in rows of related ones: answers, getting together, and feelings. */
const QUICK_GROUPS: readonly (readonly (typeof QUICK_REPLY_KEYS)[number][])[] = [['yes', 'no', 'ok', 'thanks', 'sorry'], ['omw', 'late', 'wait', 'where', 'call', 'seeyou'], ['laugh', 'love', 'cheers']]
const QUICK_ICONS: Record<(typeof QUICK_REPLY_KEYS)[number], LucideIcon> = { yes: Check, no: X, omw: Footprints, thanks: ThumbsUp, late: Clock, ok: CircleCheck, laugh: Laugh, love: Heart, call: Phone, where: MapPin, wait: Hourglass, seeyou: Handshake, sorry: Frown, cheers: PartyPopper }
import { TextArea } from '../Field'
import { ActionError } from '../account/parts'
import { ClearDraft } from '../ClearDraft'
import { DraftPhotos, PhotoAttach, PhotoTermsDialog, type StagedPhoto } from '../aboard/ChatSafe'
import { useShipTime } from './shipTime'
import { GroupPage, NewGroupPage } from './ChatGroups'
import { LeavePersonalChat, NewPersonalChatPage } from './ChatPersonal'
import { MentionList, PinBar, ShareChooser } from './ChatCards'
import { PlanTools } from './ChatPlanning'
import { CoordinatorProvider } from './ChatCoordinator'
import { RoomDetails, RulesDialog } from './ChatRooms'
import { AskStanleyButton, AskStanleyNote, CatchUpButton, HelpMeReword, HelpMeWrite, PolishDraft, StanleyTapNote, StanleyTapProvider } from './ChatStanley'
import { askBefore, showCatchUp, unreadAfter, withAsk } from '../../domain/chatStanley'
import { ChatAvatar } from './ChatLooks'
import { subscribeGreeting, takePendingGreeting, withGreeting } from '../../chat/greet'
import { EmojiPicker } from './ChatEmoji'
import { insertEmoji, wantsEmojiPicker } from '../../domain/chatEmoji'
import { chatFeedback } from '../../domain/chatFeedback'
import { playCue } from '../../sound/cues'
import { buzz, BUZZ } from '../../settings/haptics'
import { getSettings } from '../../settings/store'
import { isRoomChat, needsRules, roomPostState } from '../../domain/chatRooms'
import { canPost, readAnswerJob, type AnswerJob } from '../../domain/chatPlanning'
import { ChatStats, ConversationList, GoneFromChat, MembersButton, SenderFilter } from './ChatConversationList'
import { AskStanley, MessageRow, NeedsYouStrip, PushPromptNote, StanleyItems, StanleyNotices, TypingLine } from './ChatMessages'
import { ChatMenu, Options, RoomNotes } from './ChatThreadMenus'
import { prefersReducedMotion } from './chatConversationShared'
import { roomClosedKey, typingText } from './chatConversationHelpers'

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
  // `/chat/c/new` is the New Chat Group page, and `/chat/c/personal` the New Personal Chat page.
  if (id === 'personal') return <div className="page"><NewPersonalChatPage /></div>
  if (id === 'new') return <div className="page"><NewGroupPage onCreated={() => { void nav('/chat') }} /></div>
  const open = conversationFromSearch(`c=${encodeURIComponent(id)}`)
  if (!open) return <Navigate to="/chat" replace />
  // `?manage=1` is a group's people-and-invites page.
  if (params.get('manage') === '1') return <div className="page"><GroupPage key={open} id={open} onChanged={() => undefined} onLeft={() => { void nav('/chat') }} /></div>
  return <div className="page"><Thread key={open} id={open} jumpTo={messageFromSearch(params.toString())} onBack={() => { void nav('/chat') }} /></div>
}

/** Conversations this device has already said it received messages for (by id and last message time), so a refresh of the list does not ask again. */
/** After a card grows (a delete or edit panel, the reaction picker, an error), bring the whole card into view in the history; nothing moves if it already fits. */
/** Opens one of the sharing sections under the message box (a place, or a poll or plan) and brings it into view. */
const openTool = (selector: string): void => {
  const el = document.querySelector<HTMLDetailsElement>(selector)
  if (!el) return
  el.open = true
  el.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  el.querySelector('summary')?.focus()
}

/** Whether the message history (its own scrolling box) is at its end. */
const nearBottom = (box: HTMLElement | null): boolean => (box ? isNearBottom(box.scrollTop, box.clientHeight, box.scrollHeight) : true)

type Phase = 'loading' | 'ready' | 'error' | 'gone'

function Thread({ id, onBack, jumpTo }: { id: string; onBack: () => void; jumpTo?: string | null }) {
  const nav = useNavigate()
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
  const [details, setDetails] = useState(false)
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
  // Leaving the chat with words in the box also ends "is typing".
  useEffect(() => () => { if (typingSentAt.current !== null) { typingSentAt.current = null; api.chatConversations.typingStop(id).catch(() => undefined) } }, [id])
  const typersRef = useRef<string[]>([])
  const end = useRef<HTMLDivElement>(null)
  const lastSeen = useRef<string | null>(null)
  const lastRead = useRef<string | null>(null)
  const first = useRef(true)
  const mine = me?.id ?? ''
  const [senders, setSenders] = useState<string[]>([])

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
    // The history goes to its newest message, and the box takes the focus.
    const log = logBox.current
    if (log) log.scrollTop = log.scrollHeight
    box.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    requestAnimationFrame(() => { box.focus({ preventScroll: true }); box.setSelectionRange(next.length, next.length) })
  })
  useEffect(() => subscribeGreeting(runGreet), [runGreet])
  // A greeting asked for from the members list on the chat list waits for this conversation to be ready.
  useEffect(() => {
    if (phase !== 'ready') return
    const name = takePendingGreeting()
    if (name) requestAnimationFrame(() => runGreet(name))
  }, [phase, runGreet])
  // Photos attached to the draft go out together with its words when the guest presses Send.
  const [askTerms, setAskTerms] = useState(false)
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
  const acceptTerms = useAction(async () => { await api.chatConnections.acceptPhotoTerms(); setAskTerms(false); void sendDraftPhotos.run() })
  const cancelDraft = () => { if (typingSentAt.current !== null) { typingSentAt.current = null; api.chatConversations.typingStop(id).catch(() => undefined) }; setText(''); setDraftPhotos([]); setReplyTo(null); setLevel('normal'); setProblem(null) }
  const submit = async (quick?: string) => {
    if (quick === undefined && draftPhotos.length > 0) {
      // The first photo a guest ever sends asks them to accept the photo terms; the draft stays put until they do.
      void api.chatConnections.photoTerms().then((accepted) => { if (accepted) void sendDraftPhotos.run(); else setAskTerms(true) }, () => { void sendDraftPhotos.run() })
      return
    }
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
  const reacted = heldReactions.length === 0 ? messages : messages.map((m) => heldReactions.reduce((acc, j) => (j.messageId === m.id ? withReactions(acc, setMyReaction(acc.reactions, j.emoji)) : acc), m))
  // Filtering by sender shows only what the chosen people wrote (nothing of Stanley's or the system lines).
  const shownMessages = senders.length === 0 ? reacted : reacted.filter((m) => !m.stanley && !m.system && senders.includes(m.from))
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
    <CoordinatorProvider value={conversation?.kind === 'group' && groupStanley.data ? { groupId: id, state: groupStanley.data } : null}>
    <section aria-labelledby="thread-h" data-tour="chat-thread">
      <h2 id="thread-h"><span className="person-line">{conversation?.kind === 'direct' && <ChatAvatar avatar={conversation.avatar} name={name} />}{name}</span></h2>
      {permanent && <p className="muted" role="note">{t('stanley.chat.permanent')}</p>}
      {conversation?.kind === 'direct' && <LeavePersonalChat conversationId={id} name={name} onLeft={onBack} />}
      {conversation && !permanent && !room && conversation.kind !== 'stanley' && <ChatStats c={conversation} shipTime={shipTime} />}
      {conversation?.kind === 'group' && <MembersButton chat={conversation} shipTime={shipTime} />}
      {conversation && (conversation.kind === 'group' || conversation.kind === 'party') && (conversation.people?.length ?? 0) > 0 && <SenderFilter people={conversation.people ?? []} mine={mine} picked={senders} onChange={setSenders} />}
      {back && !offline && <p className="muted">{t('conv.backOnShip', { names: back })}</p>}
      {ashore && <p className="muted">{t('conv.ashore', { names: ashore })}</p>}
      {conversation?.guardianCanRead && <p className="muted" role="note">{t('conv.guardian')}</p>}
      {room?.room && <RoomNotes room={room} />}
      {details && room && <RoomDetails conversation={room} onClose={() => setDetails(false)} onLeft={() => { setDetails(false); onBack() }} />}
      {askRules && room && <RulesDialog conversation={room} onClose={() => setAskRules(false)} onAccepted={() => { setAskRules(false); setConversation((c) => (c?.room ? { ...c, room: { ...c.room, rulesAccepted: true } } : c)); setAnnounce(t('room.rulesAccepted')); void load() }} />}
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
          ? <StanleyItems messages={messages} mine={mine} shipTime={shipTime} conversationId={id} ackBusy={ack.busy} onAck={runAck} onChanged={runChanged} onBlocked={onBlocked} onDelete={runRemove} />
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
        <form ref={form} data-tour="chat-composer" className="composer composer--chat" onSubmit={(e) => { e.preventDefault(); void submit() }}>
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
              // Gave up on the message (box cleared): the others' dots stop now, and start again when they type again.
              if (typingOn && !room && !e.target.value.trim() && typingSentAt.current !== null) { typingSentAt.current = null; api.chatConversations.typingStop(id).catch(() => undefined) }
              if (typingOn && !room && e.target.value.trim() && shouldSendTyping(typingSentAt.current, tick)) { typingSentAt.current = tick; api.chatConversations.typing(id).catch(() => { typingSentAt.current = null }) }
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit() } else if (e.key === 'Escape' && typedMention) { e.preventDefault(); setMentionOff(true) } }}
            onKeyUp={(e) => setCaret(e.currentTarget.selectionStart ?? 0)} onClick={(e) => setCaret(e.currentTarget.selectionStart ?? 0)} />
          <details className="chat-more chat-more--inline writing-helpers">
            <summary>{headingCase(t('conv.writeMore'))}</summary>
            <div className="wh">
              <section className="wh__group" aria-label={t('wh.add')}>
                <p className="wh__title" aria-hidden="true">{t('wh.add')}</p>
                <div className="wh__row">
                  {emojiOk && <Button type="button" variant="tertiary" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((o) => !o)}>{t('emoji.button')}</Button>}
                  {!room && <Button type="button" variant="tertiary" icon={MapPin} onClick={() => openTool('.chat-share:not(.chat-plan-tools)')}>{t('wh.place')}</Button>}
                  {!room && conversation!.kind !== 'direct' && <Button type="button" variant="tertiary" icon={ListChecks} onClick={() => openTool('.chat-plan-tools')}>{t('wh.poll')}</Button>}
                  {!room && conversation!.kind !== 'direct' && <Button type="button" variant="tertiary" icon={CalendarPlus} onClick={() => openTool('.chat-plan-tools')}>{t('wh.plan')}</Button>}
                </div>
                {emojiOk && emojiOpen && <EmojiPicker onClose={() => { setEmojiOpen(false); form.current?.querySelector('textarea')?.focus() }} onPick={(emoji) => {
                  const box = form.current?.querySelector('textarea')
                  const next = insertEmoji(text, box?.selectionStart ?? text.length, box?.selectionEnd ?? text.length, emoji, MAX_TEXT)
                  setText(next.text)
                  setCaret(next.caret)
                  setEmojiOpen(false)
                  box?.focus()
                  requestAnimationFrame(() => box?.setSelectionRange(next.caret, next.caret))
                }} />}
              </section>
              {tap?.available && (
                <section className="wh__group" aria-label={t('wh.ask')}>
                  <p className="wh__title" aria-hidden="true">{t('wh.ask')}</p>
                  <div className="wh__row">
                    <AskStanleyButton onAsk={() => {
                      const next = withAsk(text).slice(0, MAX_TEXT)
                      setText(next)
                      setCaret(next.length)
                      const box = form.current?.querySelector('textarea')
                      requestAnimationFrame(() => { box?.focus(); box?.setSelectionRange(next.length, next.length) })
                    }} />
                    <HelpMeWrite onUse={putInBox} />
                  </div>
                </section>
              )}
              <AskStanleyNote text={text} />
              <PolishDraft text={text} onUse={putInBox} />
            </div>
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
          {!room ? <PhotoAttach photos={draftPhotos} onChange={setDraftPhotos}><Button type="submit" disabled={(!text.trim() && draftPhotos.length === 0) || sendDraftPhotos.busy}>{t('chat.send')}</Button></PhotoAttach> : <div className="composer__actions"><Button type="submit" disabled={(!text.trim() && draftPhotos.length === 0) || sendDraftPhotos.busy}>{t('chat.send')}</Button></div>}
          <ClearDraft show={text.trim() !== '' || draftPhotos.length > 0} onClear={cancelDraft} />
          <DraftPhotos photos={draftPhotos} onChange={setDraftPhotos} />
          {askTerms && <PhotoTermsDialog busy={acceptTerms.busy} failed={acceptTerms.error !== null && acceptTerms.error !== undefined} onProceed={() => void acceptTerms.run().catch(() => undefined)} onCancel={() => setAskTerms(false)} />}
          <ActionError error={sendDraftPhotos.error} />
          {!room && <div role="group" aria-label={t('conv.quick')} className="chat-quick">
            {QUICK_GROUPS.map((keys) => (
              <div key={keys[0]} className="chat-quick__row">
                {keys.map((k) => { const Icon = QUICK_ICONS[k]; return <button key={k} type="button" className="chat-quick__btn" aria-label={t(`conv.quick.${k}`)} title={t(`conv.quick.${k}`)} onClick={() => void submit(t(`conv.quick.${k}`))}><Icon aria-hidden="true" /></button> })}
              </div>
            ))}
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
      {conversation?.kind === 'group' && <Button variant="secondary" onClick={() => { void nav(`/chat/c/${encodeURIComponent(id)}?manage=1`) }}>{t('cgroup.details')}</Button>}
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
