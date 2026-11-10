import { useState } from 'react'
import type { ApiError } from '../../api/errors'
import type { ChatRoomAdminItem, ChatRoomStaffAction } from '../../api/chatTypes'
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
  const [person, setPerson] = useState('')
  const act = useAction(async (body: ChatRoomStaffAction) => { await api.chatRoomsStaff.act(room.id, body); onChanged() })
  const rota = useAction(async (on: boolean) => {
    const personId = person.trim()
    if (!personId) return
    await api.chatRoomsStaff.act(room.id, { action: on ? 'moderator' : 'unmoderator', personId })
    setPerson('')
    onChanged()
  })
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
      {isRoom && (
        <form onSubmit={(e) => { e.preventDefault(); void rota.run(true) }}>
          <Field label={t('rs.moderator', { name: room.name })} hint={t('rs.moderatorHint')} value={person} autoComplete="off" onChange={(e) => setPerson(e.target.value)} />
          <div className="button-row">
            <Button type="submit" variant="secondary" disabled={rota.busy || !person.trim()}>{t('rs.moderatorAdd')}</Button>
            <Button variant="secondary" disabled={rota.busy || !person.trim()} onClick={() => void rota.run(false)}>{t('rs.moderatorRemove')}</Button>
          </div>
          <Problem error={rota.error} />
        </form>
      )}
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
