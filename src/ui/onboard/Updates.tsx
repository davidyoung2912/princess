import { Link } from 'react-router'
import type { UpdateView } from '../../api/careTypes'
import { disruptionById } from '../../domain/disruption'
import { formatDate } from '../../domain/cruise'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { usePersona } from '../../hooks/useDemo'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
import { ActionError } from '../account/parts'
import { LoadError } from '../discover/parts'
import { BackLink } from './common'
import { useShipTime } from './shipTime'

const useUpdates = () => {
  const id = usePersona()?.id
  return useAsync(() => api.updates.list(), [id])
}

/** A note on Home when a change to the trip has not been acknowledged yet (SAF-06): the most serious one first, with a way in. */
export function UpdatesBanner() {
  const updates = useUpdates()
  const waiting = (updates.data ?? []).filter((u) => u.active && !u.ack)
  if (waiting.length === 0) return null
  const top = waiting[0]
  const def = disruptionById(top.id)!
  return (
    <Banner kind={top.severity === 'info' ? 'info' : top.severity === 'critical' ? 'danger' : 'warning'} title={t(def.title)} action={<LinkButton to="/home/updates" variant="secondary">{t('disrupt.review')}</LinkButton>}>
      {waiting.length > 1 && <p>{t('disrupt.more', { count: waiting.length - 1 })}</p>}
    </Banner>
  )
}

/** Changes to the trip (SUP-06, SAF-06, MNG-15): what changed, the choices, any offer, and a record of what the guest saw and chose. */
export function UpdatesScreen() {
  const me = usePersona()
  const updates = useUpdates()
  const ack = useAction(async (id: UpdateView['id'], option: string) => { await api.updates.acknowledge(id, option); updates.retry() })
  return (
    <div className="page">
      <h1>{t('route.updates')}</h1>
      <p>{t('disrupt.intro')}</p>
      {!updates.data ? (updates.status === 'error' ? <LoadError retry={updates.retry} /> : <p role="status" className="muted">{t('account.loading')}</p>) : updates.data.length === 0 ? <p>{t('disrupt.none')}</p> : (
        <>
          <ActionError error={ack.error} />
          {updates.data.map((u) => <Update key={u.id} u={u} canAck={!me?.child} busy={ack.busy} onAck={(option) => void ack.run(u.id, option)} />)}
        </>
      )}
      <BackLink to="/" label={t('route.home')} />
    </div>
  )
}

function Update({ u, canAck, busy, onAck }: { u: UpdateView; canAck: boolean; busy: boolean; onAck: (option: string) => void }) {
  const def = disruptionById(u.id)!
  const shipTime = useShipTime()
  const done = u.ack
  const chosen = def.options.find((o) => o.id === done?.option)
  return (
    <Card labelledBy={`up-${u.id}`}>
      <h2 id={`up-${u.id}`} className="card__title">{t(def.title)}</h2>
      <p>
        <StatusBadge kind={u.severity === 'info' ? 'ready' : 'changed'} label={t(`disrupt.sev.${u.severity}` as 'disrupt.sev.info')} />{' '}
        {!u.active && <StatusBadge kind="cancelled" label={t('disrupt.ended')} />}
      </p>
      <table className="bill-table">
        <caption className="visually-hidden">{t('disrupt.changed')}</caption>
        <thead><tr><th scope="col">{t('disrupt.what')}</th><th scope="col">{t('disrupt.before')}</th><th scope="col">{t('disrupt.after')}</th></tr></thead>
        <tbody>
          {def.changes.map((c) => <tr key={c.what}><th scope="row">{t(c.what)}</th><td>{t(c.before)}</td><td><strong>{t(c.after)}</strong></td></tr>)}
        </tbody>
      </table>
      {def.compensation && <p><strong>{t('disrupt.offer')}</strong> {t(def.compensation)}</p>}
      {def.link && <p><Link to={def.link}>{t('disrupt.see')}</Link></p>}
      {done ? (
        <p role="status">{t('disrupt.recorded', { choice: chosen ? t(chosen.label) : '', time: shipTime(done.at), date: formatDate(new Date(done.at).toISOString().slice(0, 10)) })}</p>
      ) : u.active && canAck ? (
        <div className="button-row" role="group" aria-label={t('disrupt.choose')}>
          {def.options.map((o, i) => <Button key={o.id} variant={i === 0 ? 'primary' : 'secondary'} disabled={busy} onClick={() => onAck(o.id)}>{t(o.label)}</Button>)}
        </div>
      ) : u.active ? <p className="muted">{t('disrupt.adultOnly')}</p> : null}
    </Card>
  )
}
