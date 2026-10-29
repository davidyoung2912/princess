import { useState } from 'react'
import type { Helper, PermissionId } from '../../domain/account'
import { PERMISSIONS } from '../../domain/account'
import { GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Dialog } from '../Dialog'
import { Field } from '../Field'
import { formatMoment } from './format'
import { ActionError, Load } from './parts'

/** Family helper (INC-01, ACT-05): someone who can manage the booking for a guest, only with that guest's consent and only for what they allow. */
export function HelperScreen() {
  const helper = useMine(() => api.account.helper())
  return (
    <div className="page">
      <h1>{t('route.helper')}</h1>
      <p>{t('helper.intro')}</p>
      <Load state={helper}>
        {(h) => <HelperBody key={h?.status ?? 'none'} helper={h} refresh={helper.retry} />}
      </Load>
      <Card info labelledBy="alt-h">
        <h2 id="alt-h">{t('helper.alt.title')}</h2>
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
          <input type="checkbox" checked={value.includes(x)} disabled={x === 'view'} onChange={() => onChange(value.includes(x) ? value.filter((p) => p !== x) : [...value, x])} />
          <span>{t(`helper.perm.${x}` as StringKey)}<small>{t(`helper.perm.${x}.hint` as StringKey)}</small></span>
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
  const save = useAction((status: 'active' | 'requested') => api.account.saveHelper({ name, relationship, permissions: permissions.includes('view') ? permissions : ['view', ...permissions], status }))
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
          <ul>{helper!.permissions.map((x) => <li key={x}>{t(`helper.perm.${x}` as StringKey)}</li>)}</ul>
          <p className="muted">{t('helper.visible')}</p>
          <Button variant="danger" onClick={() => setConfirmStop(true)}>{t('helper.stop')}</Button>
        </Card>
      )}
      {!active && (
        <section aria-labelledby="form-h">
          <h2 id="form-h">{requested ? t('helper.decide') : t('helper.add')}</h2>
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
