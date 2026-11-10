import { useState } from 'react'
import type { ApiError } from '../../api/errors'
import type { ChatConversation, ChatRoomListItem } from '../../api/chatTypes'
import { canJoinRoom, cleanQuestion, groupRooms, MAX_QUESTION, roomProblem } from '../../domain/chatRooms'
import { chatChanged, useChatLive } from '../../hooks/useChatSummary'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Dialog } from '../Dialog'
import { TextArea } from '../Field'
import { ActionError, Load } from '../account/parts'
import { useShipTime } from './shipTime'

/** Words for a join or suggestion that failed, or the general error when there is no sentence for it. */
function Problem({ error }: { error: ApiError | null }) {
  if (!error) return null
  const why = roomProblem(error.code, error.message)
  return why === 'other' ? <ActionError error={error} /> : <p role="alert" className="field__error">{t(`room.problem.${why}` as StringKey)}</p>
}

/** The directory of channels and rooms: channels the ship's staff post to, rooms for a sailing, and rooms for an interest. Joining is quiet (muted) until the guest turns alerts on. */
export function Rooms({ onOpen }: { onOpen: (id: string) => void }) {
  const list = useMine(() => api.chatRooms.list())
  useChatLive(list.retry)
  const [previewing, setPreviewing] = useState<ChatRoomListItem | null>(null)
  return (
    <section aria-labelledby="rooms-h">
      <h2 id="rooms-h">{t('room.title')}</h2>
      <p className="muted">{t('room.intro')}</p>
      <Load state={list}>
        {(items) => {
          const g = groupRooms(items)
          if (items.length === 0) return <p>{t('room.none')}</p>
          return (
            <>
              <RoomSection id="rooms-channels" title={t('room.channels')} note={t('room.channelsBody')} items={g.channels} onOpen={onOpen} onPreview={setPreviewing} />
              <RoomSection id="rooms-sailing" title={t('room.sailing')} note={t('room.sailingBody')} items={g.sailing} onOpen={onOpen} onPreview={setPreviewing} />
              <RoomSection id="rooms-interest" title={t('room.interest')} note={t('room.interestBody')} items={g.interest} onOpen={onOpen} onPreview={setPreviewing} />
            </>
          )
        }}
      </Load>
      {previewing && <RoomPreview item={previewing} onClose={() => setPreviewing(null)} onJoined={(id) => { setPreviewing(null); list.retry(); onOpen(id) }} />}
    </section>
  )
}

function RoomSection({ id, title, note, items, onOpen, onPreview }: { id: string; title: string; note: string; items: ChatRoomListItem[]; onOpen: (id: string) => void; onPreview: (r: ChatRoomListItem) => void }) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`}>{title}</h3>
      <p className="muted">{note}</p>
      <ul className="plain-list">
        {items.map((r) => (
          <li key={r.id}>
            <Card>
              <p><strong>{r.name}</strong>{r.topic && <> <span className="muted">· {r.topic}</span></>}</p>
              <p className="muted">{t('room.members', { count: r.members })}{r.closed ? ` · ${t('room.closed')}` : ''}{r.blocked && !r.joined ? ` · ${t(`room.blocked.${r.blocked}` as StringKey)}` : ''}</p>
              <div className="button-row">
                {r.joined
                  ? <Button onClick={() => onOpen(r.id)}>{t('room.open')}<span className="visually-hidden"> {r.name}</span></Button>
                  : <Button variant="secondary" onClick={() => onPreview(r)}>{t(r.kind === 'channel' ? 'room.look.channel' : 'room.look')}<span className="visually-hidden"> {r.name}</span></Button>}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** What a guest may read before joining: the rules, what staff pinned, and the popular questions. Never a guest's own post. */
function RoomPreview({ item, onClose, onJoined }: { item: ChatRoomListItem; onClose: () => void; onJoined: (id: string) => void }) {
  const preview = useMine(() => api.chatRooms.preview(item.id), [item.id])
  const shipTime = useShipTime()
  const [question, setQuestion] = useState('')
  const [sent, setSent] = useState(false)
  const join = useAction(async () => { await api.chatRooms.join(item.id); chatChanged(); onJoined(item.id) })
  const suggest = useAction(async () => {
    const clean = cleanQuestion(question)
    if (!clean) return
    await api.chatRooms.suggestQuestion(item.id, clean)
    setQuestion('')
    setSent(true)
  })
  const channel = item.kind === 'channel'
  return (
    <Dialog title={item.name} onClose={onClose}>
      <Load state={preview}>
        {(p) => (
          <>
            <h3>{t('room.rules')}</h3>
            <p>{p.rules}</p>
            {p.lines.length > 0 && (
              <>
                <h3>{t(channel ? 'room.latest' : 'room.pinned')}</h3>
                <ul className="plain-list">
                  {p.lines.map((l) => <li key={`${l.at}-${l.text}`}><p>{l.text}</p><p className="muted">{shipTime(l.at)}</p></li>)}
                </ul>
              </>
            )}
            {p.questions.length > 0 && (
              <>
                <h3>{t('room.popular')}</h3>
                <ul className="plain-bullets">{p.questions.map((q) => <li key={q}>{q}</li>)}</ul>
              </>
            )}
            {!channel && (
              <form onSubmit={(e) => { e.preventDefault(); if (cleanQuestion(question)) void suggest.run() }}>
                <TextArea label={t('room.suggest')} value={question} rows={2} maxLength={MAX_QUESTION} autoComplete="off" onChange={(e) => { setQuestion(e.target.value); setSent(false) }} />
                <p className="muted">{t('room.suggestBody')}</p>
                <Problem error={suggest.error} />
                {sent && <p role="status">{t('room.suggested')}</p>}
                <Button type="submit" variant="secondary" disabled={suggest.busy || cleanQuestion(question) === null}>{t('room.suggestSend')}</Button>
              </form>
            )}
            <p className="muted">{t(channel ? 'room.followBody' : 'room.joinBody')}</p>
            <Problem error={join.error} />
            <div className="button-row">
              <Button disabled={join.busy || !canJoinRoom(item)} onClick={() => void join.run()}>{t(channel ? 'room.follow' : 'room.join')}<span className="visually-hidden"> {item.name}</span></Button>
              <Button variant="secondary" onClick={onClose}>{t('room.notNow')}</Button>
            </div>
          </>
        )}
      </Load>
    </Dialog>
  )
}

/** The rules, asked for on a guest's first post. Saying yes lets the post go; no keeps the words in the box. */
export function RulesDialog({ conversation, onAccepted, onClose }: { conversation: ChatConversation; onAccepted: () => void; onClose: () => void }) {
  const accept = useAction(async () => { await api.chatRooms.acceptRules(conversation.id); onAccepted() })
  return (
    <Dialog title={t('room.rulesTitle', { name: conversation.name })} onClose={onClose}>
      <p>{conversation.room?.rules}</p>
      <p className="muted">{t('room.rulesBody')}</p>
      <ActionError error={accept.error} />
      <div className="button-row">
        <Button disabled={accept.busy} onClick={() => void accept.run()}>{t('room.rulesYes')}</Button>
        <Button variant="secondary" onClick={onClose}>{t('room.rulesNo')}</Button>
      </div>
    </Dialog>
  )
}

/** The room's rules and the way out. Members are never listed. */
export function RoomDetails({ conversation, onClose, onLeft }: { conversation: ChatConversation; onClose: () => void; onLeft: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const leave = useAction(async () => { await api.chatRooms.leave(conversation.id); chatChanged(); onLeft() })
  const room = conversation.room
  const channel = conversation.kind === 'channel'
  return (
    <Dialog title={conversation.name} onClose={onClose}>
      {room?.topic && <p className="muted">{room.topic}</p>}
      <p>{t('room.members', { count: room?.members ?? 0 })}</p>
      <h3>{t('room.rules')}</h3>
      <p>{room?.rules}</p>
      <p className="muted">{t('room.history')}</p>
      <Button variant="secondary" onClick={() => setLeaving(true)}>{t(channel ? 'room.unfollow' : 'room.leave')}</Button>
      {leaving && (
        <Dialog title={t(channel ? 'room.unfollowTitle' : 'room.leaveTitle', { name: conversation.name })} onClose={() => setLeaving(false)}>
          <p>{t(channel ? 'room.unfollowBody' : 'room.leaveBody')}</p>
          <div className="button-row">
            <Button disabled={leave.busy} onClick={() => void leave.run()}>{t(channel ? 'room.unfollowYes' : 'room.leaveYes')}</Button>
            <Button variant="secondary" onClick={() => setLeaving(false)}>{t('room.leaveNo')}</Button>
          </div>
          <ActionError error={leave.error} />
        </Dialog>
      )}
    </Dialog>
  )
}
