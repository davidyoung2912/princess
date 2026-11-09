import { useState } from 'react'
import { Link } from 'react-router'
import { accessRows, activeCount, type AccessItem, type AccessRow } from '../../domain/access'
import type { Helper, PermissionId } from '../../domain/account'
import { NOT_YET, PERMISSIONS, permissionWorks } from '../../domain/account'
import { GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { useNow } from '../../hooks/useDemo'
import { useHub } from '../../hooks/useHub'
import { useParty } from '../../hooks/useParty'
import { useSharing } from '../../hooks/useSharing'
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
      <HelpingCard />
      <WhoCanSee helper={helper.data ?? null} />
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
      {PERMISSIONS.map((x) => (
        <label key={x} className="choice">
          <input type="checkbox" checked={value.includes(x) && permissionWorks(x)} disabled={x === 'view' || !permissionWorks(x)} onChange={() => onChange(value.includes(x) ? value.filter((p) => p !== x) : [...value, x])} />
          <span>{t(`helper.perm.${x}` as StringKey)}<small>{NOT_YET.includes(x) ? t('helper.perm.notYet') : t(`helper.perm.${x}.hint` as StringKey)}</small></span>
        </label>
      ))}
    </fieldset>
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
          <Field label={t('helper.name')} value={name} onChange={(e) => setName(e.target.value)} readOnly={requested} error={needName ? t('helper.needName') : undefined} autoComplete="off" />
          <Field label={t('helper.relationship')} value={relationship} onChange={(e) => setRelationship(e.target.value)} readOnly={requested} autoComplete="off" />
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

function Row({ row }: { row: AccessRow }) {
  const who = row.who ?? t('access.party')
  return (
    <li>
      <strong>{who}</strong> <span className="muted">{t(`access.kind.${row.kind}` as StringKey)} · {t(`access.status.${row.status}` as StringKey)}</span>
      {row.items.length > 0 && <ul>{row.items.map((x) => <li key={x}>{t(ITEM_KEY(x))}</li>)}</ul>}
      {row.until !== null && <p className="muted">{t('access.until', { date: formatMoment(row.until) })}</p>}
      {row.status === 'ended' && row.kind !== 'helper' && row.items.length === 0 && <p className="muted">{t('access.noneShared')}</p>}
      <Link to={row.path} aria-label={t('access.change', { who })}>{t('access.changeLink')}</Link>
    </li>
  )
}

/** Who can see what (IDN-07): every way this guest has let someone in, in one list. Changing any of them happens on that feature's own screen. */
function WhoCanSee({ helper }: { helper: Helper | null }) {
  const { state } = useHub()
  const { state: party } = useParty()
  const { sharing } = useSharing()
  const now = useNow()
  const rows = accessRows({ helper, home: state.home, party, sharing, now })
  return (
    <Card labelledBy="access-h">
      <h2 id="access-h">{th('access.title')}</h2>
      <p>{t('access.summary', { count: activeCount(rows) })}</p>
      <ul>{rows.map((r) => <Row key={r.id} row={r} />)}</ul>
      <p className="muted">{t('access.footnote')}</p>
    </Card>
  )
}
