import { useState } from 'react'
import type { ApiError } from '../../api/errors'
import type { ChatRoomAdminItem, ChatRoomModerator, ChatRoomMute, ChatRoomPerson, ChatRoomPost, ChatRoomStaffAction } from '../../api/chatTypes'
import { canOpenRoom, checkNewRoom, MIN_MODERATORS, staffOrder, staffProblem } from '../../domain/chatRooms'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Dialog } from '../Dialog'
import { Field, TextArea } from '../Field'
import { ActionError, Load } from './parts'

const when = (epoch: number): string => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(epoch)

function Problem({ error }: { error: ApiError | null }) {
  if (!error) return null
  const why = staffProblem(error.code, error.message)
  return why === 'other' ? <ActionError error={error} /> : <p role="alert" className="field__error">{t(`rs.problem.${why}` as StringKey)}</p>
}

/** For administrators: channels and rooms, the posts held for a look, suggested questions and the weekly counts (docs/chat-features-research.md, phase 8). Never shows a guest's live conversation. */
export function RoomsStaffCard() {
  const [creating, setCreating] = useState(false)
  const rooms = useMine(() => api.chatRoomsStaff.list())
  return (
    <Card>
      <h2>{t('rs.title')}</h2>
      <p className="muted">{t('rs.body')}</p>
      <Summary />
      <h3>{t('rs.rooms')}</h3>
      <Load state={rooms}>
        {(items) => (items.length === 0 ? <p>{t('rs.none')}</p> : (
          <ul className="plain-list">{staffOrder(items).map((r) => <li key={r.id}><RoomRow room={r} onChanged={rooms.retry} /></li>)}</ul>
        ))}
      </Load>
      <p><Button variant="secondary" onClick={() => setCreating(true)}>{t('rs.create')}</Button></p>
      {creating && <CreateRoom onClose={() => setCreating(false)} onCreated={() => { setCreating(false); rooms.retry() }} />}
      <Held />
      <Questions />
    </Card>
  )
}

function Summary() {
  const s = useMine(() => api.chatRoomsStaff.summary(7))
  return (
    <section aria-labelledby="rs-summary-h">
      <h3 id="rs-summary-h">{t('rs.summary')}</h3>
      <Load state={s}>
        {(d) => (
          <>
            <p>{t('rs.summary.line', { days: d.days, reports: d.reports, held: d.held })}</p>
            {d.noModerator.length > 0 && (
              <>
                <p role="status"><strong>{t('rs.summary.gaps')}</strong></p>
                <ul className="plain-bullets">{d.noModerator.map((g) => <li key={g.id}>{t('rs.summary.gap', { name: g.name, count: g.moderators })}</li>)}</ul>
              </>
            )}
            {d.busiest.length > 0 && <ul className="plain-bullets">{d.busiest.map((b) => <li key={b.id}>{t('rs.summary.busy', { name: b.name, count: b.posts })}</li>)}</ul>}
            {d.actions.length > 0 && <p className="muted">{d.actions.map((a) => `${a.action} ${a.count}`).join(' · ')}</p>}
          </>
        )}
      </Load>
    </section>
  )
}

function RoomRow({ room, onChanged }: { room: ChatRoomAdminItem; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [rules, setRules] = useState(room.rules)
  const [looking, setLooking] = useState<'rota' | 'posts' | 'people' | null>(null)
  const act = useAction(async (body: ChatRoomStaffAction) => { await api.chatRoomsStaff.act(room.id, body); onChanged() })
  const isRoom = room.kind === 'room'
  const state = room.closed ? t('rs.state.closed') : t('rs.state.open')
  return (
    <Card>
      <p><strong>{room.name}</strong> <span className="muted">· {t(room.kind === 'channel' ? 'rs.kind.channel' : room.roomKind === 'sailing' ? 'rs.kind.sailing' : 'rs.kind.interest')} · {state}</span></p>
      <p className="muted">{t('room.members', { count: room.members })} · {t('rs.cap', { count: room.cap })}{isRoom ? ` · ${t('rs.rota', { count: room.moderators })}` : ''}{room.slow ? ` · ${t('rs.slowOn')}` : ''}{isRoom && !room.inHours ? ` · ${t('rs.offHours')}` : ''}</p>
      {isRoom && !room.closed && room.moderators < MIN_MODERATORS && <p role="status">{t('rs.needRota')}</p>}
      <div className="button-row">
        {isRoom && room.closed && <Button disabled={act.busy || !canOpenRoom(room)} onClick={() => void act.run({ action: 'open' })}>{t('rs.open')}<span className="visually-hidden"> {room.name}</span></Button>}
        {isRoom && !room.closed && <Button variant="secondary" disabled={act.busy} onClick={() => void act.run({ action: 'close' })}>{t('rs.close')}<span className="visually-hidden"> {room.name}</span></Button>}
        {isRoom && <Button variant="secondary" disabled={act.busy} aria-pressed={room.slow} onClick={() => void act.run({ action: 'slow', on: !room.slow })}>{t(room.slow ? 'rs.slowOff' : 'rs.slowTurnOn')}<span className="visually-hidden"> {room.name}</span></Button>}
        <Button variant="secondary" onClick={() => setEditing(true)}>{t('rs.rules')}<span className="visually-hidden"> {room.name}</span></Button>
      </div>
      <Problem error={act.error} />
      <div className="button-row">
        {isRoom && <Button variant="secondary" onClick={() => setLooking('rota')}>{t('rs.rota.open')}<span className="visually-hidden"> {room.name}</span></Button>}
        <Button variant="secondary" onClick={() => setLooking('posts')}>{t('rs.posts.open')}<span className="visually-hidden"> {room.name}</span></Button>
        {isRoom && <Button variant="secondary" onClick={() => setLooking('people')}>{t('rs.people.open')}<span className="visually-hidden"> {room.name}</span></Button>}
      </div>
      {looking === 'rota' && <RotaDialog room={room} onClose={() => setLooking(null)} onChanged={onChanged} />}
      {looking === 'posts' && <PostsDialog room={room} onClose={() => setLooking(null)} />}
      {looking === 'people' && <PeopleDialog room={room} onClose={() => setLooking(null)} onChanged={onChanged} />}
      {editing && (
        <Dialog title={t('rs.rulesTitle', { name: room.name })} onClose={() => setEditing(false)}>
          <TextArea label={t('rs.rules')} value={rules} rows={6} maxLength={1000} onChange={(e) => setRules(e.target.value)} />
          <p className="muted">{t('rs.rulesBody')}</p>
          <Problem error={act.error} />
          <div className="button-row">
            <Button disabled={act.busy || !rules.trim()} onClick={() => void act.run({ action: 'rules', rules }).then((r) => { if (r !== undefined) setEditing(false) })}>{t('rs.rulesSave')}</Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>{t('rs.cancel')}</Button>
          </div>
        </Dialog>
      )}
    </Card>
  )
}

function CreateRoom({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [kind, setKind] = useState<'channel' | 'room'>('channel')
  const [roomKind, setRoomKind] = useState<'sailing' | 'interest'>('interest')
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [sailingId, setSailingId] = useState('')
  const [bad, setBad] = useState<'name' | 'topic' | 'sailing' | null>(null)
  const create = useAction(async () => {
    const checked = checkNewRoom({ kind, roomKind, name, topic, sailingId })
    if (!checked.ok) { setBad(checked.field); return }
    setBad(null)
    await api.chatRoomsStaff.create(checked.body)
    onCreated()
  })
  const err = (f: 'name' | 'topic' | 'sailing') => (bad === f ? t(`rs.problem.${f}` as StringKey) : undefined)
  return (
    <Dialog title={t('rs.create')} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); void create.run() }}>
        <fieldset>
          <legend>{t('rs.kind')}</legend>
          <label><input type="radio" name="rs-kind" checked={kind === 'channel'} onChange={() => setKind('channel')} /> {t('rs.kind.channel')}</label>
          <label><input type="radio" name="rs-kind" checked={kind === 'room'} onChange={() => setKind('room')} /> {t('rs.kind.room')}</label>
        </fieldset>
        {kind === 'room' && (
          <fieldset>
            <legend>{t('rs.roomKind')}</legend>
            <label><input type="radio" name="rs-room-kind" checked={roomKind === 'interest'} onChange={() => setRoomKind('interest')} /> {t('rs.kind.interest')}</label>
            <label><input type="radio" name="rs-room-kind" checked={roomKind === 'sailing'} onChange={() => setRoomKind('sailing')} /> {t('rs.kind.sailing')}</label>
          </fieldset>
        )}
        <Field label={t('rs.name')} value={name} maxLength={60} error={err('name')} onChange={(e) => setName(e.target.value)} />
        {(kind === 'channel' || roomKind === 'interest') && <Field label={t(kind === 'channel' ? 'rs.topicOptional' : 'rs.topic')} value={topic} maxLength={80} error={err('topic')} onChange={(e) => setTopic(e.target.value)} />}
        {kind === 'room' && roomKind === 'sailing' && <Field label={t('rs.sailing')} hint={t('rs.sailingHint')} value={sailingId} error={err('sailing')} onChange={(e) => setSailingId(e.target.value)} />}
        <p className="muted">{t(kind === 'channel' ? 'rs.channelNote' : 'rs.roomNote')}</p>
        <Problem error={create.error} />
        <div className="button-row">
          <Button type="submit" disabled={create.busy}>{t('rs.createGo')}</Button>
          <Button variant="secondary" onClick={onClose}>{t('rs.cancel')}</Button>
        </div>
      </form>
    </Dialog>
  )
}

function Held() {
  const held = useMine(() => api.chatRoomsStaff.held())
  const decide = useAction(async (id: string, decision: 'release' | 'reject') => { await api.chatRoomsStaff.decideHeld(id, decision); held.retry() })
  return (
    <section aria-labelledby="rs-held-h">
      <h3 id="rs-held-h">{t('rs.held')}</h3>
      <p className="muted">{t('rs.heldBody')}</p>
      <Load state={held}>
        {(items) => (items.length === 0 ? <p>{t('rs.heldNone')}</p> : (
          <ul className="plain-list">
            {items.map((h) => (
              <li key={h.id}>
                <p className="muted">{t('rs.heldFrom', { who: h.from, room: h.roomName, when: when(h.at) })} · {h.reason}</p>
                <blockquote>{h.text}</blockquote>
                <div className="button-row">
                  <Button disabled={decide.busy} onClick={() => void decide.run(h.id, 'release')}>{t('rs.release')}</Button>
                  <Button variant="secondary" disabled={decide.busy} onClick={() => void decide.run(h.id, 'reject')}>{t('rs.reject')}</Button>
                </div>
              </li>
            ))}
          </ul>
        ))}
      </Load>
      <Problem error={decide.error} />
    </section>
  )
}

function Questions() {
  const qs = useMine(() => api.chatRoomsStaff.questions())
  const decide = useAction(async (id: string, decision: 'popular' | 'reject') => { await api.chatRoomsStaff.decideQuestion(id, decision); qs.retry() })
  return (
    <section aria-labelledby="rs-q-h">
      <h3 id="rs-q-h">{t('rs.questions')}</h3>
      <p className="muted">{t('rs.questionsBody')}</p>
      <Load state={qs}>
        {(items) => (items.length === 0 ? <p>{t('rs.questionsNone')}</p> : (
          <ul className="plain-list">
            {items.map((q) => (
              <li key={q.id}>
                <p>{q.text}</p>
                <p className="muted">{q.roomName} · {when(q.at)}</p>
                <div className="button-row">
                  <Button disabled={decide.busy} onClick={() => void decide.run(q.id, 'popular')}>{t('rs.popular')}</Button>
                  <Button variant="secondary" disabled={decide.busy} onClick={() => void decide.run(q.id, 'reject')}>{t('rs.reject')}</Button>
                </div>
              </li>
            ))}
          </ul>
        ))}
      </Load>
      <Problem error={decide.error} />
    </section>
  )
}

/** Who is on the room's rota: tick a staff member to name or remove them. A room opens with two named. */
function RotaDialog({ room, onClose, onChanged }: { room: ChatRoomAdminItem; onClose: () => void; onChanged: () => void }) {
  const list = useMine(() => api.chatRoomsStaff.rota(room.id), [room.id])
  const set = useAction(async (m: ChatRoomModerator) => { await api.chatRoomsStaff.act(room.id, { action: m.named ? 'unmoderator' : 'moderator', personId: m.id }); list.retry(); onChanged() })
  return (
    <Dialog title={t('rs.rota.title', { name: room.name })} onClose={onClose}>
      <p className="muted">{t('rs.rota.body')}</p>
      <Load state={list}>
        {(items) => (items.length === 0 ? <p>{t('rs.rota.none')}</p> : (
          <ul className="plain-list">
            {items.map((m) => (
              <li key={m.id}>
                <label><input type="checkbox" checked={m.named} disabled={set.busy} onChange={() => void set.run(m)} /> {m.name}</label>
              </li>
            ))}
          </ul>
        ))}
      </Load>
      <Problem error={set.error} />
      <Button variant="secondary" onClick={onClose}>{t('rs.done')}</Button>
    </Dialog>
  )
}

/** The latest posts, to remove or pin. Removing asks first: it takes the post away for everyone. */
function PostsDialog({ room, onClose }: { room: ChatRoomAdminItem; onClose: () => void }) {
  const list = useMine(() => api.chatRoomsStaff.posts(room.id), [room.id])
  const [removing, setRemoving] = useState<ChatRoomPost | null>(null)
  const act = useAction(async (p: ChatRoomPost, action: 'remove' | 'pin') => { await api.chatRoomsStaff.message(room.id, p.id, action); setRemoving(null); list.retry() })
  return (
    <Dialog title={t('rs.posts.title', { name: room.name })} onClose={onClose}>
      <p className="muted">{t('rs.posts.body')}</p>
      <Load state={list}>
        {(items) => (items.length === 0 ? <p>{t('rs.posts.none')}</p> : (
          <ul className="plain-list">
            {items.map((p) => (
              <li key={p.id}>
                <p className="muted">{p.from} · {when(p.at)}{p.pinned ? ` · ${t('rs.posts.pinned')}` : ''}</p>
                <blockquote>{p.text}</blockquote>
                <div className="button-row">
                  {room.kind === 'room' && !p.pinned && <Button variant="secondary" disabled={act.busy} onClick={() => void act.run(p, 'pin')}>{t('rs.posts.pin')}</Button>}
                  <Button variant="secondary" disabled={act.busy} onClick={() => setRemoving(p)}>{t('rs.posts.remove')}</Button>
                </div>
              </li>
            ))}
          </ul>
        ))}
      </Load>
      <Problem error={act.error} />
      {removing && (
        <Dialog title={t('rs.posts.removeTitle')} onClose={() => setRemoving(null)}>
          <p>{t('rs.posts.removeBody', { who: removing.from })}</p>
          <blockquote>{removing.text}</blockquote>
          <div className="button-row">
            <Button disabled={act.busy} onClick={() => void act.run(removing, 'remove')}>{t('rs.posts.removeYes')}</Button>
            <Button variant="secondary" onClick={() => setRemoving(null)}>{t('rs.cancel')}</Button>
          </div>
        </Dialog>
      )}
      <Button variant="secondary" onClick={onClose}>{t('rs.done')}</Button>
    </Dialog>
  )
}

/** The room's people, to mute for an hour, a day or the room, to lift a mute, or to remove for good (asks first). */
function PeopleDialog({ room, onClose, onChanged }: { room: ChatRoomAdminItem; onClose: () => void; onChanged: () => void }) {
  const list = useMine(() => api.chatRoomsStaff.people(room.id), [room.id])
  const [removing, setRemoving] = useState<ChatRoomPerson | null>(null)
  const act = useAction(async (p: ChatRoomPerson, action: 'mute' | 'unmute' | 'remove', mute?: ChatRoomMute) => { await api.chatRoomsStaff.person(room.id, p.id, action, mute); setRemoving(null); list.retry(); onChanged() })
  return (
    <Dialog title={t('rs.people.title', { name: room.name })} onClose={onClose}>
      <p className="muted">{t('rs.people.body')}</p>
      <Load state={list}>
        {(items) => (items.length === 0 ? <p>{t('rs.people.none')}</p> : (
          <ul className="plain-list">
            {items.map((p) => (
              <li key={p.id}>
                <p><strong>{p.name}</strong>{p.muted && p.mutedUntil ? <span className="muted"> · {t('rs.people.mutedUntil', { when: when(p.mutedUntil) })}</span> : null}</p>
                <div className="button-row">
                  {p.muted
                    ? <Button variant="secondary" disabled={act.busy} onClick={() => void act.run(p, 'unmute')}>{t('rs.people.unmute')}<span className="visually-hidden"> {p.name}</span></Button>
                    : (['hour', 'day', 'room'] as const).map((m) => <Button key={m} variant="secondary" disabled={act.busy} onClick={() => void act.run(p, 'mute', m)}>{t(`rs.people.mute.${m}` as StringKey)}<span className="visually-hidden"> {p.name}</span></Button>)}
                  <Button variant="secondary" disabled={act.busy} onClick={() => setRemoving(p)}>{t('rs.people.remove')}<span className="visually-hidden"> {p.name}</span></Button>
                </div>
              </li>
            ))}
          </ul>
        ))}
      </Load>
      <Problem error={act.error} />
      {removing && (
        <Dialog title={t('rs.people.removeTitle', { who: removing.name })} onClose={() => setRemoving(null)}>
          <p>{t('rs.people.removeBody')}</p>
          <div className="button-row">
            <Button disabled={act.busy} onClick={() => void act.run(removing, 'remove')}>{t('rs.people.removeYes')}</Button>
            <Button variant="secondary" onClick={() => setRemoving(null)}>{t('rs.cancel')}</Button>
          </div>
        </Dialog>
      )}
      <Button variant="secondary" onClick={onClose}>{t('rs.done')}</Button>
    </Dialog>
  )
}
