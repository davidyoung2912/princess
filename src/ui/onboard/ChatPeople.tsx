import { NicknameField } from '../NicknameField'
import { ChatLooks } from './ChatLooks'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { ChatConnection, ChatSettings, ChatSms } from '../../api/chatTypes'
import { needsPhone, smsReason } from '../../domain/chatSms'
import { waitingCount } from '../../domain/chatConnections'
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
import { ActionError, Load } from '../account/parts'
import { GroupInvites } from './ChatGroups'
import { StanleyNote } from './ChatStanley'
import { ChatAvatar } from './ChatLooks'
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

/** The People page, or with `?invitations=1` the Chat Invitations page. */
export function People() {
  const [params] = useSearchParams()
  return params.get('invitations') === '1' ? <Invitations /> : <ChatSettingsPage />
}

/** Every invitation waiting for the guest (and for their children) in one place: chat requests from people and invitations to groups, each to accept or decline. */
function Invitations() {
  const list = useMine(() => api.chatConnections.list())
  const invites = useMine(() => api.chatGroups.invites())
  useChatLive(() => { list.retry(); invites.retry() })
  const [note, setNote] = useState('')
  const refresh = () => { list.retry(); invites.retry(); chatChanged() }
  const done = (text: string) => { setNote(text); refresh() }
  // Opening the page is seeing any answers to requests the guest sent, so the Chat badge stops counting them.
  const answered = list.data ? list.data.answers.length + list.data.connected.filter((c) => c.isNew).length : 0
  useEffect(() => { if (answered > 0) void api.chatConnections.seen().then(chatChanged, () => undefined) }, [answered])
  const waiting = list.data ? waitingCount(list.data) : 0
  const count = waiting + (invites.data?.length ?? 0)
  const loaded = list.data !== undefined && invites.data !== undefined
  return (
    <section aria-labelledby="invitations-h">
      <h2 id="invitations-h" className="visually-hidden">{t('invitations.title')}</h2>
      <p role="status" className="visually-hidden">{note}</p>
      <Load state={list}>
        {(c) => (
          <>
            {c.approvals.length > 0 && <Group id="approvals" rows={c.approvals} render={(r) => <Approval row={r} onDone={done} />} />}
            {c.incoming.length > 0 && <Group id="incoming" rows={c.incoming} render={(r) => <Incoming row={r} onDone={done} />} />}
          </>
        )}
      </Load>
      <GroupInvites onDone={done} />
      {loaded && count === 0 && <p>{t('invitations.none')}</p>}
      <p><Link to="/chat">{t('invitations.back')}</Link></p>
    </section>
  )
}

/** Chat settings: who can find the guest, what notices show, typing and read receipts, the text-message bridge and hiding from chat. */
function ChatSettingsPage() {
  const settings = useMine(() => api.chatConnections.settings())
  const [note, setNote] = useState('')
  return (
    <section aria-labelledby="chat-settings-h">
      <h2 id="chat-settings-h" className="visually-hidden">{t('chatSettings.title')}</h2>
      <p role="status" className="visually-hidden">{note}</p>
      <TextBridge />
      <Settings state={settings} onHidden={() => { setNote(t('people.hidden')); chatChanged() }} />
    </section>
  )
}

function Group({ id, rows, render }: { id: 'approvals' | 'incoming'; rows: readonly ChatConnection[]; render: (row: ChatConnection) => React.ReactNode }) {
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
      <p className="person-line"><ChatAvatar avatar={row.avatar} name={row.name} small /><strong>{t('people.incoming', { name: row.name })}</strong></p>
      <StanleyNote text={row.note} />
      <div className="button-row">
        <Button disabled={answer.busy} onClick={() => void answer.run(true, false)}>{t('people.accept')}<span className="visually-hidden"> {row.name}</span></Button>
        <Button variant="secondary" disabled={answer.busy} onClick={() => void answer.run(false, false)}>{t('people.notNow')}<span className="visually-hidden"> {row.name}</span></Button>
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
      <p className="person-line"><ChatAvatar avatar={row.avatar} name={row.name} small /><strong>{t('people.approval', { child: row.childName ?? '', name: row.name })}</strong></p>
      <p className="muted">{t('people.approvalBody')}</p>
      <div className="button-row">
        <Button disabled={answer.busy} onClick={() => void answer.run(true)}>{t('people.allow')}<span className="visually-hidden"> {row.name}</span></Button>
        <Button variant="secondary" disabled={answer.busy} onClick={() => void answer.run(false)}>{t('people.decline')}<span className="visually-hidden"> {row.name}</span></Button>
      </div>
      <ActionError error={answer.error} />
    </>
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
      <NicknameField />
      <ChatLooks />
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
