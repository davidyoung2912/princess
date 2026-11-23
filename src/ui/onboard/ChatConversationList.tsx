import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import stanleyPicture from '../../assets/stanley-small.png'
import { isStanleyChat } from '../../domain/stanleyThread'
import type { ChatConversation, ChatKeep, ChatUrgency } from '../../api/chatTypes'
import { isApiError } from '../../api/errors'
import { chatStorage } from '../../data/chatStorage'
import { optimistic } from '../../data/optimistic'
import { lastLine } from '../../domain/chatThread'
import { type MentionPerson } from '../../domain/chatCards'
import { isMuted, isSameConversation, splitArchived } from '../../domain/chatControl'
import { dndChoices, dndEndsAt } from '../../domain/chatDnd'
import { useChatDnd } from '../../hooks/useChatDnd'
import { keepDate, keptUntil } from '../../domain/chatKeep'
import { sortConversations, urgencyOf } from '../../domain/chatUrgency'
import { clearChatCache, readList, saveList } from '../../domain/chatCache'
import { chatChanged, fetchChatSummary, isChatLive, useChatLive, useTypingConversations } from '../../hooks/useChatSummary'
import { useAction } from '../../hooks/useAction'
import { useVisibleInterval } from '../../hooks/useVisibleInterval'
import { useNow, useOwnerId } from '../../hooks/useDemo'
import { api } from '../../runtime'
import { t, th as heading, headingCase } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Chip } from '../Chip'
import { Depart, OctagonAlert, TriangleAlert } from '../icons'
import { Filter, Pencil, Trash2, Users, X } from 'lucide-react'

/** A small icon for each quick reply; the words are its label. */
/** The quick replies in rows of related ones: answers, getting together, and feelings. */
import { useShipTime } from './shipTime'
import { DeleteChat, GroupMembers, LeaveChat } from './ChatGroups'
import { ChatAvatar } from './ChatLooks'
import { replyTime } from './replyTime'
import { requestGreeting } from '../../chat/greet'
import { tellDelivered, typingText } from './chatConversationHelpers'

export function ConversationList({ onOpen }: { onOpen: (id: string) => void }) {
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
      (list) => {
        setRows(list); setFailed(false); saveList(chatStorage(), owner, list); tellDelivered(list)
        // The list is the freshest word on what is unread: if it disagrees with the badge on the tab bar, the badge is read again now instead of waiting for the next nudge.
        fetchChatSummary().then((s) => { if (s.unread !== list.reduce((n, c) => n + c.unread, 0)) chatChanged() }, () => undefined)
      },
      () => setFailed(true),
    )
  }, [owner])
  // oxlint-disable-next-line react/set-state-in-effect -- loading from the server is the external system this effect synchronizes with
  useEffect(() => { load() }, [load])
  useChatLive(load)
  // The live connection says when something changed; reading on a timer is only the fallback while it is down.
  useVisibleInterval(() => { if (!isChatLive()) load() }, 30_000)
  // The chat the guest is about to delete: only a group they started.
  const [deleting, setDeleting] = useState<ChatConversation | null>(null)
  const [leaving, setLeaving] = useState<ChatConversation | null>(null)
  const nav = useNavigate()
  // A group is managed (people, invitations, leaving, deleting) on a page of its own.
  const manage = (c: ChatConversation) => { void nav(`/chat/c/${encodeURIComponent(c.id)}?manage=1`) }
  return (
    <section aria-labelledby="conv-h" data-tour="chat-groups">
      {leaving && <LeaveChat chat={leaving} onClose={() => setLeaving(null)} onLeft={() => { setLeaving(null); load(); chatChanged() }} />}
      {deleting && <DeleteChat chat={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); load(); chatChanged() }} />}
      <h2 id="conv-h">{heading('conv.title')}</h2>
      {failed && rows && <Banner kind="offline" title={t('conv.stale')} action={<Button variant="secondary" onClick={load}>{t('ref.retry')}</Button>} />}
      {failed && !rows && <Banner kind="offline" title={t('conv.offline')} action={<Button variant="secondary" onClick={load}>{t('ref.retry')}</Button>} />}
      {!rows && !failed && <p role="status" className="muted">{t('account.loading')}</p>}
      {rows && (rows.length === 0 ? <p>{t('conv.none')}</p> : (() => {
        const { shown, archived } = splitArchived(sortConversations(rows, urgentIds), urgentIds)
        return (
          <>
            <ul className="conv-list" aria-label={t('conv.title')}>
              {shown.map((c) => <ConversationItem key={c.id} c={c} urgentIds={urgentIds} onOpen={onOpen} onManage={manage} onDelete={setDeleting} onLeave={setLeaving} shipTime={shipTime} now={now} keptDay={keptUntil(keeps, c.id)} />)}
            </ul>
            {archived.length > 0 && (
              <details className="conv-archived">
                <summary>{headingCase(t('conv.archivedTitle', { count: archived.length }))}</summary>
                <ul className="conv-list" aria-label={t('conv.archivedTitle', { count: archived.length })}>
                  {archived.map((c) => <ConversationItem key={c.id} c={c} urgentIds={urgentIds} onOpen={onOpen} onManage={manage} onDelete={setDeleting} onLeave={setLeaving} shipTime={shipTime} now={now} keptDay={keptUntil(keeps, c.id)} />)}
                </ul>
              </details>
            )}
          </>
        )
      })())}
      {rows && <AwayPeople rows={rows} onChange={(id, on) => setRows((cur) => (cur ? cur.map((c) => (c.id === id ? { ...c, notifyAway: on } : c)) : cur))} />}
      <p className="conv-actions"><Button variant="secondary" onClick={() => { void nav('/chat/c/personal') }}>{t('cpersonal.button')}</Button></p>
      <p><Button variant="secondary" onClick={() => { void nav('/chat/c/new') }}>{t('cgroup.new')}</Button></p>
      <DoNotDisturb />
    </section>
  )
}

/**
 * "Tell them when I go ashore": the people I chat with one to one, each with a tick. A tick is the same switch as the one in that chat's Options (so the same rules apply on the server: only people
 * I am connected with, no one who has blocked me, nothing but "left the ship" and "back on board"). It is off for everyone until I tick them. Collapsed, so it stays out of the way.
 */
export function AwayPeople({ rows, onChange }: { rows: readonly ChatConversation[]; onChange: (id: string, on: boolean) => void }) {
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

/** Choose one or more people to show only their messages in the history (the others stay on the server; clearing the filter brings everything back). */
export function SenderFilter({ people, mine, picked, onChange }: { people: readonly MentionPerson[]; mine: string; picked: readonly string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const everyone: MentionPerson[] = [{ id: mine, name: t('chat.you') }, ...people]
  const toggle = (id: string) => onChange(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id])
  return (
    <div className="sender-filter">
      <div className="button-row">
        <Button variant="secondary" icon={Filter} aria-expanded={open} onClick={() => setOpen((v) => !v)}>{picked.length > 0 ? t('sfilter.buttonOn', { count: picked.length }) : t('sfilter.button')}</Button>
        {picked.length > 0 && <Button variant="tertiary" icon={X} onClick={() => onChange([])}>{t('sfilter.clear')}</Button>}
      </div>
      {open && (
        <div role="group" aria-label={t('sfilter.label')} className="chip-row sender-filter__chips">
          {everyone.map((p) => <Chip key={p.id} pressed={picked.includes(p.id)} onToggle={() => toggle(p.id)}>{p.name}</Chip>)}
        </div>
      )}
      {picked.length > 0 && <p className="muted" role="status">{t('sfilter.note', { names: everyone.filter((p) => picked.includes(p.id)).map((p) => p.name).join(', ') })}</p>}
    </div>
  )
}

/** The button in an open group that shows the same members dialog as the icon on the group's card. */
export function MembersButton({ chat, shipTime }: { chat: { id: string; name: string }; shipTime: (at: number) => string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="button-row"><Button variant="secondary" icon={Users} onClick={() => setOpen(true)}>{t('gmem.title')}</Button></div>
      {open && <GroupMembers chat={chat} shipTime={shipTime} onClose={() => setOpen(false)} onGreet={requestGreeting} />}
    </>
  )
}

/** One row of the list: who, the last line, an urgency word, the mute and closed tags, and the unread count. */
/** The numbers on a card: when it was started and by whom, how many are in it, and when each side last wrote. */
export function ChatStats({ c, shipTime }: { c: ChatConversation; shipTime: (at: number) => string }) {
  const messages = c.messageCount ?? 0
  const stanley = isStanleyChat(c)
  // How the newest message you wrote has travelled: reached, then read (read only where both sides share receipts).
  const travelled = !stanley && c.lastMineTo ? (c.lastMineSeen ? t('conv.stat.seen', { seen: c.lastMineSeen, count: c.lastMineTo }) : c.lastMineDelivered ? t('conv.stat.delivered', { delivered: c.lastMineDelivered, count: c.lastMineTo }) : t('conv.stat.sent')) : null
  const rows = (stanley ? [
    [c.startedAt ? t('conv.stat.started', { time: shipTime(c.startedAt) }) : null],
    [t('conv.stat.messages', { count: messages }), c.waitingAck ? t('conv.stat.waiting', { count: c.waitingAck }) : t('conv.stat.allConfirmed')],
  ] : [
    [c.startedAt ? (c.ownerName && !c.permanent ? t('conv.stat.startedBy', { time: shipTime(c.startedAt), name: c.ownerName }) : t('conv.stat.started', { time: shipTime(c.startedAt) })) : null, t('conv.stat.people', { count: c.members.length + 1 })],
    [c.lastMineAt ? t('conv.stat.mine', { time: shipTime(c.lastMineAt) }) : t('conv.stat.mineNever'), c.lastTheirsAt ? t('conv.stat.theirs', { time: shipTime(c.lastTheirsAt) }) : t('conv.stat.theirsNever')],
    [t('conv.stat.messagesMine', { count: messages, mine: c.mineCount ?? 0 }), c.photoCount ? t('conv.stat.photos', { count: c.photoCount }) : null, travelled, c.pinCount ? t('conv.stat.pinned', { count: c.pinCount }) : null],
    [c.dayCount ? t('conv.stat.day', { count: c.dayCount }) : t('conv.stat.quiet'), c.topName && c.members.length > 1 ? t('conv.stat.top', { name: c.topName, count: c.topCount ?? 0 }) : null, c.waitingInvites ? t('conv.stat.invites', { count: c.waitingInvites }) : null],
    [c.members.length > 0 ? t('conv.stat.online', { online: 1 + (c.onlineOthers ?? 0), total: c.members.length + 1 }) : null, c.avgReplySeconds !== undefined && messages >= 4 ? t('conv.stat.reply', { time: replyTime(c.avgReplySeconds) }) : null, c.busyHour !== undefined && messages >= 8 ? t('conv.stat.busy', { time: shipTime(Date.UTC(2000, 0, 1, c.busyHour)).replace(/:00\b/, '') }) : null],
    [c.mentionsYou ? t('conv.stat.mentions', { count: c.mentionsYou }) : null, c.unread > 0 ? t('conv.stat.unread', { count: c.unread }) : null],
  ]).map((r) => r.filter(Boolean).join(' · ')).filter(Boolean)
  return <span className="conv__stats muted">{rows.map((r) => <span key={r} className="conv__stat-line">{r}</span>)}</span>
}

export function ConversationItem({ c, urgentIds, onOpen, onManage, onDelete, onLeave, shipTime, now, keptDay }: { c: ChatConversation; urgentIds: readonly string[]; onOpen: (id: string) => void; onManage: (c: ChatConversation) => void; onDelete: (c: ChatConversation) => void; onLeave: (c: ChatConversation) => void; shipTime: (at: number) => string; now: number; keptDay: number | null }) {
  const typingIn = useTypingConversations()
  const [members, setMembers] = useState(false)
  const typers = [...typingIn].find(([hex]) => isSameConversation(c.id, hex))?.[1] ?? []
  // The leader of a group edits or deletes it; everyone else in a group or a personal chat can leave it (unless it has already ended for them).
  const canLeave = !c.owner && !c.closed && !c.permanent && (c.kind === 'group' || c.kind === 'direct')
  const level: ChatUrgency = urgentIds.includes(c.id) ? 'urgent' : urgencyOf(c.last) === 'important' && c.unread > 0 && !c.last?.mine ? 'important' : 'normal'
  const muted = isMuted(c, now)
  const tags = [muted && (c.mutedUntil ? t('conv.mutedUntil', { time: shipTime(c.mutedUntil) }) : t('conv.muted')), c.closed && t('conv.closed'), keptDay !== null && t('keep.tag', { date: keepDate(keptDay) })].filter(Boolean)
  return (
    <li className="conv-item">
      <button type="button" className={[c.unread > 0 ? 'conv conv--unread' : 'conv', level !== 'normal' && `conv--${level}`, (c.owner || canLeave || c.kind === 'group') && 'conv--tools'].filter(Boolean).join(' ')} onClick={() => onOpen(c.id)}>
        {isStanleyChat(c)
          ? <img className="conv__avatar conv__avatar--stanley" src={stanleyPicture} alt="" width="44" height="44" />
          : c.ownerName ? <ChatAvatar avatar={c.ownerAvatar} name={c.ownerName} /> : <ChatAvatar avatar={c.avatar} name={c.name} />}
        <span className="conv__body">
          <span className="conv__top">
            <strong>{c.name}</strong>
            {(c.owner || c.leader) && <span className="tag tag--good">{t('cgroup.status.leader')}</span>}
            {c.last && <span className="muted conv__time">{shipTime(c.last.at)}</span>}
          </span>
          {level !== 'normal' && <UrgencyTag level={level} />}
          {typers.length > 0
            ? <span className="conv__last conv__typing" role="status"><span className="chat-typing__dots chat-typing__dots--small" aria-hidden="true"><i /><i /><i /></span><span className="muted">{typingText(typers)}</span></span>
            : <span className="conv__last muted">{lastLine(c, t('conv.you'), t('conv.photo')) || '\u00a0'}</span>}
          {tags.length > 0 && <span className="conv__tags muted">{tags.join(' · ')}</span>}
          {!c.room && <ChatStats c={c} shipTime={shipTime} />}
        </span>
        {c.unread > 0 && (
          <span className="conv__unread">
            <span aria-hidden="true">{c.unread}</span>
            <span className="visually-hidden">{t('conv.unread', { count: c.unread })}</span>
          </span>
        )}
      </button>
      {(canLeave || c.owner || c.kind === 'group') && (
        <span className="conv__tools" role="group" aria-label={t('conv.tools.label', { name: c.name })}>
          {c.kind === 'group' && <button type="button" className="conv__tool" onClick={() => setMembers(true)} aria-label={t('conv.tool.members', { name: c.name })} title={t('conv.tool.members', { name: c.name })}><Users aria-hidden="true" /></button>}
          {c.owner && <>
            <button type="button" className="conv__tool" onClick={() => onManage(c)} aria-label={t('conv.tool.edit', { name: c.name })} title={t('conv.tool.edit', { name: c.name })}><Pencil aria-hidden="true" /></button>
            <button type="button" className="conv__tool conv__tool--danger" onClick={() => onDelete(c)} aria-label={t('conv.tool.delete', { name: c.name })} title={t('conv.tool.delete', { name: c.name })}><Trash2 aria-hidden="true" /></button>
          </>}
          {canLeave && <button type="button" className="conv__tool conv__tool--danger" onClick={() => onLeave(c)} aria-label={t('conv.tool.leave', { name: c.name })} title={t('conv.tool.leave', { name: c.name })}><Depart aria-hidden="true" /></button>}
        </span>
      )}
      {members && <GroupMembers chat={c} shipTime={shipTime} onClose={() => setMembers(false)} onGreet={(name) => { onOpen(c.id); requestGreeting(name) }} />}
    </li>
  )
}

/** The level as an icon and a word, never colour alone. */
/** One-tap do not disturb: an hour or until morning, shown clearly while on, and it ends by itself. Urgent messages still come through, and the screen says so. */
export function DoNotDisturb() {
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

export function UrgencyTag({ level }: { level: Exclude<ChatUrgency, 'normal'> }) {
  const Icon = level === 'urgent' ? OctagonAlert : TriangleAlert
  return <span className={`urgency-tag urgency-tag--${level}`}><Icon aria-hidden="true" /> <span>{t(level === 'urgent' ? 'urgent.label' : 'important.label')}</span></span>
}

/** One conversation: the latest 30 messages, older ones on request, a composer that never blocks typing, and live arrival that does not move what the guest is reading. */
/** Shown for the moment a thread the guest had open is deleted or they are removed from it: it clears the copy kept on this device, tells the list, and sends them to the Chat page with a notice. */
export function GoneFromChat({ id, owner, onBack }: { id: string; owner: string; onBack: () => void }) {
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
