import { useState } from 'react'
import { HelpTip } from '../HelpTip'
import { Link } from 'react-router'
import { accessRows, activeCount, relationshipOf, type AccessItem, type AccessRow } from '../../domain/access'
import type { Helper, PermissionId } from '../../domain/account'
import { NOT_YET, PERMISSIONS, formatInviteCode, permissionWorks } from '../../domain/account'
import { GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { TASKS_NEVER_SHARED, TASKS_NOT_OFFERED } from '../../domain/relationships'
import { liveLinkIds } from '../../domain/homeLink'
import { normalizeReceipts, type StanleyAction } from '../../ai/stanleyAction'
import { api, familyHome, stanleyActions } from '../../runtime'
import { StanleyActionCard } from '../ai/StanleyActionCard'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { useNow } from '../../hooks/useDemo'
import { useHub } from '../../hooks/useHub'
import { useParty } from '../../hooks/useParty'
import { useSharing } from '../../hooks/useSharing'
import { SHARING_FACETS } from '../../domain/partyShare'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Dialog } from '../Dialog'
import { Field } from '../Field'
import { formatMoment } from './format'
import { HelpingCard } from './HelpingCard'
import { ActionError, Load } from './parts'

/** Family helper (INC-01, ACT-05): someone who can manage the booking for a guest, only with that guest's consent and only for what they allow. */
export function HelperScreen() {
  const helper = useMine(() => api.account.helper())
  return (
    <div className="page">
      <p>{t('helper.intro')}</p>
      <Load state={helper}>
        {(h) => <HelperBody key={h?.status ?? 'none'} helper={h} refresh={helper.retry} />}
      </Load>
      <AcceptInvite />
      <HelpingCard />
      <WhoCanSee helper={helper.data ?? null} refresh={helper.retry} />
      <Card info labelledBy="alt-h">
        <h2 id="alt-h">{th('helper.alt.title')}</h2>
        <p>{t('helper.alt.body', { number: GUEST_SERVICES_NUMBER })}</p>
        <a className="btn btn--secondary" href={`tel:${GUEST_SERVICES_NUMBER}`}>{GUEST_SERVICES_NUMBER}</a>
      </Card>
    </div>
  )
}

function Permissions({ value, onChange }: { value: PermissionId[]; onChange: (next: PermissionId[]) => void }) {
  return (
    <fieldset>
      <legend>{t('helper.mayDo')}</legend>
<HelpTip about={t('helper.mayDo')}>{t('helptip.helperMay')}</HelpTip>
      {PERMISSIONS.map((x) => (
        <label key={x} className="choice">
          <input type="checkbox" checked={value.includes(x) && permissionWorks(x)} disabled={x === 'view' || !permissionWorks(x)} onChange={() => onChange(value.includes(x) ? value.filter((p) => p !== x) : [...value, x])} />
          <span>{t(`helper.perm.${x}` as StringKey)}<small>{NOT_YET.includes(x) ? t('helper.perm.notYet') : t(`helper.perm.${x}.hint` as StringKey)}</small></span>
        </label>
      ))}
    </fieldset>
  )
}

/** BM9: until the helper accepts with their own account the grant is only a name, so the guest hands over a one-time code. */
function InviteCode({ helper, refresh }: { helper: Helper; refresh: () => void }) {
  const renew = useAction(() => api.account.renewHelperCode())
  const again = async () => { if (await renew.run()) refresh() }
  if (helper.linked) return <p className="muted">{t('helper.linked', { name: helper.name })}</p>
  if (!helper.inviteCode) return helper.inviteExpires !== null ? <><p className="muted">{t('helper.code.expired', { name: helper.name })}</p><Button onClick={again} disabled={renew.busy}>{t('helper.code.renew')}</Button></> : null
  return (
    <Card labelledBy="code-h">
      <h2 id="code-h">{th('helper.code.title')}</h2>
      <p>{t('helper.code.body', { name: helper.name })}</p>
      <p><strong aria-label={t('helper.code.label', { name: helper.name })} style={{ fontSize: '1.5rem', letterSpacing: '0.15em' }}>{formatInviteCode(helper.inviteCode)}</strong></p>
      {helper.inviteExpires !== null && <p className="muted">{t('helper.code.until', { when: formatMoment(helper.inviteExpires) })}</p>}
      <Button variant="secondary" onClick={again} disabled={renew.busy}>{t('helper.code.renew')}</Button>
      <ActionError error={renew.error} />
    </Card>
  )
}

/** BM9: the helper enters the code a guest gave them. */
function AcceptInvite() {
  const [code, setCode] = useState('')
  const [bad, setBad] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const accept = useAction((c: string) => api.account.acceptHelperInvite(c))
  const go = async () => {
    const clean = code.replace(/[^a-z0-9]/gi, '')
    setBad(clean.length !== 8)
    if (clean.length !== 8) return
    const r = await accept.run(clean)
    if (r) { setDone(r.guestName); setCode(''); window.dispatchEvent(new Event('princess:helping-changed')) }
  }
  return (
    <Card labelledBy="accept-h">
      <h2 id="accept-h">{th('helper.accept.title')}</h2>
      <p>{t('helper.accept.body')}</p>
      <Field label={t('helper.accept.label')} help={t('helptip.inviteCode')} value={code} onChange={(e) => setCode(e.target.value)} error={bad ? t('helper.accept.bad') : undefined} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
      {accept.error?.code === 'notFound' ? <p role="alert" className="field__error">{t('helper.accept.notFound')}</p> : <ActionError error={accept.error} />}
      <p role="status">{done ? t('helper.accept.done', { name: done }) : ''}</p>
      <Button disabled={accept.busy} onClick={() => void go()}>{t('helper.accept.button')}</Button>
    </Card>
  )
}

function HelperBody({ helper, refresh }: { helper: Helper | null; refresh: () => void }) {
  const [name, setName] = useState(helper?.name ?? '')
  const [relationship, setRelationship] = useState(helper?.relationship ?? '')
  const [permissions, setPermissions] = useState<PermissionId[]>(helper?.permissions.length ? helper.permissions : ['view'])
  const [needName, setNeedName] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const save = useAction((status: 'active' | 'requested') => api.account.saveHelper({ name, relationship, permissions: (permissions.includes('view') ? permissions : ['view' as PermissionId, ...permissions]).filter(permissionWorks), status }))
  const revoke = useAction(() => api.account.revokeHelper())
  const requested = helper?.status === 'requested'
  const active = helper?.status === 'active'

  const allow = async () => {
    setNeedName(!name.trim())
    if (!name.trim()) return
    if (await save.run('active')) refresh()
  }
  const stop = async () => { if (await revoke.run()) { setConfirmStop(false); refresh() } }

  return (
    <>
      {helper?.status === 'revoked' && <Banner kind="info" title={t('helper.revoked', { name: helper.name, date: formatMoment(helper.at) })} />}
      {requested && <Banner kind="warning" title={t('helper.requested', { name: helper!.name, relationship: helper!.relationship.toLowerCase() })}><p>{t('helper.requestedBody')}</p></Banner>}
      {helper && helper.status !== 'revoked' && <InviteCode helper={helper} refresh={refresh} />}
      {active && <WaitingFromHelper />}
      {active && (
        <Card labelledBy="active-h">
          <h2 id="active-h">{helper!.name}</h2>
          <p className="muted">{helper!.relationship}{helper!.relationship && ' · '}{t('helper.since', { date: formatMoment(helper!.at) })}</p>
          <ul>{helper!.permissions.filter(permissionWorks).map((x) => <li key={x}>{t(`helper.perm.${x}` as StringKey)}</li>)}</ul>
          <p className="muted">{t('helper.visible')}</p>
          <Button variant="danger" onClick={() => setConfirmStop(true)}>{t('helper.stop')}</Button>
        </Card>
      )}
      {!active && (
        <section aria-labelledby="form-h">
          <h2 id="form-h">{requested ? th('helper.decide') : th('helper.add')}</h2>
          <Field label={t('helper.name')} help={t('helptip.helperName')} value={name} onChange={(e) => setName(e.target.value)} readOnly={requested} error={needName ? t('helper.needName') : undefined} autoComplete="off" />
          <Field label={t('helper.relationship')} help={t('helptip.helperRelation')} value={relationship} onChange={(e) => setRelationship(e.target.value)} readOnly={requested} autoComplete="off" />
          <Permissions value={permissions} onChange={setPermissions} />
          <ActionError error={save.error} />
          <div className="button-row">
            <Button disabled={save.busy} onClick={() => void allow()}>{requested ? t('helper.allow') : t('helper.addButton')}</Button>
            {requested && <Button variant="secondary" disabled={revoke.busy} onClick={() => void stop()}>{t('helper.decline')}</Button>}
          </div>
          <ActionError error={revoke.error} />
        </section>
      )}
      {confirmStop && (
        <Dialog title={t('helper.stopTitle')} onClose={() => setConfirmStop(false)}>
          <p>{t('helper.stopBody', { name: helper!.name })}</p>
          <ActionError error={revoke.error} />
          <div className="button-row">
            <Button variant="danger" disabled={revoke.busy} onClick={() => void stop()}>{t('helper.stopConfirm')}</Button>
            <Button variant="secondary" onClick={() => setConfirmStop(false)}>{t('data.cancel')}</Button>
          </div>
        </Dialog>
      )}
    </>
  )
}

const SHARE_KEY: Record<string, StringKey> = {
  'share.plans': 'access.item.share.plans', 'share.status': 'access.item.share.status',
  'share.spending': 'access.item.share.spending', 'share.photos': 'access.item.share.photos',
}
const ITEM_KEY = (x: AccessItem): StringKey => (x === 'shipFacts' ? 'access.item.shipFacts' : SHARE_KEY[x] ?? (`helper.perm.${x}` as StringKey))

function Row({ row, onStop, stopped }: { row: AccessRow; onStop: (row: AccessRow) => Promise<boolean>; stopped: boolean }) {
  const who = row.who ?? t('access.party')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const stop = async () => { setBusy(true); setFailed(false); const ok = await onStop(row); setBusy(false); setFailed(!ok) }
  return (
    <li>
      <strong>{who}</strong> <span className="muted">{t(`relationship.${relationshipOf(row.kind)}` as StringKey)} · {t(`access.status.${row.status}` as StringKey)}</span>
      {row.items.length > 0 && <ul>{row.items.map((x) => <li key={x}>{t(ITEM_KEY(x))}</li>)}</ul>}
      {row.tasks.length > 0 && <p className="muted">{t('access.tasks', { tasks: row.tasks.map((k) => t(`task.${k}` as StringKey)).join(', ') })}</p>}
      {row.until !== null && <p className="muted">{t('access.until', { date: formatMoment(row.until) })}</p>}
      {row.status === 'ended' && row.kind !== 'helper' && row.items.length === 0 && <p className="muted">{t('access.noneShared')}</p>}
      <Link to={row.path} aria-label={t('access.change', { who })}>{t('access.changeLink')}</Link>
      {row.stoppable && <> <Button variant="danger" disabled={busy} aria-label={t(row.kind === 'invite' ? 'access.cancelFor' : 'access.stopFor', { who })} onClick={() => void stop()}>{t(row.kind === 'invite' ? 'access.cancel' : 'access.stop')}</Button></>}
      {failed && <p role="alert" className="field__error">{t('access.stopFailed')}</p>}
      <span role="status" className="visually-hidden">{stopped ? t('access.stopped', { who }) : ''}</span>
    </li>
  )
}

/** Who can see what (IDN-07): every way this guest has let someone in, in one list. Changing any of them happens on that feature's own screen. */
function WhoCanSee({ helper, refresh }: { helper: Helper | null; refresh: () => void }) {
  const { state } = useHub()
  const { state: party, uninvite } = useParty()
  const { sharing, set } = useSharing()
  const { update } = useHub()
  const [stopped, setStopped] = useState<string | null>(null)
  const now = useNow()
  const rows = accessRows({ helper, home: state.home, party, sharing, now })
  /** Ends one row at once (IDN-07). False when the server could not be reached, so the row stays and the guest is told. */
  const stop = async (row: AccessRow): Promise<boolean> => {
    try {
      if (row.kind === 'helper') { await api.account.revokeHelper(); refresh() }
      else if (row.kind === 'home') {
        const contactId = row.id.slice('home:'.length)
        for (const id of liveLinkIds(state.home, now, contactId)) await familyHome.revoke(id)
        update((s) => ({ ...s, home: { ...s.home, links: s.home.links.map((l) => (l.contactId === contactId ? { ...l, revoked: true } : l)) } }))
      } else if (row.kind === 'invite') uninvite(row.id.slice('invite:'.length))
      else for (const f of SHARING_FACETS) set(f, false)
    } catch { return false }
    setStopped(row.id)
    return true
  }
  return (
    <Card labelledBy="access-h">
      <h2 id="access-h">{th('access.title')}</h2>
      <p>{t('access.summary', { count: activeCount(rows) })}</p>
      <ul>{rows.map((r) => <Row key={r.id} row={r} onStop={stop} stopped={stopped === r.id} />)}</ul>
      <p className="muted">{t('access.footnote')}</p>
      <p className="muted">{t('access.notOffered', { tasks: TASKS_NOT_OFFERED.map((k) => t(`task.${k}` as StringKey)).join(', '), never: TASKS_NEVER_SHARED.map((k) => t(`task.${k}` as StringKey)).join(', ') })}</p>
    </Card>
  )
}

/** What the helper prepared for this guest. Each is a Stanley preview: nothing has happened until the guest confirms it here. */
function WaitingFromHelper() {
  const list = useMine(() => stanleyActions.waiting())
  const [changed, setChanged] = useState<Record<string, StanleyAction>>({})
  const rows = normalizeReceipts(list.data).map((a) => changed[a.id] ?? a)
  if (rows.length === 0) return null
  return (
    <Card labelledBy="helper-waiting-h">
      <h2 id="helper-waiting-h">{th('helper.waiting.title')}</h2>
      <p>{t('helper.waiting.intro')}</p>
      <ul className="plain-list">
        {rows.map((a) => (
          <li key={a.id}>
            {a.preparedBy && <p className="muted">{t('helper.waiting.by', { name: a.preparedBy })}</p>}
            <StanleyActionCard action={a} onChange={(next) => setChanged((c) => ({ ...c, [next.id]: next }))} />
          </li>
        ))}
      </ul>
    </Card>
  )
}
