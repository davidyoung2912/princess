import type { ReactNode } from 'react'
import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useSearchParams } from 'react-router'
import stanleyPicture from '../../assets/stanley-small.png'
import { requestStanley } from '../../ai/stanleyOpen'
import { getStanleyThread, subscribeStanley } from '../../ai/stanley'
import { copyAge, isStanleyChat, needsYou, noticeBody, noticeHeadline, noticeState, questionFrom, safeNoticePath, startsDay, subtitleOf, threadItems } from '../../domain/stanleyThread'
import type { ChatConversation, ChatMessage, ChatThread, ChatUrgency } from '../../api/chatTypes'
import { isApiError } from '../../api/errors'
import { chatStorage } from '../../data/chatStorage'
import { optimistic } from '../../data/optimistic'
import {
  conversationFromSearch, deliveryOf, incomingSince, initials, isNearBottom, lastLine, MAX_TEXT, mergeMessages, newClientId, pendingFor, sendProblem, withLatest, withOlder,
  type PendingMessage, type SendProblem,
} from '../../domain/chatThread'
import { ashoreNames } from '../../domain/chatSms'
import { dndChoices, dndEndsAt } from '../../domain/chatDnd'
import { useChatDnd } from '../../hooks/useChatDnd'
import { ackedCount, announceMode, levelsFor, sortConversations, urgencyOf } from '../../domain/chatUrgency'
import { readCachedThread, readList, saveList, saveThread } from '../../domain/chatCache'
import { addPlanCard, encodePlanCard, hasPlanCard, newPlanCard, parsePlanCard, PLACE_MAX, planCardSentence, type PlanCard } from '../../domain/planCard'
import { MAX_PLAN_DAY } from '../../domain/nightsRules'
import { chatChanged, fetchChatSummary, isChatLive, useChatLive } from '../../hooks/useChatSummary'
import { useAction } from '../../hooks/useAction'
import { useMemory } from '../../hooks/useMemory'
import { useMine } from '../../hooks/useMine'
import { sendWithin, useOutbox, worthRetrying } from '../../hooks/useOutbox'
import { useLatest } from '../../hooks/useLatest'
import { closeChatNotice } from '../../push/browser'
import { useVisibleInterval } from '../../hooks/useVisibleInterval'
import { useNow, useOwnerId, usePersona } from '../../hooks/useDemo'
import { useSettings } from '../../hooks/useSettings'
import { api } from '../../runtime'
import { t, th as heading } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Chip } from '../Chip'
import { ChatNoticeOffers } from './ChatNoticeOffers'
import { OctagonAlert, TriangleAlert } from '../icons'
import { DeferredImage } from '../DeferredImage'
import { Field, TextArea } from '../Field'
import { ActionError } from '../account/parts'
import { BlockedList, MessageSafety, PhotoSender } from '../aboard/ChatSafe'
import { useShipTime } from './shipTime'
import { GroupDetails, NewGroup } from './ChatGroups'

/**
 * Chats (docs/chat-plan.md, 4.8): the conversation list is the home of Chat, and one tap opens a conversation. The open conversation is in the address (`?c=`),
 * so back returns to the list and an alert opens the right one. Each conversation has its own history and its own unread count.
 */
export function Conversations() {
  const [params, setParams] = useSearchParams()
  const open = conversationFromSearch(params.toString())
  return open ? <Thread key={open} id={open} onBack={() => setParams({})} /> : <ConversationList onOpen={(id) => setParams({ c: id })} />
}

function ConversationList({ onOpen }: { onOpen: (id: string) => void }) {
  const shipTime = useShipTime()
  const owner = useOwnerId() ?? 'none'
  // The copy from last time shows at once; the server's answer replaces it behind it.
  const [rows, setRows] = useState<ChatConversation[] | null>(() => readList(chatStorage(), owner))
  const [failed, setFailed] = useState(false)
  // Conversations with an urgent message nobody on this account has acknowledged stay at the top; the numbers come from the server so every device agrees.
  const [urgentIds, setUrgentIds] = useState<string[]>([])
  const load = useCallback(() => {
    fetchChatSummary().then((s) => setUrgentIds(s.urgentConversations), () => undefined)
    api.chatConversations.list().then(
      (list) => { setRows(list); setFailed(false); saveList(chatStorage(), owner, list) },
      () => setFailed(true),
    )
  }, [owner])
  // oxlint-disable-next-line react/set-state-in-effect -- loading from the server is the external system this effect synchronizes with
  useEffect(() => { load() }, [load])
  useChatLive(load)
  // The live connection says when something changed; reading on a timer is only the fallback while it is down.
  useVisibleInterval(() => { if (!isChatLive()) load() }, 30_000)
  const [making, setMaking] = useState(false)
  return (
    <section aria-labelledby="conv-h">
      <h2 id="conv-h">{heading('conv.title')}</h2>
      <Button variant="secondary" onClick={() => setMaking(true)}>{t('cgroup.new')}</Button>
      <DoNotDisturb />
      {making && <NewGroup onClose={() => setMaking(false)} onCreated={(g) => { setMaking(false); onOpen(g.id) }} />}
      {failed && rows && <Banner kind="offline" title={t('conv.stale')} action={<Button variant="secondary" onClick={load}>{t('ref.retry')}</Button>} />}
      {failed && !rows && <Banner kind="offline" title={t('conv.offline')} action={<Button variant="secondary" onClick={load}>{t('ref.retry')}</Button>} />}
      {!rows && !failed && <p role="status" className="muted">{t('account.loading')}</p>}
      {rows && (rows.length === 0 ? <p>{t('conv.none')}</p> : (
        <ul className="conv-list" aria-label={t('conv.title')}>
          {sortConversations(rows, urgentIds).map((c) => {
            const level: ChatUrgency = urgentIds.includes(c.id) ? 'urgent' : urgencyOf(c.last) === 'important' && c.unread > 0 && !c.last?.mine ? 'important' : 'normal'
            return (
            <li key={c.id}>
              <button type="button" className={[c.unread > 0 ? 'conv conv--unread' : 'conv', level !== 'normal' && `conv--${level}`].filter(Boolean).join(' ')} onClick={() => onOpen(c.id)}>
                {isStanleyChat(c)
                  ? <img className="conv__avatar conv__avatar--stanley" src={stanleyPicture} alt="" width="44" height="44" />
                  : <span className="conv__avatar" aria-hidden="true">{initials(c.name)}</span>}
                <span className="conv__body">
                  <span className="conv__top">
                    <strong>{c.name}</strong>
                    {c.last && <span className="muted conv__time">{shipTime(c.last.at)}</span>}
                  </span>
                  {isStanleyChat(c) && subtitleOf(c) && <span className="muted conv__sub">{t('stanley.chat.speaking', { name: subtitleOf(c) })}</span>}
                  {level !== 'normal' && <UrgencyTag level={level} />}
                  <span className="conv__last muted">{lastLine(c, t('conv.you'), t('conv.photo')) || '\u00a0'}</span>
                  {(c.muted || c.closed) && <span className="conv__tags muted">{[c.muted && t('conv.muted'), c.closed && t('conv.closed')].filter(Boolean).join(' · ')}</span>}
                </span>
                {c.unread > 0 && (
                  <span className="conv__unread">
                    <span aria-hidden="true">{c.unread}</span>
                    <span className="visually-hidden">{t('conv.unread', { count: c.unread })}</span>
                  </span>
                )}
              </button>
            </li>
            )
          })}
        </ul>
      ))}
    </section>
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

const prefersReducedMotion = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const nearBottom = (): boolean => {
  const el = document.documentElement
  return isNearBottom(window.scrollY, window.innerHeight, el.scrollHeight)
}

type Phase = 'loading' | 'ready' | 'error' | 'gone'

/** One conversation: the latest 30 messages, older ones on request, a composer that never blocks typing, and live arrival that does not move what the guest is reading. */
function Thread({ id, onBack }: { id: string; onBack: () => void }) {
  const me = usePersona()
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
  const [ashore, setAshore] = useState(() => ashoreNames(cached?.ashore))
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
      setMayUrgent(th.mayUrgent === true)
      latestAnswer.current = th
      setFetchedAt(Date.now())
      // The first live answer replaces the copy; later ones refresh the latest page and keep older pages already loaded.
      setMessages((cur) => (first.current ? th.messages : withLatest(cur, th.messages)))
      if (first.current) { setHasMore(th.hasMore); first.current = false }
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

  const toEnd = useCallback(() => { end.current?.scrollIntoView({ block: 'end', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); setChip(false) }, [])

  // New arrivals follow the guest only when they are already at the bottom; otherwise a chip says so and nothing moves. Focus is never touched.
  const wasNear = useRef(true)
  const userScrolled = useRef(false)
  useEffect(() => {
    const onScroll = () => { userScrolled.current = true; wasNear.current = nearBottom(); if (wasNear.current) setChip(false) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    if (phase !== 'ready') return
    const incoming = incomingSince(lastSeen.current, messages, mine)
    const wasFirst = lastSeen.current === null
    lastSeen.current = messages[messages.length - 1]?.id ?? null
    // oxlint-disable-next-line react/set-state-in-effect -- the first page arrived from the server: show its end
    if (wasFirst) { if (messages.length > 0) toEnd(); return }
    if (incoming) {
      // oxlint-disable-next-line react/set-state-in-effect -- a message that just arrived from the server is announced once and may raise the chip
      if (announceMode(urgencyOf(incoming)) === 'assertive') setAlertText(t('urgent.incoming', { name: incoming.fromName ?? '' }))
      else setAnnounce(t('conv.incoming', { name: incoming.fromName ?? '' }))
      if (wasNear.current) toEnd(); else setChip(true)
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
      anchor.current = { height: document.documentElement.scrollHeight, y: window.scrollY }
      setMessages((cur) => withOlder(cur, th.messages))
      setHasMore(th.hasMore)
    } finally { loadingOlder.current = false }
  })
  const runOlder = useLatest(() => void older.run())
  const top = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = top.current
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting && userScrolled.current) runOlder() })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, runOlder])
  useLayoutEffect(() => {
    const a = anchor.current
    if (!a) return
    anchor.current = null
    window.scrollTo(0, a.y + (document.documentElement.scrollHeight - a.height))
  }, [messages])

  const ack = useAction(async (messageId: string) => {
    await api.chatConversations.ack(id, messageId)
    chatChanged()
    await load()
  })

  // Stable, so a keystroke in the composer does not re-render the messages above it.
  const runAck = useLatest((messageId: string) => void ack.run(messageId))
  const runChanged = useLatest(() => void load())
  const onBlocked = useLatest(() => { void load(); setBlockedVersion((v) => v + 1) })

  const mute = useAction(async (on: boolean) => {
    await optimistic(() => setConversation((c) => (c ? { ...c, muted: on } : c)), () => api.chatConversations.mute(id, on), () => setConversation((c) => (c ? { ...c, muted: !on } : c)))
  })

  const notifyAway = useAction(async (on: boolean) => {
    await optimistic(() => setConversation((c) => (c ? { ...c, notifyAway: on } : c)), () => api.chatConversations.notifyAway(id, on), () => setConversation((c) => (c ? { ...c, notifyAway: !on } : c)))
  })

  // ---- Sending ----
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<SendProblem | null>(null)
  const [full, setFull] = useState(false)
  const [sending, setSending] = useState<PendingMessage[]>([])
  const outbox = useOutbox(ownerId ?? 'none', 'chat', (p) => (p.conversation ? api.chatConversations.send(p.conversation, p.text, p.clientId, (p.urgency as ChatUrgency | undefined) || undefined) : Promise.resolve()), () => void load())
  const submit = async () => {
    const body = text.trim()
    if (!body) return
    setProblem(null)
    setFull(false)
    const clientId = newClientId()
    const sendLevel = mayUrgent || level !== 'urgent' ? level : 'normal'
    setLevel('normal')   // each message chooses again: a habit of urgent would stop meaning anything
    setText('')   // typing is never blocked: the message is on screen at once, marked Sending
    setSending((s) => [...s, { id: clientId, text: body, state: 'sending' }])
    try {
      const sent = await sendWithin(api.chatConversations.send(id, body, clientId, sendLevel))
      setMessages((cur) => mergeMessages(cur, [sent]))
      wasNear.current = true
    } catch (e) {
      if (worthRetrying(e)) {
        if (!outbox.hold({ conversation: id, text: body, clientId, urgency: sendLevel })) { setText((cur) => cur || body); setLevel(sendLevel); setFull(true) }
      } else {
        // The text stays in the box so the guest does not lose it.
        setText((cur) => cur || body)
        const why = isApiError(e) ? sendProblem(e.code, e.message) : 'other'
        setLevel(why === 'urgency' ? 'normal' : sendLevel)
        setProblem(why)
        if (isApiError(e) && e.code === 'notFound') setPhase('gone')
      }
    } finally {
      setSending((s) => s.filter((x) => x.id !== clientId))
    }
  }

  if (phase === 'gone') {
    return (
      <section>
        <Button variant="tertiary" onClick={onBack}>{t('conv.back')}</Button>
        <Banner kind="info" title={t('conv.gone')} />
      </section>
    )
  }
  const queued = pendingFor(id, outbox.items).filter((q) => !messages.some((m) => m.id === q.id))
  const bubbles: PendingMessage[] = [...sending, ...queued.filter((q) => !sending.some((s) => s.id === q.id))]
  const name = conversation?.name ?? ''
  const permanent = conversation !== null && isStanleyChat(conversation)
  // Offline, the copy says how old it is, so a guest reads "As of 3:10" rather than taking old notices for current ones.
  const age = copyAge(fetchedAt, shipTime)
  const staleTitle = permanent && age ? `${t('conv.stale')} ${t('stanley.notice.asOf', { time: age })}` : t('conv.stale')
  return (
    <section aria-labelledby="thread-h">
      <Button variant="tertiary" onClick={onBack}>{t('conv.back')}</Button>
      <h2 id="thread-h">{name}</h2>
      {permanent && <><p className="muted">{t('stanley.chat.speaking', { name: subtitleOf(conversation) })}</p><p className="muted" role="note">{t('stanley.chat.permanent')}</p></>}
      {conversation && conversation.kind !== 'direct' && !permanent && (
        <p className="muted">{conversation.members.length > 0 ? t('conv.members', { names: conversation.members.join(', ') }) : t('conv.alone')}</p>
      )}
      {ashore && <p className="muted">{t('conv.ashore', { names: ashore })}</p>}
      {conversation?.guardianCanRead && <p className="muted" role="note">{t('conv.guardian')}</p>}
      {conversation?.kind === 'group' && <Button variant="secondary" onClick={() => setDetails(true)}>{t('cgroup.details')}</Button>}
      {details && <GroupDetails id={id} onClose={() => setDetails(false)} onChanged={() => void load()} onLeft={() => { setDetails(false); onBack() }} />}
      <p role="status" className="visually-hidden">{announce}</p>
      <p role="alert" className="visually-hidden">{alertText}</p>
      {phase === 'loading' && <p role="status" className="muted">{t('account.loading')}</p>}
      {offline && phase === 'ready' && <Banner kind="offline" title={staleTitle} action={<Button variant="secondary" onClick={() => void load()}>{t('ref.retry')}</Button>} />}
      {phase === 'error' && <Banner kind="offline" title={t('conv.offline')} action={<Button variant="secondary" onClick={() => void load()}>{t('ref.retry')}</Button>} />}
      {permanent && <NeedsYouStrip messages={messages} ackBusy={ack.busy} onAck={runAck} />}
      <div ref={top} />
      {hasMore && <Button variant="secondary" disabled={older.busy} onClick={() => void older.run()}>{t('conv.earlier')}</Button>}
      <ActionError error={older.error} />
      {phase === 'ready' && messages.length === 0 && bubbles.length === 0 && <p>{t('chat.none')}</p>}
      <ol className="chat-log" aria-label={t('conv.messages', { name })}>
        {permanent
          ? <StanleyItems messages={messages} mine={mine} shipTime={shipTime} conversationId={id} ackBusy={ack.busy} onAck={runAck} onChanged={runChanged} onBlocked={onBlocked} />
          : messages.map((m) => (
            <MessageRow key={m.id} m={m} mine={mine} shipTime={shipTime} conversationId={id} kind={conversation?.kind} peerName={conversation?.name ?? ''} ackBusy={ack.busy} onAck={runAck} onBlocked={onBlocked} />
          ))}
        {bubbles.map((b) => (
          <li key={b.id} className="chat-msg chat-msg--mine chat-msg--pending">
            <p>{b.text}</p>
            <p className="muted">{t(b.state === 'sending' ? 'conv.sending' : 'conv.waiting')}</p>
          </li>
        ))}
      </ol>
      <div ref={end} />
      {chip && <div className="chat-chip"><Button variant="secondary" onClick={toEnd}>{t('conv.newMessages')}</Button></div>}
      {permanent && phase === 'ready' && <AskStanley />}
      {!permanent && (conversation?.closed ? <Banner kind="info" title={t('conv.closed')}><p>{t('conv.closedBody')}</p></Banner> : phase === 'ready' && (
        <form className="composer" onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <fieldset className="urgency-pick">
            <legend>{t('urgent.pick')}</legend>
            {levelsFor(mayUrgent).map((l) => (
              <label key={l} className="urgency-pick__option">
                <input type="radio" name="urgency" value={l} checked={level === l} onChange={() => setLevel(l)} /> {t(`urgent.level.${l}`)}
              </label>
            ))}
            <p className="muted">{t(`urgent.explain.${level}`)}</p>
          </fieldset>
          <TextArea label={t('chat.message')} value={text} rows={2} maxLength={MAX_TEXT} autoComplete="off"
            onChange={(e) => { setText(e.target.value); if (problem) setProblem(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit() } }} />
          {problem && <p role="alert" className="field__error">{t(problem === 'blocked' ? 'conv.blocked' : problem === 'contact' ? 'conv.contact' : problem === 'gone' ? 'conv.gone' : problem === 'urgency' ? 'urgent.denied' : problem === 'urgencyLimit' ? 'urgent.limit' : 'conv.failed')}</p>}
          {problem && problem !== 'blocked' && problem !== 'urgency' && problem !== 'urgencyLimit' && <p className="muted">{t('chat.kept')}</p>}
          {full && <p role="alert" className="field__error">{t('outbox.full')}</p>}
          <Button type="submit" disabled={!text.trim()}>{t('chat.send')}</Button>
        </form>
      ))}
      {conversation && permanent && <StanleyNotices />}
      {conversation && !permanent && <Options conversation={conversation} muteBusy={mute.busy} onMute={(on) => void mute.run(on)} awayBusy={notifyAway.busy} onAway={(on) => void notifyAway.run(on)} onSent={() => void load()} blockedVersion={blockedVersion} reload={() => void load()} />}
      <ActionError error={mute.error} />
      <ActionError error={notifyAway.error} />
      <ActionError error={ack.error} />
    </section>
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
  const items = threadItems(messages, device)
  return items.map((item, i) => {
    const heading = startsDay(items, i) ? <li key={`h:${item.key}`} className="chat-day"><h3>{new Date(item.at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</h3></li> : null
    const row = ((): ReactNode => {
    if (item.kind === 'server') return <MessageRow key={item.key} m={item.message} mine={mine} shipTime={shipTime} conversationId={conversationId} kind="stanley" peerName="" ackBusy={ackBusy} onAck={onAck} onChanged={onChanged} onBlocked={onBlocked} />
    const asked = item.kind === 'question'
    return (
      <li key={item.key} className={asked ? 'chat-msg chat-msg--mine' : 'chat-msg'}>
        <p className="chat-msg__meta"><strong>{asked ? t('stanley.chat.asked') : t('stanley.chat.from')}</strong></p>
        <p>{item.text}</p>
      </li>
    )
    })()
    return <Fragment key={item.key}>{heading}{row}</Fragment>
  })
}

const LANE_KEY = { critical: 'stanley.notice.lane.critical', important: 'stanley.notice.lane.important', reminder: 'stanley.notice.lane.reminder', info: 'stanley.notice.lane.info' } as const

/** The strip at the top of Stanley's thread: critical and important notices still waiting for Got it, so a guest who scrolled past forty messages still sees what is outstanding. */
function NeedsYouStrip({ messages, ackBusy, onAck }: { messages: ChatMessage[]; ackBusy: boolean; onAck: (messageId: string) => void }) {
  const now = useNow()
  const waiting = needsYou(messages, now)
  if (waiting.length === 0) return null
  return (
    <section className="chat-needs" aria-labelledby="needs-h">
      <h3 id="needs-h">{t('stanley.notice.needsTitle')}</h3>
      <p className="muted">{t('stanley.notice.needsBody')}</p>
      <ul>
        {waiting.map((m) => (
          <li key={m.id}>
            <span>{noticeHeadline(m.text)}</span> <Button disabled={ackBusy} onClick={() => onAck(m.id)}>{t('urgent.gotIt')}</Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The free-text box. Asking goes through Stanley's own window (his limits, safety screen and tools live there), with the words already in its box. */
function AskStanley() {
  const [text, setText] = useState('')
  const ask = questionFrom(text)
  return (
    <form className="composer" onSubmit={(e) => { e.preventDefault(); if (ask) { requestStanley(ask); setText('') } }}>
      <TextArea label={t('stanley.chat.askLabel')} value={text} rows={2} maxLength={500} autoComplete="off" onChange={(e) => setText(e.target.value)} />
      <p className="muted">{t('stanley.chat.askHint')}</p>
      <Button type="submit" disabled={!ask}>{t('stanley.chat.askButton')}</Button>
      <p className="muted">{t('stanley.chat.history')}</p>
    </form>
  )
}

/** The shell of the Stanley notices settings. The categories, quiet hours and budget are the existing notification settings; the relay that fills this chat with them comes in the next slice. */
function StanleyNotices() {
  return (
    <details className="chat-options">
      <summary>{t('stanley.chat.noticesTitle')}</summary>
      <p className="muted">{t('stanley.chat.noticesBody')}</p>
      <p><Link to="/me/notifications">{t('stanley.chat.noticesLink')}</Link></p>
    </details>
  )
}

/** A photo is not in the thread page (it is large); it is fetched once for the message and kept for the life of the page. */
const photos = new Map<string, Promise<string>>()
const photoFor = (conversationId: string, messageId: string): Promise<string> => {
  let p = photos.get(messageId)
  if (!p) {
    p = api.chatConversations.photo(conversationId, messageId)
    photos.set(messageId, p)
    // A failed fetch is forgotten so the next render can try again.
    p.catch(() => photos.delete(messageId))
  }
  return p
}

function MessagePhoto({ conversationId, messageId, name, alt, sent }: { conversationId: string; messageId: string; name: string; alt: string; sent?: string }) {
  const [settings] = useSettings()
  const [asked, setAsked] = useState(false)
  const [src, setSrc] = useState<string | undefined>(sent)
  const wanted = !settings.dataLight || asked
  useEffect(() => {
    if (!wanted || src) return
    let live = true
    photoFor(conversationId, messageId).then((url) => { if (live) setSrc(url) }, () => undefined)
    return () => { live = false }
  }, [wanted, src, conversationId, messageId])
  // In data-light mode nothing is fetched until the guest asks (DeferredImage's rule, applied before the fetch rather than after it).
  if (!wanted) return <Button variant="secondary" onClick={() => setAsked(true)}>{t('img.show', { name })}</Button>
  if (!src) return <p className="muted" role="status">{t('account.loading')}</p>
  return <DeferredImage name={name} className="chat-msg__photo" src={src} alt={alt} />
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
}

/** A relayed notice. It reads the clock itself, so a copy held on the device stops showing Got it and the actions when its time passes, even offline. */
function NoticeRow({ m, n, shipTime, conversationId, ackBusy, onAck, onChanged }: { m: ChatMessage; n: NonNullable<ChatMessage['notice']>; shipTime: (at: number) => string; conversationId: string; ackBusy: boolean; onAck: (messageId: string) => void; onChanged?: () => void }) {
  const now = useNow()
  // Its lane in words (never by colour alone), the text, why it may no longer apply, a link into the app and Got it where it asks for one.
  const state = noticeState(m, now)
  const link = state === 'active' ? safeNoticePath(n.path) : null
  const body = noticeBody(m.text)
  return (
    <li className={`chat-msg chat-msg--stanley chat-msg--lane-${n.lane}${state === 'active' ? '' : ' chat-msg--spent'}`}>
      <p className="chat-msg__level"><strong>{t(LANE_KEY[n.lane])}</strong></p>
      <p className="chat-msg__meta"><strong>{t('stanley.chat.from')}</strong>{m.subtitle && <span className="muted"> · {m.subtitle}</span>} <span className="muted">{shipTime(m.at)}</span></p>
      <p><strong>{noticeHeadline(m.text)}</strong></p>
      {body && <p>{body}</p>}
      {state !== 'active' && <p className="muted">{t(state === 'superseded' ? 'stanley.notice.superseded' : 'stanley.notice.expired')}</p>}
      {link && (n.actions ?? []).length === 0 && <LinkButton to={link} variant="secondary">{t('stanley.notice.open')}</LinkButton>}
      {state === 'active' && onChanged && <ChatNoticeOffers m={m} conversationId={conversationId} onChanged={onChanged} />}
      {state === 'active' && m.acked !== undefined && (m.acked ? <p className="muted">{t('urgent.youAcked')}</p> : <Button disabled={ackBusy} onClick={() => onAck(m.id)}>{t('urgent.gotIt')}</Button>)}
    </li>
  )
}

/** One message. Memoised: it re-renders only when its own message or the few things it shows change, not on every keystroke in the composer or every refresh of the thread. */
const MessageRow = memo(function MessageRow({ m, mine, shipTime, conversationId, kind, peerName, ackBusy, onAck, onChanged, onBlocked }: MessageRowProps) {
  if (m.system) return <li className="chat-msg chat-msg--system"><p className="muted">{m.text} · {shipTime(m.at)}</p></li>
  if (m.stanley) {
    // Stanley's own message: his name and the voice it was sent under, nothing to report, block or receipt.
    const n = m.notice
    if (!n) {
      return (
        <li className="chat-msg chat-msg--stanley">
          <p className="chat-msg__meta"><strong>{t('stanley.chat.from')}</strong>{m.subtitle && <span className="muted"> · {m.subtitle}</span>} <span className="muted">{shipTime(m.at)}</span></p>
          <p>{m.text}</p>
        </li>
      )
    }
    return <NoticeRow m={m} n={n} shipTime={shipTime} conversationId={conversationId} ackBusy={ackBusy} onAck={onAck} onChanged={onChanged} />
  }
  const own = m.from === mine
  const card = m.text ? parsePlanCard(m.text) : null
  const mlevel = urgencyOf(m)
  return (
    <li className={['chat-msg', own && 'chat-msg--mine', mlevel !== 'normal' && `chat-msg--${mlevel}`].filter(Boolean).join(' ')}>
      {mlevel !== 'normal' && <p className="chat-msg__level"><UrgencyTag level={mlevel} /></p>}
      <p className="chat-msg__meta"><strong>{own ? t('chat.you') : (m.fromName ?? '')}</strong> <span className="muted">{shipTime(m.at)}</span>{m.viaSms && <> <span className="muted">· {t('conv.viaSms')}</span></>}</p>
      {m.text && (card ? <PlanCardView card={card} /> : <p>{m.text}</p>)}
      {(m.photo || m.hasPhoto) && <MessagePhoto conversationId={conversationId} messageId={m.id} name={m.fromName ?? ''} sent={m.photo} alt={t('chat.photoAlt', { name: own ? t('chat.you') : (m.fromName ?? '') })} />}
      {!own && <MessageSafety messageId={m.id} from={m.from} name={m.fromName} onBlocked={onBlocked} />}
      {own && <p className="muted">{t(deliveryOf(m) === 'read' ? 'conv.read' : 'conv.sent')}</p>}
      {own && mlevel === 'urgent' && (
        <p className="muted">{ackedCount(m) === 0 ? t('urgent.notAcked') : kind === 'direct' ? t('urgent.ackedBy', { names: peerName }) : t('urgent.ackedCount', { count: ackedCount(m) })}</p>
      )}
      {!own && mlevel === 'urgent' && (m.acked
        ? <p className="muted">{t('urgent.youAcked')}</p>
        : <Button disabled={ackBusy} onClick={() => onAck(m.id)}>{t('urgent.gotIt')}</Button>)}
    </li>
  )
})

/** Everything that is not the message itself: mute, read receipts, a plan card, a photo, and who you have hidden. */
function Options({ conversation, muteBusy, onMute, awayBusy, onAway, onSent, blockedVersion, reload }: {
  conversation: ChatConversation; muteBusy: boolean; onMute: (on: boolean) => void; awayBusy: boolean; onAway: (on: boolean) => void; onSent: () => void; blockedVersion: number; reload: () => void
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
      <summary>{t('conv.options')}</summary>
      <div className="chip-row">
        <Chip pressed={conversation.muted} onToggle={() => { if (!muteBusy) onMute(!conversation.muted) }}>{t('conv.mute')}</Chip>
      </div>
      <p className="muted">{t('conv.muteBody')}</p>
      <div className="chip-row">
        <Chip pressed={conversation.notifyAway === true} onToggle={() => { if (!awayBusy) onAway(conversation.notifyAway !== true) }}>{t('conv.away')}</Chip>
      </div>
      <p className="muted">{t('conv.awayBody')}</p>
      <div className="chip-row">
        <Chip pressed={on} onToggle={() => void flip.run(!on)}>{t('chat.receipts')}</Chip>
      </div>
      <ActionError error={flip.error} />
      <p className="muted">{t('chat.receiptsBody')}</p>
      <p className="muted">{t('chat.noPreview')}</p>
      {!conversation.closed && (
        <>
          <PlanCardSender conversationId={conversation.id} onSent={onSent} />
          <PhotoSender conversationId={conversation.id} onSent={onSent} />
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
