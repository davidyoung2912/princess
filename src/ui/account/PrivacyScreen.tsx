import { useState } from 'react'
import { Link } from 'react-router'
import type { PrivacyPerson } from '../../api/careTypes'
import { formatDate } from '../../domain/cruise'
import { consentsFor, RETENTION, type ConsentId } from '../../domain/privacy'
import { api } from '../../runtime'
import { wipeAll } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { dateIn } from '../../domain/timezones'
import { useNow, usePersona } from '../../hooks/useDemo'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Dialog } from '../Dialog'
import { LoadError } from '../discover/parts'
import { BackLink } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'
import { ActionError } from './parts'

/** The privacy centre (ACT-06, SEC-03, SEC-04): what is kept and for how long, who has looked at it, what each person has agreed to, and how to delete everything. */
export function PrivacyScreen() {
  const me = usePersona()
  const view = useAsync(() => api.privacy.view(), [me?.id])
  const set = useAction(async (person: string, consent: ConsentId, on: boolean) => { await api.privacy.setConsent(person as never, consent, on); view.retry() })
  const [confirm, setConfirm] = useState(false)
  const today = dateIn(useNow(), 'America/New_York')
  const shipTime = useShipTime()
  return (
    <div className="page">
      <h1>{t('route.privacy')}</h1>
      <p>{t('priv.intro')}</p>
      {!view.data ? (view.status === 'error' ? <LoadError retry={view.retry} /> : <p role="status" className="muted">{t('account.loading')}</p>) : (
        <>
          <Card labelledBy="priv-keep-h">
            <h2 id="priv-keep-h" className="card__title">{t('priv.keep')}</h2>
            <p className="muted">{t('priv.cruiseEnds', { date: formatDate(view.data.cruiseEnds) })}</p>
            <ul className="plain-bullets">
              {RETENTION.map((r) => {
                const day = view.data!.deleteOn[r.id]
                return <li key={r.id}><strong>{t(r.label)}</strong>: {t(r.why)} {day ? t(day <= today ? 'priv.deletedOn' : 'priv.deleteOn', { date: formatDate(day) }) : t('priv.untilAsked')}</li>
              })}
            </ul>
            {view.data.deleted.length > 0 && <p role="status">{t('priv.deleted', { count: view.data.deleted.length })}</p>}
          </Card>

          <section aria-labelledby="priv-consent-h">
            <h2 id="priv-consent-h">{t('priv.consents')}</h2>
            <ActionError error={set.error} forbidden="priv.err.forbidden" />
            {view.data.people.map((p) => <Person key={p.id} p={p} busy={set.busy} onChange={(c, on) => void set.run(p.id, c, on)} />)}
          </section>

          <Card labelledBy="priv-storage-h">
            <h2 id="priv-storage-h" className="card__title">{t('priv.storage')}</h2>
            <p>{t('priv.storageBody')}</p>
          </Card>

          <section aria-labelledby="priv-access-h">
            <h2 id="priv-access-h">{t('priv.access')}</h2>
            <p>{t('priv.accessBody')}</p>
            {view.data.access.length === 0 ? <p className="muted">{t('priv.accessNone')}</p> : (
              <ul className="plain-bullets">
                {view.data.access.slice().reverse().slice(0, 15).map((a, i) => <li key={i}>{shipTime(a.at)} · {t(`priv.what.${a.what}` as 'priv.what.passport')} {t(`priv.action.${a.action}` as 'priv.action.viewed')} ({a.by})</li>)}
              </ul>
            )}
          </section>

          <Card labelledBy="priv-delete-h">
            <h2 id="priv-delete-h" className="card__title">{t('priv.delete')}</h2>
            <p>{t('priv.deleteBody')}</p>
            <div className="button-row">
              <Button variant="danger" onClick={() => setConfirm(true)}>{t('data.wipe')}</Button>
              <Link to="/me/settings">{t('priv.exportLink')}</Link>
            </div>
          </Card>
        </>
      )}
      {confirm && (
        <Dialog title={t('data.wipe.confirm')} onClose={() => setConfirm(false)}>
          <p>{t('data.wipe.body')}</p>
          <div className="button-row">
            <Button variant="secondary" onClick={() => setConfirm(false)}>{t('data.cancel')}</Button>
            <Button variant="danger" onClick={() => { setConfirm(false); void wipeAll() }}>{t('data.wipe')}</Button>
          </div>
        </Dialog>
      )}
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}

function Person({ p, busy, onChange }: { p: PrivacyPerson; busy: boolean; onChange: (c: ConsentId, on: boolean) => void }) {
  const first = p.name.split(' ')[0]
  return (
    <Card>
      <h3 className="card__title">{first}</h3>
      {p.age < 13 && <p className="muted">{t('priv.child', { name: first })}</p>}
      {consentsFor(p.age).map((c) => (
        <label key={c.id} className="choice">
          <input type="checkbox" checked={p.consents[c.id]} disabled={!p.canEdit || busy} onChange={(e) => onChange(c.id, e.target.checked)} />
          <span>{t(c.label)}<small>{t(c.hint)}</small></span>
        </label>
      ))}
      {!p.canEdit && <p className="muted">{t('priv.notYours')}</p>}
    </Card>
  )
}
