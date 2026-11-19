import { useId, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { ApiError } from '../../api/errors'
import type { Huddle, HuddleCardKind, HuddleLink } from '../../api/chatTypes'
import { cardFields, cardReady, daysUntil, HUDDLE_CARD_KINDS, HUDDLE_MAX_TITLE, huddleLink, huddleProblem, mayJoin, tokenFromHash } from '../../domain/chatHuddle'
import { cleanGroupName, MAX_GROUP_NAME } from '../../domain/chatGroups'
import { useAction } from '../../hooks/useAction'
import { chatChanged } from '../../hooks/useChatSummary'
import { useNow } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { DialogHeader } from '../DialogHeader'
import { Users } from '../icons'
import { Field } from '../Field'
import { ActionError, Load } from '../account/parts'

function Problem({ error }: { error: ApiError | null }) {
  if (!error) return null
  const why = huddleProblem(error.code, error.message)
  return why === 'other' ? <ActionError error={error} /> : <p role="alert" className="field__error">{t(`chuddle.problem.${why}` as StringKey)}</p>
}

/** Start a huddle from the chat list: a name, and nothing else. Nobody is contacted by the app; the guest shares the link themselves. */
export function StartHuddle() {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const start = useAction(async () => {
    const clean = cleanGroupName(name)
    if (!clean) return
    const h = await api.chatConversations.startHuddle(clean)
    chatChanged()
    setOpen(false)
    // Straight to the new chat with its invite open: the link is how people get in.
    void nav(`/chat/c/${encodeURIComponent(h.id)}?invite=1`)
  })
  return (
    <>
      <p><Button variant="secondary" onClick={() => setOpen(true)}>{t('chuddle.start')}</Button></p>
      {open && (
        <Dialog title={t('chuddle.start')} onClose={() => setOpen(false)} header={(titleId) => <DialogHeader titleId={titleId} title={t('chuddle.start')} subtext={t('chuddle.startBody')} icon={Users} onClose={() => setOpen(false)} />}>
          <form onSubmit={(e) => { e.preventDefault(); if (cleanGroupName(name)) void start.run().catch(() => undefined) }}>
            <Field label={t('chuddle.name')} value={name} maxLength={MAX_GROUP_NAME} autoComplete="off" onChange={(e) => setName(e.target.value)} />
            <Problem error={start.error} />
            <div className="button-row">
              <Button type="submit" disabled={!cleanGroupName(name) || start.busy}>{t('chuddle.startGo')}</Button>
              <Button type="button" variant="tertiary" onClick={() => setOpen(false)}>{t('chuddle.cancel')}</Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  )
}

/** The invite: make a link, share or copy it, revoke or replace it. The token is shown once; the screen says who can see what. */
function InviteLink({ huddle, set }: { huddle: Huddle; set: (h: Huddle) => void }) {
  const [link, setLink] = useState<HuddleLink | null>(null)
  const now = useNow()
  const [note, setNote] = useState('')
  const make = useAction(async () => { setLink(await api.chatConversations.huddleLink(huddle.id)); set(await api.chatConversations.huddle(huddle.id)); setNote('') })
  const revoke = useAction(async () => { await api.chatConversations.revokeHuddleLink(huddle.id); setLink(null); set(await api.chatConversations.huddle(huddle.id)) })
  const url = link ? huddleLink(window.location.origin, link.token) : ''
  const copy = async () => { try { await navigator.clipboard.writeText(url); setNote(t('chuddle.copied')) } catch { setNote(t('chuddle.copyFailed')) } }
  const share = async () => { try { await navigator.share({ title: huddle.name, text: t('chuddle.shareText'), url }) } catch { /* the guest closed the sheet: nothing to report */ } }
  const until = link?.expiresAt ?? huddle.linkUntil
  return (
    <section aria-labelledby="hud-invite-h">
      <h3 id="hud-invite-h">{t('chuddle.invite')}</h3>
      <p className="muted">{t('chuddle.inviteBody', { max: huddle.max })}</p>
      {huddle.seatsLeft === 0 ? <p>{t('chuddle.full')}</p> : (
        <div className="button-row">
          <Button variant="secondary" disabled={make.busy} onClick={() => void make.run().catch(() => undefined)}>{until ? t('chuddle.refresh') : t('chuddle.makeLink')}</Button>
          {until !== undefined && <Button variant="tertiary" disabled={revoke.busy} onClick={() => void revoke.run().catch(() => undefined)}>{t('chuddle.revoke')}</Button>}
        </div>
      )}
      <Problem error={make.error ?? revoke.error} />
      {until !== undefined && <p className="muted">{t('chuddle.linkUntil', { days: daysUntil(until, now) })}</p>}
      {link && (
        <>
          <label htmlFor="hud-link">{t('chuddle.linkLabel')}</label>
          <input id="hud-link" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
          <div className="button-row">
            {typeof navigator.share === 'function' && <Button onClick={() => void share()}>{t('chuddle.share')}</Button>}
            <Button variant="secondary" onClick={() => void copy()}>{t('chuddle.copy')}</Button>
          </div>
          <p className="muted">{t('chuddle.shownOnce')}</p>
        </>
      )}
      <p role="status">{note}</p>
    </section>
  )
}

function Shortlist({ huddle, set }: { huddle: Huddle; set: (h: Huddle) => void }) {
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<HuddleCardKind>('sailing')
  const [title, setTitle] = useState('')
  const [rows, setRows] = useState([{ label: '', value: '' }, { label: '', value: '' }])
  const kindId = useId()
  const add = useAction(async () => {
    set(await api.chatConversations.addHuddleCard(huddle.id, { kind, title: title.trim(), fields: cardFields(rows), asOf: Date.now() }))
    setAdding(false); setTitle(''); setRows([{ label: '', value: '' }, { label: '', value: '' }])
  })
  const remove = useAction(async (cardId: string) => { set(await api.chatConversations.removeHuddleCard(huddle.id, cardId)) })
  return (
    <section aria-labelledby="hud-list-h">
      <h3 id="hud-list-h">{t('chuddle.shortlist')}</h3>
      <p className="muted">{t('chuddle.shortlistBody')}</p>
      {huddle.shortlist.length === 0 ? <p>{t('chuddle.noCards')}</p> : (
        <ul className="plain-list">
          {huddle.shortlist.map((c) => (
            <li key={c.id} className="recap-part">
              <p><strong>{c.title}</strong> <span className="muted">({t(`chuddle.kind.${c.kind}` as StringKey)})</span></p>
              {Object.entries(c.fields).length > 0 && <dl>{Object.entries(c.fields).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
              <p className="muted">{t('chuddle.asOf', { when: new Date(c.asOf).toLocaleString() })}</p>
              {(c.mine || huddle.isCreator) && <Button variant="tertiary" disabled={remove.busy} onClick={() => void remove.run(c.id).catch(() => undefined)}>{t('chuddle.removeCard', { title: c.title })}</Button>}
            </li>
          ))}
        </ul>
      )}
      <Problem error={remove.error} />
      {!adding ? <div className="button-row"><Button variant="secondary" onClick={() => setAdding(true)}>{t('chuddle.addCard')}</Button></div> : (
        <form onSubmit={(e) => { e.preventDefault(); if (cardReady(kind, title)) void add.run().catch(() => undefined) }}>
          <label htmlFor={kindId}>{t('chuddle.cardKind')}</label>
          <select id={kindId} value={kind} onChange={(e) => setKind(e.target.value as HuddleCardKind)}>
            {HUDDLE_CARD_KINDS.map((k) => <option key={k} value={k}>{t(`chuddle.kind.${k}` as StringKey)}</option>)}
          </select>
          <Field label={t('chuddle.cardTitle')} value={title} maxLength={HUDDLE_MAX_TITLE} autoComplete="off" onChange={(e) => setTitle(e.target.value)} />
          <p className="muted">{t('chuddle.cardFieldsBody')}</p>
          {rows.map((r, i) => (
            <div key={i} className="button-row">
              <Field label={t('chuddle.fieldLabel', { n: i + 1 })} value={r.label} maxLength={40} autoComplete="off" onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <Field label={t('chuddle.fieldValue', { n: i + 1 })} value={r.value} maxLength={140} autoComplete="off" onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            </div>
          ))}
          <Problem error={add.error} />
          <div className="button-row">
            <Button type="submit" disabled={!cardReady(kind, title) || add.busy}>{t('chuddle.addGo')}</Button>
            <Button type="button" variant="tertiary" onClick={() => setAdding(false)}>{t('chuddle.cancel')}</Button>
          </div>
        </form>
      )}
    </section>
  )
}

/** After booking: say OK to carry the history, and the booker makes this the party chat. Counts only; nobody is named. */
function WhenBooked({ huddle, set }: { huddle: Huddle; set: (h: Huddle) => void }) {
  const [done, setDone] = useState<{ moved: number; stayed: number; carried: boolean } | null>(null)
  const nav = useNavigate()
  const carry = useAction(async (agree: boolean) => { set(await api.chatConversations.setHuddleCarry(huddle.id, agree)) })
  const convert = useAction(async () => {
    const r = await api.chatConversations.convertHuddle(huddle.id)
    chatChanged()
    setDone({ moved: r.moved, stayed: r.stayed, carried: r.historyCarried })
    return r
  })
  if (done) {
    return (
      <section aria-labelledby="hud-booked-h">
        <h3 id="hud-booked-h">{t('chuddle.booked')}</h3>
        <p role="status">{t('chuddle.converted', { moved: done.moved, stayed: done.stayed })} {done.carried ? t('chuddle.carried') : t('chuddle.notCarried')}</p>
        <div className="button-row"><Button onClick={() => { void nav('/chat') }}>{t('chuddle.toChat')}</Button></div>
      </section>
    )
  }
  return (
    <section aria-labelledby="hud-booked-h">
      <h3 id="hud-booked-h">{t('chuddle.booked')}</h3>
      <p className="muted">{t('chuddle.bookedBody')}</p>
      <label className="choice">
        <input type="checkbox" checked={huddle.carry} disabled={carry.busy} onChange={(e) => void carry.run(e.target.checked).catch(() => undefined)} />
        <span>{t('chuddle.carryOk')}</span>
      </label>
      <p className="muted">{t('chuddle.carryBody')}</p>
      <div className="button-row"><Button variant="secondary" disabled={convert.busy} onClick={() => void convert.run().catch(() => undefined)}>{t('chuddle.convert')}</Button></div>
      <Problem error={carry.error ?? convert.error} />
    </section>
  )
}

/** Everything about one huddle in a dialog: who is in, the invite, the shortlist, what happens after booking, when it is deleted, and leaving. */
export function HuddleDetails({ id, onClose, onLeft }: { id: string; onClose: () => void; onLeft: () => void }) {
  const state = useMine(() => api.chatConversations.huddle(id), [id])
  const [current, setCurrent] = useState<Huddle | null>(null)
  const leave = useAction(async () => { await api.chatConversations.leaveHuddle(id); chatChanged(); onLeft() })
  const removeMember = useAction(async (personId: string) => { await api.chatConversations.removeHuddleMember(id, personId); setCurrent(await api.chatConversations.huddle(id)); chatChanged() })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteChat = useAction(async () => { await api.chatConversations.deleteHuddle(id); chatChanged(); onLeft() })
  return (
    <Dialog title={t('chuddle.details')} onClose={onClose} header={(titleId) => <DialogHeader titleId={titleId} title={(current ?? state.data)?.name ?? t('chuddle.details')} subtext={t('chuddle.details')} icon={Users} onClose={onClose} />}>
      <Load state={state}>
        {(loaded) => {
          const h = current ?? loaded
          return (
            <>
              <h3>{h.name}</h3>
              <p className="muted">{t('chuddle.who', { count: h.members.length, max: h.max })}</p>
              <ul className="plain-list">{h.members.map((m) => (
                <li key={m.id}>
                  {m.you ? t('chuddle.you', { name: m.name }) : m.name}
                  {h.isCreator && !m.you && <Button variant="secondary" disabled={removeMember.busy} onClick={() => void removeMember.run(m.id).catch(() => undefined)}>{t('chuddle.remove')}<span className="visually-hidden"> {m.name}</span></Button>}
                </li>
              ))}</ul>
              <Problem error={removeMember.error} />
              <p className="muted">{t('chuddle.privacy')}</p>
              {h.isCreator && <InviteLink huddle={h} set={setCurrent} />}
              <Shortlist huddle={h} set={setCurrent} />
              <WhenBooked huddle={h} set={setCurrent} />
              <p className={h.warn ? 'field__error' : 'muted'} role={h.warn ? 'alert' : undefined}>{t(h.warn ? 'chuddle.deleteSoon' : 'chuddle.deleteOn', { date: new Date(h.deleteOn).toLocaleDateString() })}</p>
              <Problem error={leave.error} />
              {confirmDelete && (
                <Dialog title={t('conv.delete.title')} onClose={() => setConfirmDelete(false)} header={(titleId) => <DialogHeader titleId={titleId} title={t('conv.delete.title')} subtext={h.name} icon={Users} onClose={() => setConfirmDelete(false)} />}>
                  <p>{t('conv.delete.body', { name: h.name })}</p>
                  <Problem error={deleteChat.error} />
                  <div className="button-row">
                    <Button disabled={deleteChat.busy} onClick={() => void deleteChat.run().catch(() => undefined)}>{t('conv.delete.yes')}</Button>
                    <Button variant="secondary" onClick={() => setConfirmDelete(false)}>{t('conv.delete.no')}</Button>
                  </div>
                </Dialog>
              )}
              <div className="button-row">
                <Button variant="tertiary" disabled={leave.busy} onClick={() => void leave.run().catch(() => undefined)}>{t('chuddle.leave')}</Button>
                {h.isCreator && <Button variant="secondary" onClick={() => setConfirmDelete(true)}>{t('chuddle.deleteChat')}</Button>}
                <Button onClick={onClose}>{t('chuddle.close')}</Button>
              </div>
            </>
          )
        }}
      </Load>
    </Dialog>
  )
}

/**
 * The join screen for an invite link (`/chat#huddle=…`). A signed-in guest sees who is in, and nothing else, then says they are 18 or over and joins. A link that is wrong, old or revoked all read the same.
 */
export function HuddleJoin() {
  const token = tokenFromHash(useLocation().hash)
  return token ? <JoinDialog token={token} /> : null
}

function JoinDialog({ token }: { token: string }) {
  const nav = useNavigate()
  const [dismissed, setDismissed] = useState(false)
  const [adult, setAdult] = useState(false)
  const preview = useMine(() => api.chatConversations.previewHuddle(token), [token])
  const join = useAction(async () => {
    const id = await api.chatConversations.joinHuddle(token)
    chatChanged()
    void nav(`/chat/c/${encodeURIComponent(id)}`, { replace: true })
  })
  if (dismissed) return null
  const close = () => { setDismissed(true); void nav('/chat', { replace: true }) }
  return (
    <Dialog title={t('chuddle.joinTitle')} onClose={close} header={(titleId) => <DialogHeader titleId={titleId} title={t('chuddle.joinTitle')} subtext={t('chuddle.joinBody')} icon={Users} onClose={close} />}>
      {preview.status === 'error' ? <Problem error={(preview.error as ApiError | undefined) ?? null} /> : (
        <Load state={preview}>
          {(p) => (
            <>
              <ul className="plain-list">{p.members.map((m, i) => <li key={i}>{m}</li>)}</ul>
              <p className="muted">{t('chuddle.seats', { count: p.seatsLeft })}</p>
              <p className="muted">{t('chuddle.joinPrivacy')}</p>
              <label className="choice">
                <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
                <span>{t('chuddle.adult')}</span>
              </label>
              <Problem error={join.error} />
              <div className="button-row">
                <Button disabled={!mayJoin(adult, p.seatsLeft) || join.busy} onClick={() => void join.run().catch(() => undefined)}>{t('chuddle.join')}</Button>
                <Button variant="tertiary" onClick={close}>{t('chuddle.notNow')}</Button>
              </div>
            </>
          )}
        </Load>
      )}
    </Dialog>
  )
}
