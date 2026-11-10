import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { ChatConnection, ChatPerson, ChatSettings, ChatSms } from '../../api/chatTypes'
import { needsPhone, smsReason } from '../../domain/chatSms'
import { cleanQuery, hasActivity, personAction, relationNote, requestProblem, waitingCount } from '../../domain/chatConnections'
import { chatChanged, useChatLive } from '../../hooks/useChatSummary'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { optimistic } from '../../data/optimistic'
import { api } from '../../runtime'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Chip } from '../Chip'
import { Dialog } from '../Dialog'
import { Field } from '../Field'
import { ActionError, Load } from '../account/parts'
import { GroupInvites } from './ChatGroups'
import type { ApiError } from '../../api/errors'

/** The banner at the top of Chat: "2 people want to chat", one tap to the People area. */
export function RequestsBanner({ onOpen }: { onOpen: () => void }) {
  const list = useMine(() => api.chatConnections.list())
  const invites = useMine(() => api.chatGroups.invites())
  useChatLive(() => { list.retry(); invites.retry() })
  const count = (list.data ? waitingCount(list.data) : 0) + (invites.data?.length ?? 0)
  if (count === 0) return null
  return <Banner kind="info" title={t('people.banner', { count })} action={<Button variant="secondary" onClick={onOpen}>{t('people.bannerOpen')}</Button>} />
}

/** People (docs/chat-plan.md, 4.8): chat targets, requests waiting, requests sent, guardian approvals, and a single New chat button. */
export function People() {
  const list = useMine(() => api.chatConnections.list())
  const settings = useMine(() => api.chatConnections.settings())
  useChatLive(list.retry)
  const [searching, setSearching] = useState(false)
  const [note, setNote] = useState('')
  const refresh = () => { list.retry(); chatChanged() }
  // The answers are on screen, so the sender has seen them: clear the badge once the list has loaded.
  const answered = list.data ? list.data.answers.length + list.data.connected.filter((c) => c.isNew).length : 0
  useEffect(() => { if (answered > 0) void api.chatConnections.seen().then(chatChanged, () => undefined) }, [answered])
  return (
    <section aria-labelledby="people-h">
      <h2 id="people-h">{th('people.title')}</h2>
      <p className="muted">{t('people.body')}</p>
      <Button onClick={() => setSearching(true)}>{t('people.new')}</Button>
      <p role="status" className="visually-hidden">{note}</p>
      {searching && <Search onClose={() => setSearching(false)} onDone={(text) => { setNote(text); refresh() }} />}
      <GroupInvites onDone={(text) => { setNote(text); refresh() }} />
      <Load state={list}>
        {(c) => (
          <>
            {!hasActivity(c) && <p>{t('people.none')}</p>}
            {c.approvals.length > 0 && <Group id="approvals" rows={c.approvals} render={(r) => <Approval row={r} onDone={(text) => { setNote(text); refresh() }} />} />}
            {c.incoming.length > 0 && <Group id="incoming" rows={c.incoming} render={(r) => <Incoming row={r} onDone={(text) => { setNote(text); refresh() }} />} />}
            {c.outgoing.length > 0 && <Group id="outgoing" rows={c.outgoing} render={(r) => <Outgoing row={r} onDone={(text) => { setNote(text); refresh() }} />} />}
            {c.answers.length > 0 && <Group id="answers" rows={c.answers} render={(r) => <p>{t('people.declined', { name: r.name })}</p>} />}
            {c.connected.length > 0 && <Group id="connected" rows={c.connected} render={(r) => <Connected row={r} onDone={(text) => { setNote(text); refresh() }} />} />}
          </>
        )}
      </Load>
      <TextBridge />
      <Settings state={settings} onHidden={() => { setNote(t('people.hidden')); refresh() }} />
    </section>
  )
}

function Group({ id, rows, render }: { id: 'approvals' | 'incoming' | 'outgoing' | 'answers' | 'connected'; rows: readonly ChatConnection[]; render: (row: ChatConnection) => React.ReactNode }) {
  return (
    <section aria-labelledby={`people-${id}`}>
      <h3 id={`people-${id}`}>{th(`people.g.${id}` as StringKey)}</h3>
      <ul className="plain-list">
        {rows.map((r) => <li key={r.id}><Card>{render(r)}</Card></li>)}
      </ul>
    </section>
  )
}

function Incoming({ row, onDone }: { row: ChatConnection; onDone: (note: string) => void }) {
  const answer = useAction(async (accept: boolean, block: boolean) => { await api.chatConnections.respond(row.id, accept, block); onDone(accept ? t('people.nowConnected', { name: row.name }) : t('people.answered')) })
  return (
    <>
      <p><strong>{t('people.incoming', { name: row.name })}</strong></p>
      <div className="button-row">
        <Button disabled={answer.busy} onClick={() => void answer.run(true, false)}>{t('people.accept')}<span className="visually-hidden"> {row.name}</span></Button>
        <Button variant="secondary" disabled={answer.busy} onClick={() => void answer.run(false, false)}>{t('people.decline')}<span className="visually-hidden"> {row.name}</span></Button>
        <Button variant="tertiary" disabled={answer.busy} onClick={() => void answer.run(false, true)}>{t('people.block')}<span className="visually-hidden"> {row.name}</span></Button>
      </div>
      <ActionError error={answer.error} />
    </>
  )
}

function Approval({ row, onDone }: { row: ChatConnection; onDone: (note: string) => void }) {
  const answer = useAction(async (accept: boolean) => { await api.chatConnections.respond(row.id, accept, false); onDone(t('people.answered')) })
  return (
    <>
      <p><strong>{t('people.approval', { child: row.childName ?? '', name: row.name })}</strong></p>
      <p className="muted">{t('people.approvalBody')}</p>
      <div className="button-row">
        <Button disabled={answer.busy} onClick={() => void answer.run(true)}>{t('people.allow')}<span className="visually-hidden"> {row.name}</span></Button>
        <Button variant="secondary" disabled={answer.busy} onClick={() => void answer.run(false)}>{t('people.decline')}<span className="visually-hidden"> {row.name}</span></Button>
      </div>
      <ActionError error={answer.error} />
    </>
  )
}

function Outgoing({ row, onDone }: { row: ChatConnection; onDone: (note: string) => void }) {
  const cancel = useAction(async () => { await api.chatConnections.cancel(row.id); onDone(t('people.cancelled', { name: row.name })) })
  return (
    <>
      <p><strong>{row.name}</strong> <span className="muted">{t('people.waitingForReply')}</span></p>
      <Button variant="tertiary" disabled={cancel.busy} onClick={() => void cancel.run()}>{t('people.cancel')}<span className="visually-hidden"> {row.name}</span></Button>
      <ActionError error={cancel.error} />
    </>
  )
}

function Connected({ row, onDone }: { row: ChatConnection; onDone: (note: string) => void }) {
  const [confirm, setConfirm] = useState(false)
  const end = useAction(async () => { await api.chatConnections.end(row.id); setConfirm(false); onDone(t('people.ended', { name: row.name })) })
  return (
    <>
      <p><strong>{row.name}</strong>{row.isNew && <> <span className="tag">{t('people.new.tag')}</span></>}</p>
      <p className="muted">{t('people.connectedBody')}</p>
      <Button variant="tertiary" onClick={() => setConfirm(true)}>{t('people.end')}<span className="visually-hidden"> {row.name}</span></Button>
      {confirm && (
        <Dialog title={t('people.endTitle', { name: row.name })} onClose={() => setConfirm(false)}>
          <p>{t('people.endBody')}</p>
          <div className="button-row">
            <Button disabled={end.busy} onClick={() => void end.run()}>{t('people.endYes')}</Button>
            <Button variant="secondary" onClick={() => setConfirm(false)}>{t('people.endNo')}</Button>
          </div>
          <ActionError error={end.error} />
        </Dialog>
      )}
    </>
  )
}

/** Search by name on this sailing, then ask. Opens in a dialog so focus is trapped and Escape closes it. */
function Search({ onClose, onDone }: { onClose: () => void; onDone: (note: string) => void }) {
  const [text, setText] = useState('')
  const [results, setResults] = useState<ChatPerson[] | null>(null)
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set())
  const [problem, setProblem] = useState<ApiError | null>(null)
  const latest = useRef(0)
  const query = cleanQuery(text)
  const find = useAction(async () => {
    if (!query) return
    const n = ++latest.current
    const found = await api.chatConnections.search(query)
    if (n === latest.current) setResults(found)
  })
  const ask = useAction(async (p: ChatPerson) => {
    setProblem(null)
    try { await api.chatConnections.request(p.id) } catch (e) { setProblem(e as ApiError); throw e }
    setSent(new Set([...sent, p.id]))
    onDone(t('people.asked', { name: p.name }))
  })
  const why = problem ? requestProblem(problem.code, problem.message) : null
  return (
    <Dialog title={t('people.new')} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (query) void find.run() }}>
        <Field label={t('people.search')} hint={t('people.searchHint')} value={text} maxLength={40} autoComplete="off" onChange={(e) => { setText(e.target.value); setResults(null) }} />
        <Button type="submit" disabled={find.busy || !query}>{t('people.find')}</Button>
      </form>
      {find.error && (find.error.code === 'offline' || find.error.code === 'network') ? <Banner kind="offline" title={t('people.offline')} /> : <ActionError error={find.error} />}
      {results && (results.length === 0
        ? <p role="status">{t('people.noMatch')}</p>
        : (
          <ul className="plain-list" aria-label={t('people.results')}>
            {results.map((p) => {
              const action = personAction(p.relation)
              const note = relationNote(p.relation)
              return (
                <li key={p.id} className="row">
                  <span><strong>{p.name}</strong>{note && <> <span className="muted">{t(`people.rel.${note}` as StringKey)}</span></>}{sent.has(p.id) && <> <span className="muted">{t('people.rel.asked')}</span></>}</span>
                  {action === 'ask' && !sent.has(p.id) && <Button variant="secondary" disabled={ask.busy} onClick={() => void ask.run(p)}>{t('people.ask')}<span className="visually-hidden"> {p.name}</span></Button>}
                  {action === 'open' && <Link to="/chat">{t('people.openChat')}<span className="visually-hidden"> {p.name}</span></Link>}
                </li>
              )
            })}
          </ul>
        ))}
      {why ? <p role="alert" className="field__error">{t(`people.problem.${why}` as StringKey)}</p> : <ActionError error={ask.error} />}
    </Dialog>
  )
}

/**
 * Chat by text for when I am ashore (docs/chat-plan.md, 4.9). Off until the guest turns it on, and it needs a confirmed phone number.
 * Says plainly that texts pass through the phone company, and what each word does.
 */
function TextBridge() {
  const state = useMine(() => api.chatConnections.sms())
  const [shown, setShown] = useState<ChatSms | null>(null)
  const [refused, setRefused] = useState<ReturnType<typeof smsReason>>(null)
  const current = shown ?? state.data
  const save = useAction(async (on: boolean, idle: boolean) => {
    setRefused(null)
    try { setShown(await api.chatConnections.saveSms(on, idle)) } catch (e) {
      const err = e as ApiError
      setRefused(smsReason(err.message, err.code))
      throw e
    }
  })
  if (!current) return null
  const reason = refused ?? current.reason
  return (
    <section aria-labelledby="people-sms-h">
      <h3 id="people-sms-h">{th('people.sms')}</h3>
      <div className="chip-row">
        <Chip pressed={current.on} onToggle={() => void save.run(!current.on, current.idle).catch(() => undefined)}>{t('people.sms.on')}</Chip>
        <Chip pressed={current.idle} onToggle={() => void save.run(current.on, !current.idle).catch(() => undefined)}>{t('people.sms.idle')}</Chip>
      </div>
      <p className="muted">{t('people.sms.body')}</p>
      <p className="muted">{t('people.sms.cost')}</p>
      <p className="muted">{t('people.sms.commands')}</p>
      {reason && (
        <p role={refused ? 'alert' : 'status'} className={refused ? 'field__error' : 'muted'}>
          {t(`people.sms.reason.${reason}` as StringKey)}{needsPhone(reason) && <> <Link to="/me/notifications">{t('people.sms.confirm')}</Link></>}
        </p>
      )}
      {!save.error || refused ? null : <ActionError error={save.error} />}
    </section>
  )
}

/** Who can find me, and whether a notice may show the text (stored now; used when messages arrive). */
function Settings({ state, onHidden }: { state: ReturnType<typeof useMine<ChatSettings>>; onHidden: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [shown, setShown] = useState<ChatSettings | null>(null)
  const current = shown ?? state.data
  const save = useAction(async (next: ChatSettings) => {
    setShown(next)
    try { setShown(await api.chatConnections.saveSettings(next)) } catch (e) { setShown(null); throw e }
  })
  const hide = useAction(async () => { setShown(await api.chatConnections.hide()); setConfirm(false); onHidden() })
  // The read-receipts switch lives here too, beside the others, as well as in a chat's options. The switch moves at once and goes back if saving fails.
  const stored = useMine(() => api.messages.receipts())
  const [receiptsShown, setReceiptsShown] = useState<boolean | null>(null)
  const receipts = { on: receiptsShown ?? stored.data === true }
  const flipReceipts = useAction(async (next: boolean) => {
    await optimistic(() => setReceiptsShown(next), () => api.messages.setReceipts(next), () => setReceiptsShown(null))
    stored.retry()
    setReceiptsShown(null)
  })
  if (!current) return null
  return (
    <section aria-labelledby="people-settings-h">
      <h3 id="people-settings-h">{th('people.settings')}</h3>
      <div className="chip-row">
        <Chip pressed={current.findable} onToggle={() => void save.run({ ...current, findable: !current.findable })}>{t('people.findable')}</Chip>
        <Chip pressed={current.showPreview} onToggle={() => void save.run({ ...current, showPreview: !current.showPreview })}>{t('people.preview')}</Chip>
        <Chip pressed={current.typing} onToggle={() => void save.run({ ...current, typing: !current.typing })}>{t('people.typing')}</Chip>
        <Chip pressed={receipts.on} onToggle={() => void flipReceipts.run(!receipts.on)}>{t('chat.receipts')}</Chip>
      </div>
      <p className="muted">{t('people.findableBody')}</p>
      <p className="muted">{t('people.previewBody')}</p>
      <p className="muted">{t('people.typingBody')}</p>
      <p className="muted">{t('chat.receiptsBody')}</p>
      <ActionError error={save.error} />
      <ActionError error={flipReceipts.error} />
      <Button variant="secondary" onClick={() => setConfirm(true)}>{t('people.hide')}</Button>
      <p className="muted">{t('people.hideBody')}</p>
      {confirm && (
        <Dialog title={t('people.hideTitle')} onClose={() => setConfirm(false)}>
          <p>{t('people.hideConfirm')}</p>
          <div className="button-row">
            <Button disabled={hide.busy} onClick={() => void hide.run()}>{t('people.hideYes')}</Button>
            <Button variant="secondary" onClick={() => setConfirm(false)}>{t('people.hideNo')}</Button>
          </div>
          <ActionError error={hide.error} />
        </Dialog>
      )}
    </section>
  )
}
