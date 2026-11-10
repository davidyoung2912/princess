import { useState } from 'react'
import type { ChatConnections, ChatGroup, ChatGroupInvite } from '../../api/chatTypes'
import { canCreateGroup, cleanGroupName, groupProblem, invitable, MAX_GROUP_NAME, MIN_INVITED, placesLeft, togglePicked } from '../../domain/chatGroups'
import { chatChanged, useChatLive } from '../../hooks/useChatSummary'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Dialog } from '../Dialog'
import { Field } from '../Field'
import { ActionError, Load } from '../account/parts'
import type { ApiError } from '../../api/errors'

/** Words for a group action that failed, or nothing when the error is not one we have a sentence for. */
function Problem({ error }: { error: ApiError | null }) {
  if (!error) return null
  const why = groupProblem(error.code, error.message)
  return why === 'other' ? <ActionError error={error} /> : <p role="alert" className="field__error">{t(`cgroup.problem.${why}` as StringKey)}</p>
}

/** The people the guest is connected with, as checkboxes to pick from. Each box is a native checkbox with the person's name as its label. */
function PickPeople({ people, picked, onToggle, legend }: { people: readonly { personId: string; name: string }[]; picked: readonly string[]; onToggle: (id: string) => void; legend: string }) {
  if (people.length === 0) return <p className="muted">{t('cgroup.nobody')}</p>
  return (
    <fieldset className="plain-fieldset">
      <legend>{legend}</legend>
      {people.map((p) => (
        <label key={p.personId} className="choice">
          <input type="checkbox" checked={picked.includes(p.personId)} onChange={() => onToggle(p.personId)} />
          <span>{p.name}</span>
        </label>
      ))}
    </fieldset>
  )
}

/** Make a group from people the guest is already chatting with. Each person is asked to join; the group opens at once. */
export function NewGroup({ onClose, onCreated }: { onClose: () => void; onCreated: (group: ChatGroup) => void }) {
  const connections = useMine(() => api.chatConnections.list())
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const create = useAction(async () => {
    const clean = cleanGroupName(name)
    if (!clean) return
    const group = await api.chatGroups.create(clean, picked)
    chatChanged()
    onCreated(group)
  })
  return (
    <Dialog title={t('cgroup.new')} onClose={onClose}>
      <p className="muted">{t('cgroup.newBody', { min: MIN_INVITED })}</p>
      <form onSubmit={(e) => { e.preventDefault(); if (canCreateGroup(name, picked.length)) void create.run() }}>
        <Field label={t('cgroup.name')} value={name} maxLength={MAX_GROUP_NAME} autoComplete="off" onChange={(e) => setName(e.target.value)} />
        <Load state={connections}>
          {(c) => <PickPeople people={c.connected} picked={picked} onToggle={(id) => setPicked((p) => togglePicked(p, id))} legend={t('cgroup.pick')} />}
        </Load>
        <p role="status" className="muted">{t('cgroup.picked', { count: picked.length })}</p>
        <Problem error={create.error} />
        <Button type="submit" disabled={create.busy || !canCreateGroup(name, picked.length)}>{t('cgroup.make')}</Button>
      </form>
    </Dialog>
  )
}

/** The people, the limit, and what the guest can do: leave, and for the creator rename, add and remove. Opened from a group's thread. */
export function GroupDetails({ id, onClose, onLeft, onChanged }: { id: string; onClose: () => void; onLeft: () => void; onChanged: () => void }) {
  const group = useMine(() => api.chatGroups.get(id), [id])
  const connections = useMine(() => api.chatConnections.list())
  const [leaving, setLeaving] = useState(false)
  const [name, setName] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [note, setNote] = useState('')
  const done = (text: string) => { setNote(text); group.retry(); onChanged(); chatChanged() }
  const rename = useAction(async () => { const clean = cleanGroupName(name ?? ''); if (clean) { await api.chatGroups.rename(id, clean); setName(null); done(t('cgroup.renamed')) } })
  const invite = useAction(async () => { await api.chatGroups.invite(id, picked); setPicked([]); done(t('cgroup.invited', { count: picked.length })) })
  const remove = useAction(async (personId: string, who: string) => { await api.chatGroups.remove(id, personId); done(t('cgroup.removed', { name: who })) })
  const leave = useAction(async () => { await api.chatGroups.leave(id); chatChanged(); onLeft() })
  return (
    <Dialog title={group.data?.name ?? t('cgroup.details')} onClose={onClose}>
      <p role="status" className="visually-hidden">{note}</p>
      <Load state={group}>
        {(g) => (
          <>
            <h3>{t('cgroup.members', { count: g.members.length, max: g.max })}</h3>
            <ul className="plain-list">
              {g.members.map((m) => (
                <li key={m.id}>
                  <span><strong>{m.you ? t('conv.you') : m.name}</strong>{m.creator && <> <span className="muted">{t('cgroup.creator')}</span></>}</span>
                  {g.isCreator && !m.you && <Button variant="tertiary" disabled={remove.busy} onClick={() => void remove.run(m.id, m.name)}>{t('cgroup.remove')}<span className="visually-hidden"> {m.name}</span></Button>}
                </li>
              ))}
            </ul>
            <Problem error={remove.error} />
            {g.isCreator && g.waiting.length > 0 && (
              <>
                <h3>{t('cgroup.waiting')}</h3>
                <ul className="plain-list">
                  {g.waiting.map((w) => <li key={w.inviteId}><span>{w.name} <span className="muted">{t(w.needsGuardian ? 'cgroup.waitingGuardian' : 'cgroup.waitingReply')}</span></span></li>)}
                </ul>
              </>
            )}
            {g.isCreator && (
              <>
                <form onSubmit={(e) => { e.preventDefault(); void rename.run() }}>
                  <Field label={t('cgroup.rename')} value={name ?? g.name} maxLength={MAX_GROUP_NAME} autoComplete="off" onChange={(e) => setName(e.target.value)} />
                  <Button type="submit" variant="secondary" disabled={rename.busy || cleanGroupName(name ?? '') === null || name === g.name}>{t('cgroup.renameSave')}</Button>
                </form>
                <Problem error={rename.error} />
                <AddPeople group={g} connections={connections} picked={picked} setPicked={setPicked} busy={invite.busy} onInvite={() => void invite.run()} />
                <Problem error={invite.error} />
              </>
            )}
            <p className="muted">{t('cgroup.history')}</p>
            <Button variant="secondary" onClick={() => setLeaving(true)}>{t('cgroup.leave')}</Button>
            {leaving && (
              <Dialog title={t('cgroup.leaveTitle', { name: g.name })} onClose={() => setLeaving(false)}>
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
    </Dialog>
  )
}

function AddPeople({ group, connections, picked, setPicked, busy, onInvite }: {
  group: ChatGroup; connections: ReturnType<typeof useMine<ChatConnections>>; picked: string[]; setPicked: (p: string[]) => void; busy: boolean; onInvite: () => void
}) {
  const left = placesLeft(group)
  const people = invitable(connections.data?.connected ?? [], group)
  if (left === 0) return <p className="muted">{t('cgroup.full')}</p>
  return (
    <div>
      <PickPeople people={people} picked={picked} onToggle={(id) => setPicked(togglePicked(picked, id))} legend={t('cgroup.add', { count: left })} />
      {people.length > 0 && <Button variant="secondary" disabled={busy || picked.length === 0 || picked.length > left} onClick={onInvite}>{t('cgroup.addSend')}</Button>}
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
      <h3 id="group-invites-h">{t('cgroup.invites')}</h3>
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
      <p><strong>{child ? t('cgroup.inviteChild', { child: invite.childName ?? '', group: invite.groupName, from: invite.from }) : t('cgroup.invite', { from: invite.from, group: invite.groupName })}</strong></p>
      <p className="muted">{t(child ? 'cgroup.inviteChildBody' : 'cgroup.inviteBody')}</p>
      <div className="button-row">
        <Button disabled={answer.busy} onClick={() => void answer.run(true)}>{t(child ? 'people.allow' : 'cgroup.join')}<span className="visually-hidden"> {invite.groupName}</span></Button>
        <Button variant="secondary" disabled={answer.busy} onClick={() => void answer.run(false)}>{t('people.decline')}<span className="visually-hidden"> {invite.groupName}</span></Button>
      </div>
      <Problem error={answer.error} />
    </>
  )
}
