import { Check, Depart, Trash2, Users, X } from '../icons'
import { useState } from 'react'
import type { ChatConnection, ChatConnections, ChatGroup, ChatGroupInvite, ChatPerson } from '../../api/chatTypes'
import { canCreateGroup, cleanGroupName, groupProblem, invitable, MAX_GROUP_NAME, togglePicked } from '../../domain/chatGroups'
import { cleanQuery } from '../../domain/chatConnections'
import { chatChanged, useChatLive } from '../../hooks/useChatSummary'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { t, type StringKey, headingCase } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Chip } from '../Chip'
import { Dialog } from '../Dialog'
import { useShipTime } from './shipTime'
import { DialogHeader } from '../DialogHeader'
import { Field } from '../Field'
import { ActionError, Load } from '../account/parts'
import type { ApiError } from '../../api/errors'
import { ChatAvatar } from './ChatLooks'

/** Words for a group action that failed, or nothing when the error is not one we have a sentence for. */
function Problem({ error }: { error: ApiError | null }) {
  if (!error) return null
  const why = groupProblem(error.code, error.message)
  return why === 'other' ? <ActionError error={error} /> : <p role="alert" className="field__error">{t(`cgroup.problem.${why}` as StringKey)}</p>
}

/** Everyone the guest can invite to a group: people they are chatting with now, and people who once accepted a request from them (and have not blocked them). */
const everyone = (c: ChatConnections | null | undefined): ChatConnection[] => c ? [...c.connected, ...(c.previous ?? [])] : []

/** The people the guest is connected with, as checkboxes to pick from. Each box is a native checkbox with the person's name as its label. */
function PickPeople({ people, picked, onToggle, legend }: { people: readonly { personId: string; name: string; avatar?: string }[]; picked: readonly string[]; onToggle: (id: string) => void; legend: string }) {
  if (people.length === 0) return <p className="muted">{t('cgroup.nobody')}</p>
  return (
    <fieldset className="plain-fieldset">
      <legend>{legend}</legend>
      {people.map((p) => (
        <label key={p.personId} className="choice">
          <input type="checkbox" checked={picked.includes(p.personId)} onChange={() => onToggle(p.personId)} />
          <span className="person-line"><ChatAvatar avatar={p.avatar} name={p.name} small /><span>{p.name}</span></span>
        </label>
      ))}
    </fieldset>
  )
}

/**
 * The New Chat Group page: a name, any of the people the guest already chats with, and anyone found by searching (an exact last name or email), all in one go.
 * The group is made as soon as it has a name and at least one person, picked or found. Everyone is asked to join and sees only what is said after they do.
 */
export function NewGroupPage({ onCreated }: { onCreated: (group: ChatGroup) => void }) {
  const connections = useMine(() => api.chatConnections.list())
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [found, setFound] = useState<ChatPerson[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ChatPerson[]>([])
  const [nobody, setNobody] = useState(false)
  const [searchError, setSearchError] = useState('')
  const search = useAction(async () => {
    const clean = cleanQuery(query)
    if (!clean) { setSearchError(t('people.searchHint')); return }
    setSearchError('')
    // Each search adds to what is already shown, so several people can be found one after another and invited together.
    const got = await api.chatConnections.search(clean)
    setNobody(got.length === 0)
    setResults((old) => [...got, ...old.filter((o) => !got.some((g) => g.id === o.id))])
    setQuery('')
  })
  const total = picked.length + found.length
  const create = useAction(async () => {
    const clean = cleanGroupName(name)
    if (!clean) return
    const group = await api.chatGroups.create(clean, picked, found.map((p) => p.id))
    chatChanged()
    onCreated(group)
  })
  const connected = new Set(everyone(connections.data).map((c) => c.personId))
  // Everyone chosen for the group, whether already a contact or just found: all of them get the invitation when the group is made.
  const chosen: ChatPerson[] = [
    ...everyone(connections.data).filter((c) => picked.includes(c.personId)).map((c) => ({ id: c.personId, name: c.name, relation: 'connected' as const, avatar: c.avatar })),
    ...found,
  ]
  const drop = (id: string) => { setPicked((x) => x.filter((p) => p !== id)); setFound((x) => x.filter((f) => f.id !== id)) }
  const addable = results.filter((p) => !found.some((f) => f.id === p.id))
  const add = (p: ChatPerson) => {
    if (connected.has(p.id)) setPicked((x) => (x.includes(p.id) ? x : [...x, p.id]))
    else setFound((x) => [...x, p])
  }
  return (
    <section aria-labelledby="new-group-h" data-tour="chat-newgroup">
      <h2 id="new-group-h" className="visually-hidden">{t('cgroup.new')}</h2>
      <form onSubmit={(e) => { e.preventDefault(); if (canCreateGroup(name, total)) void create.run() }}>
        <Card>
          <Field label={t('cgroup.name')} value={name} maxLength={MAX_GROUP_NAME} autoComplete="off" onChange={(e) => setName(e.target.value)} />
        </Card>
        <Card labelledBy="new-group-people-h">
          <h3 id="new-group-people-h">{headingCase(t('cgroup.pick'))}</h3>
          <Load state={connections}>
            {(c) => everyone(c).length === 0
              ? <p className="muted">{t('cgroup.nobody')}</p>
              : <PickPeople people={everyone(c)} picked={picked} onToggle={(id) => setPicked((p) => togglePicked(p, id))} legend={t('cgroup.pickLegend')} />}
          </Load>
        </Card>
        <Card labelledBy="new-group-find-h">
          <h3 id="new-group-find-h">{headingCase(t('cgroup.findTitle'))}</h3>
          <p className="muted">{t('cgroup.findBody')}</p>
          <Field label={t('people.search')} value={query} maxLength={254} autoComplete="off" error={searchError || undefined} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search.run() } }} />
          <Button type="button" variant="secondary" disabled={search.busy} onClick={() => void search.run()}>{t('cgroup.findGo')}</Button>
          <ActionError error={search.error} />
          {nobody && <p className="muted find-note">{t('cgroup.findNone')}</p>}
          {addable.length > 0 && (
            <ul className="plain-list">
              {addable.map((p) => (
                <li key={p.id}>
                  <span className="person-line"><ChatAvatar avatar={p.avatar} name={p.name} small /><strong>{p.name}</strong></span>
                  <Button type="button" variant="secondary" onClick={() => add(p)}>{t('cgroup.findAdd')}<span className="visually-hidden"> {p.name}</span></Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card labelledBy="new-group-chosen-h">
          <h3 id="new-group-chosen-h">{headingCase(t('cgroup.chosenTitle'))}</h3>
          {chosen.length === 0 ? <p className="muted">{t('cgroup.chosenNone')}</p> : (
            <ul className="plain-list">
              {chosen.map((p) => (
                <li key={p.id}>
                  <span className="person-line"><ChatAvatar avatar={p.avatar} name={p.name} small /><strong>{p.name}</strong> <span className="muted">{t('cgroup.status.pending')}</span></span>
                  <Button type="button" variant="secondary" icon={Trash2} onClick={() => drop(p.id)}>{t('cgroup.findDrop')}<span className="visually-hidden"> {p.name}</span></Button>
                </li>
              ))}
            </ul>
          )}
          <p className="muted">{t('cgroup.chosenNote')}</p>
        </Card>
        <p role="status" className="muted">{t('cgroup.picked', { count: total })}</p>
        <Problem error={create.error} />
        <Button type="submit" disabled={create.busy || !canCreateGroup(name, total)}>{t('cgroup.make')}</Button>
      </form>
    </section>
  )
}

/**
 * Leaving a chat from its card on the main chat page: a member who is not the leader leaves a group (the others stay and see a line that they left), and either person leaves a personal
 * chat, which removes it for both. Asks once, in words that say what happens. (The leader of a group cannot leave: they delete it, which sends everyone out.)
 */
export function LeaveChat({ chat, onClose, onLeft }: { chat: { id: string; kind: string; name: string }; onClose: () => void; onLeft: () => void }) {
  const personal = chat.kind === 'direct'
  const leave = useAction(async () => {
    if (personal) {
      // A personal chat belongs to the connection between the two people, found by its conversation.
      const list = await api.chatConnections.list()
      const connection = list.connected.find((c) => c.conversationId === chat.id)
      if (!connection) throw new Error('notFound')
      await api.chatConnections.end(connection.id)
    } else {
      await api.chatGroups.leave(chat.id)
    }
    chatChanged()
    onLeft()
  })
  return (
    <Dialog title={t('conv.leave.title')} onClose={onClose} header={(titleId) => <DialogHeader titleId={titleId} title={t('conv.leave.title')} subtext={chat.name} icon={Depart} onClose={onClose} />}>
      <p>{t(personal ? 'cpersonal.leave.body' : 'conv.leave.body', { name: chat.name })}</p>
      {leave.error && <p role="alert" className="field__error">{t('conv.leave.failed')}</p>}
      <div className="button-row">
        <Button disabled={leave.busy} onClick={() => void leave.run().catch(() => undefined)}>{t('conv.leave.yes')}</Button>
        <Button variant="secondary" onClick={onClose}>{t('conv.leave.no')}</Button>
      </div>
    </Dialog>
  )
}

/** Who is in a chat group: each person with their avatar, role, when they joined, how much they have written and when they last used the app. */
export function GroupMembers({ chat, shipTime, onClose, onGreet }: { chat: { id: string; name: string }; shipTime: (at: number) => string; onClose: () => void; /** Tapping another member's picture: the dialog closes and the chat opens with "Hey @Name, " in its message box. */ onGreet?: (name: string) => void }) {
  const group = useMine(() => api.chatGroups.get(chat.id), [chat.id])
  return (
    <Dialog title={t('gmem.title')} onClose={onClose} header={(titleId) => <DialogHeader titleId={titleId} title={t('gmem.title')} subtext={chat.name} icon={Users} onClose={onClose} />}>
      <Load state={group}>
        {(g) => (
          <>
            <p className="muted">{t('gmem.count', { count: g.members.length })}</p>
            <ul className="gmem" aria-label={t('gmem.title')}>
              {g.members.map((m) => (
                <li key={m.id} className="gmem__row">
                  {m.you || !onGreet
                    ? <ChatAvatar avatar={m.avatar} name={m.name} />
                    : <button type="button" className="greet-face gmem__face" aria-label={t('chat.greet', { name: m.name })} onClick={() => { onClose(); onGreet(m.name) }}><ChatAvatar avatar={m.avatar} name={m.name} /></button>}
                  <div className="gmem__body">
                    <p className="gmem__name"><strong>{m.you ? t('gmem.you', { name: m.name }) : m.name}</strong>{m.creator ? <span className="tag tag--good">{t('cgroup.status.leader')}</span> : m.admin ? <span className="tag">{t('gmem.admin')}</span> : null}</p>
                    <p className="muted gmem__line">{m.lastMessageAt ? t('gmem.lastMessage', { time: shipTime(m.lastMessageAt) }) : t('gmem.noMessages')}{m.messages ? ` · ${t('gmem.messages', { count: m.messages })}` : ''}</p>
                    <p className="muted gmem__line">{m.lastActiveAt ? t('gmem.lastActive', { time: shipTime(m.lastActiveAt) }) : t('gmem.neverActive')}{m.joinedAt ? ` · ${t('gmem.joined', { time: shipTime(m.joinedAt) })}` : ''}</p>
                  </div>
                </li>
              ))}
            </ul>
            {g.waiting.length > 0 && (
              <>
                <h3 className="gmem__sub">{t('gmem.waiting')}</h3>
                <ul className="gmem">
                  {g.waiting.map((w) => (
                    <li key={w.inviteId} className="gmem__row"><ChatAvatar avatar={w.avatar} name={w.name} /><div className="gmem__body"><p className="gmem__name"><strong>{w.name}</strong></p><p className="muted gmem__line">{t(w.needsGuardian ? 'gmem.needsGuardian' : 'gmem.invited')}</p></div></li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </Load>
    </Dialog>
  )
}

/** Deleting a whole chat for everyone, by the guest who started it. The others are told at once and it leaves their lists. */
export function DeleteChat({ chat, onClose, onDeleted }: { chat: { id: string; kind: string; name: string }; onClose: () => void; onDeleted: () => void }) {
  const remove = useAction(async () => {
    await api.chatGroups.delete(chat.id)
    onDeleted()
  })
  return (
    <Dialog title={t('conv.delete.title')} onClose={onClose} header={(titleId) => <DialogHeader titleId={titleId} title={t('conv.delete.title')} subtext={chat.name} icon={Trash2} onClose={onClose} />}>
      <p>{t('conv.delete.body', { name: chat.name })}</p>
      {remove.error && <p role="alert" className="field__error">{t('conv.delete.failed')}</p>}
      <div className="button-row">
        <Button disabled={remove.busy} onClick={() => void remove.run().catch(() => undefined)}>{t('conv.delete.yes')}</Button>
        <Button variant="secondary" onClick={onClose}>{t('conv.delete.no')}</Button>
      </div>
    </Dialog>
  )
}

/** A group on a page of its own: who is in, and what the guest can do: leave, and for the creator rename, invite, remove and delete. */
export function GroupPage({ id, onLeft, onChanged }: { id: string; onLeft: () => void; onChanged: () => void }) {
  const group = useMine(() => api.chatGroups.get(id), [id])
  const connections = useMine(() => api.chatConnections.list())
  useChatLive(() => { group.retry(); connections.retry() })
  const [leaving, setLeaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [name, setName] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [note, setNote] = useState('')
  const done = (text: string) => { setNote(text); group.retry(); onChanged(); chatChanged() }
  const rename = useAction(async () => { const clean = cleanGroupName(name ?? ''); if (clean) { await api.chatGroups.rename(id, clean); setName(null); done(t('cgroup.renamed')) } })
  const invite = useAction(async (found: string[]) => { const count = picked.length + found.length; await api.chatGroups.invite(id, picked, found); setPicked([]); done(t('cgroup.invited', { count })) })
  const remove = useAction(async (personId: string, who: string) => { await api.chatGroups.remove(id, personId); done(t('cgroup.removed', { name: who })) })
  const revoke = useAction(async (inviteId: string, who: string) => { await api.chatGroups.revokeInvite(id, inviteId); done(t('cgroup.revoked', { name: who })) })
  const leave = useAction(async () => { await api.chatGroups.leave(id); chatChanged(); onLeft() })
  const announce = useAction(async (on: boolean) => { await api.chatGroups.setAnnouncementOnly(id, on); done(t(on ? 'cgroup.announce.nowOn' : 'cgroup.announce.nowOff')) })
  return (
    <section aria-labelledby="grp-page-h">
      <h2 id="grp-page-h"><span className="person-line"><Users aria-hidden="true" /> {group.data?.name ?? t('cgroup.details')}</span></h2>
      <p role="status" className="visually-hidden">{note}</p>
      <Load state={group}>
        {(g) => (
          <>
            <h3>{headingCase(t('cgroup.members', { count: g.members.length }))}</h3>
            <ul className="plain-list">
              {g.members.map((m) => (
                <li key={m.id}>
                  <span className="person-line"><ChatAvatar avatar={m.avatar} name={m.name} small /><strong>{m.you ? t('conv.you') : m.name}</strong><> <span className="muted">{t(m.creator ? 'cgroup.status.leader' : 'cgroup.status.participant')}</span></></span>
                  {g.isCreator && !m.you && <Button variant="secondary" icon={Trash2} disabled={remove.busy} onClick={() => void remove.run(m.id, m.name)}>{t('cgroup.remove')}<span className="visually-hidden"> {m.name}</span></Button>}
                </li>
              ))}
            </ul>
            <Problem error={remove.error} />
            {g.isAdmin && (
              <>
                <Chip pressed={g.announcementOnly === true} onToggle={() => { if (!announce.busy) void announce.run(g.announcementOnly !== true) }}>{t('cgroup.announce')}</Chip>
                <p className="muted">{t(g.announcementOnly === true ? 'cgroup.announce.hintOn' : 'cgroup.announce.hintOff')}</p>
                {announce.error && <p role="alert" className="field__error">{t('cgroup.announce.failed')}</p>}
              </>
            )}
            {g.isCreator && g.waiting.length > 0 && (
              <Card labelledBy="grp-waiting-h">
                <h3 id="grp-waiting-h">{headingCase(t('cgroup.waiting'))}</h3>
                <ul className="plain-list">
                  {g.waiting.map((w) => (
                    <li key={w.inviteId}>
                      <span className="person-line"><ChatAvatar avatar={w.avatar} name={w.name} small /><span><strong>{w.name}</strong> <span className="muted">{t('cgroup.status.pending')}{w.needsGuardian ? ` (${t('cgroup.waitingGuardian')})` : ''}</span></span></span>
                      <Button variant="secondary" icon={Trash2} disabled={revoke.busy} onClick={() => void revoke.run(w.inviteId, w.name)}>{t('cgroup.revoke')}<span className="visually-hidden"> {w.name}</span></Button>
                    </li>
                  ))}
                </ul>
                <Problem error={revoke.error} />
              </Card>
            )}
            {g.isCreator && (
              <>
                <form onSubmit={(e) => { e.preventDefault(); void rename.run() }}>
                  <Field label={t('cgroup.rename')} value={name ?? g.name} maxLength={MAX_GROUP_NAME} autoComplete="off" onChange={(e) => setName(e.target.value)} />
                  <Button type="submit" disabled={rename.busy || cleanGroupName(name ?? '') === null || name === g.name}>{t('cgroup.renameSave')}</Button>
                </form>
                <Problem error={rename.error} />
                <AddPeople group={g} connections={connections} picked={picked} setPicked={setPicked} busy={invite.busy} onInvite={(found) => invite.run(found)} />
                <Problem error={invite.error} />
              </>
            )}
            <GroupFacts g={g} />
            <p className="muted">{t('cgroup.history')}</p>
            {!g.isCreator && <Button variant="secondary" onClick={() => setLeaving(true)}>{t('cgroup.leave')}</Button>}
            {g.isCreator && <Button variant="secondary" icon={Trash2} onClick={() => setDeleting(true)}>{t('cgroup.deleteChat')}</Button>}
            {deleting && <DeleteChat chat={{ id, kind: 'group', name: g.name }} onClose={() => setDeleting(false)} onDeleted={() => { setDeleting(false); onLeft() }} />}
            {leaving && (
              <Dialog title={t('cgroup.leaveTitle', { name: g.name })} onClose={() => setLeaving(false)} header={(titleId) => <DialogHeader titleId={titleId} title={t('cgroup.leaveTitle', { name: g.name })} icon={Users} onClose={() => setLeaving(false)} />}>
                <p>{t('cgroup.leaveBody')}</p>
                <div className="button-row">
                  <Button disabled={leave.busy} onClick={() => void leave.run()}>{t('cgroup.leaveYes')}</Button>
                  <Button variant="secondary" onClick={() => setLeaving(false)}>{t('cgroup.leaveNo')}</Button>
                </div>
                <ActionError error={leave.error} />
              </Dialog>
            )}
          </>
        )}
      </Load>
    </section>
  )
}

/** The group at a glance, for its management page: who started it and when, how many are in or invited, how much has been said and by whom, and who was last in the app. */
function GroupFacts({ g }: { g: ChatGroup }) {
  const shipTime = useShipTime()
  const leader = g.members.find((m) => m.creator)
  const total = g.members.reduce((n, m) => n + (m.messages ?? 0), 0)
  const top = g.members.filter((m) => (m.messages ?? 0) > 0).sort((a, b) => (b.messages ?? 0) - (a.messages ?? 0))[0]
  const lastWriter = g.members.filter((m) => m.lastMessageAt).sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))[0]
  const lastSeen = g.members.filter((m) => !m.you && m.lastActiveAt).sort((a, b) => (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0))[0]
  const lines = [
    [leader?.joinedAt ? t('gfact.started', { time: shipTime(leader.joinedAt), name: leader.you ? t('gfact.you') : leader.name }) : null, t('conv.stat.people', { count: g.members.length })],
    [g.waiting.length > 0 ? t('conv.stat.invites', { count: g.waiting.length }) : null, g.announcementOnly ? t('gfact.leaderOnly') : t('gfact.everyoneWrites')],
    [t('conv.stat.messages', { count: total }), top ? t('conv.stat.top', { name: top.you ? t('gfact.you') : top.name, count: top.messages ?? 0 }) : null],
    [lastWriter?.lastMessageAt ? t('gfact.lastWrote', { name: lastWriter.you ? t('gfact.you') : lastWriter.name, time: shipTime(lastWriter.lastMessageAt) }) : t('gfact.noMessages'), lastSeen?.lastActiveAt ? t('gfact.lastSeen', { name: lastSeen.name, time: shipTime(lastSeen.lastActiveAt) }) : null],
  ].map((r) => r.filter(Boolean).join(' · ')).filter(Boolean)
  return <p className="muted conv__stats">{lines.map((l) => <span key={l} className="conv__stat-line">{l}</span>)}</p>
}

function AddPeople({ group, connections, picked, setPicked, busy, onInvite }: {
  group: ChatGroup; connections: ReturnType<typeof useMine<ChatConnections>>; picked: string[]; setPicked: (p: string[]) => void; busy: boolean; onInvite: (found: string[]) => Promise<unknown>
}) {
  const people = invitable(everyone(connections.data), group)
  // Anyone not yet a contact is found by searching, as on the New Chat Group page, and invited together with the people ticked above.
  const [found, setFound] = useState<ChatPerson[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ChatPerson[]>([])
  const [nobody, setNobody] = useState(false)
  const [searchError, setSearchError] = useState('')
  const taken = new Set([...group.members.map((m) => m.id), ...group.waiting.map((w) => w.personId)])
  const search = useAction(async () => {
    const clean = cleanQuery(query)
    if (!clean) { setSearchError(t('people.searchHint')); return }
    setSearchError('')
    const got = (await api.chatConnections.search(clean)).filter((p) => !taken.has(p.id))
    setNobody(got.length === 0)
    setResults((old) => [...got, ...old.filter((o) => !got.some((g) => g.id === o.id))])
    setQuery('')
  })
  const addable = results.filter((p) => !found.some((f) => f.id === p.id) && !people.some((c) => c.personId === p.id))
  const total = picked.length + found.length
  return (
    <div>
      <PickPeople people={people} picked={picked} onToggle={(id) => setPicked(togglePicked(picked, id))} legend={t('cgroup.add')} />
      <h3 className="gmem__sub">{headingCase(t('cgroup.findTitle'))}</h3>
      <p className="muted">{t('cgroup.findBody')}</p>
      <Field label={t('people.search')} value={query} maxLength={254} autoComplete="off" error={searchError || undefined} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search.run() } }} />
      <div className="button-row"><Button type="button" variant="secondary" disabled={search.busy} onClick={() => void search.run()}>{t('cgroup.findGo')}</Button></div>
      <ActionError error={search.error} />
      {nobody && <p className="muted find-note">{t('cgroup.findNone')}</p>}
      {addable.length > 0 && (
        <ul className="plain-list">
          {addable.map((p) => (
            <li key={p.id}>
              <span className="person-line"><ChatAvatar avatar={p.avatar} name={p.name} small /><strong>{p.name}</strong></span>
              <Button type="button" variant="secondary" onClick={() => setFound((x) => [...x, p])}>{t('cgroup.findAdd')}<span className="visually-hidden"> {p.name}</span></Button>
            </li>
          ))}
        </ul>
      )}
      {found.length > 0 && (
        <ul className="plain-list">
          {found.map((p) => (
            <li key={p.id}>
              <span className="person-line"><ChatAvatar avatar={p.avatar} name={p.name} small /><strong>{p.name}</strong> <span className="muted">{t('cgroup.status.pending')}</span></span>
              <Button type="button" variant="secondary" icon={Trash2} onClick={() => setFound((x) => x.filter((f) => f.id !== p.id))}>{t('cgroup.findDrop')}<span className="visually-hidden"> {p.name}</span></Button>
            </li>
          ))}
        </ul>
      )}
      <div className="button-row group-add__send"><Button disabled={busy || total === 0} onClick={() => void onInvite(found.map((f) => f.id)).then(() => setFound([]), () => undefined)}>{t('cgroup.addSend')}</Button></div>
    </div>
  )
}

/** Group invitations waiting for the guest, and for their children. Joining shows nothing earlier than the moment they join. */
export function GroupInvites({ onDone }: { onDone: (note: string) => void }) {
  const invites = useMine(() => api.chatGroups.invites())
  useChatLive(invites.retry)
  const list = invites.data ?? []
  if (list.length === 0) return null
  return (
    <section aria-labelledby="group-invites-h">
      <h3 id="group-invites-h">{headingCase(t('cgroup.invites'))}</h3>
      <ul className="plain-list">
        {list.map((i) => <li key={i.id}><Card><Invite invite={i} onDone={(text) => { onDone(text); invites.retry() }} /></Card></li>)}
      </ul>
    </section>
  )
}

function Invite({ invite, onDone }: { invite: ChatGroupInvite; onDone: (note: string) => void }) {
  const child = invite.kind === 'approval'
  const answer = useAction(async (accept: boolean) => {
    await api.chatGroups.respond(invite.id, accept)
    chatChanged()
    onDone(accept ? t('cgroup.joined', { name: invite.groupName }) : t('people.answered'))
  })
  return (
    <>
      <h4 className="invite-card__title"><Users aria-hidden="true" /> {invite.groupName}</h4>
      <p className="person-line"><ChatAvatar avatar={invite.fromAvatar} name={invite.from} small /><span>{child ? t('cgroup.inviteChild', { child: invite.childName ?? '', from: invite.from }) : t('cgroup.invite', { from: invite.from })}</span></p>
      <p className="muted">{t(child ? 'cgroup.inviteChildBody' : 'cgroup.inviteBody')}</p>
      <div className="button-row">
        <Button icon={Check} disabled={answer.busy} onClick={() => void answer.run(true)}>{t(child ? 'people.allow' : 'cgroup.join')}<span className="visually-hidden"> {invite.groupName}</span></Button>
        <Button variant="secondary" icon={X} disabled={answer.busy} onClick={() => void answer.run(false)}>{t('people.decline')}<span className="visually-hidden"> {invite.groupName}</span></Button>
      </div>
      <Problem error={answer.error} />
    </>
  )
}
