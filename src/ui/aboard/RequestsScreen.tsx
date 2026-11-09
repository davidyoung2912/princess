import { useState } from 'react'
import { Link } from 'react-router'
import { requestProgress, QUICK_REQUESTS, REQUEST_ITEMS, type RequestGroup } from '../../domain/services'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { useNow } from '../../hooks/useDemo'
import { useShipTime } from '../onboard/shipTime'
import { t, th, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
import { Stepper } from '../Stepper'
import { Load } from '../account/parts'
import { AboardError, Back, ChildNote } from './common'
import { usePersona } from '../../hooks/useDemo'
import { useVisibleInterval } from '../../hooks/useVisibleInterval'

const GROUPS: readonly RequestGroup[] = ['housekeeping', 'maintenance']

/** One-tap housekeeping and maintenance requests with live status (MSG-03). The stage moves with the clock, so the list asks again each minute. */
export function RequestsScreen() {
  const list = useMine(() => api.aboard.requests.list())
  const me = usePersona()
  const now = useNow()
  const shipTime = useShipTime()
  const [qty, setQty] = useState<Record<string, number>>({})
  useVisibleInterval(list.retry, 60_000, true)
  const [sentItem, setSentItem] = useState('')
  const ask = useAction(async (item: string) => { setSentItem(''); await api.aboard.requests.create(item, qty[item] ?? 1, ''); setSentItem(item); list.retry() })
  const escalate = useAction(async (id: string) => { await api.aboard.requests.escalate(id); list.retry() })
  const confirm = useAction(async (id: string) => { await api.aboard.requests.confirm(id); list.retry() })
  const reopen = useAction(async (id: string) => { await api.aboard.requests.reopen(id); list.retry() })
  const cancel = useAction(async (id: string) => { await api.aboard.requests.cancel(id); list.retry() })
  return (
    <div className="page">
      <p>{t('req.intro')}</p>
      <ChildNote />
      <AboardError error={ask.error ?? cancel.error ?? escalate.error ?? confirm.error ?? reopen.error} />
      <section aria-labelledby="req-quick">
        <h2 id="req-quick">{th('req.quick')}</h2>
        <p className="muted">{t('req.quickHint')}</p>
        <div className="button-row">
          {QUICK_REQUESTS.map((id) => <Button key={id} disabled={ask.busy || !!me?.child} onClick={() => void ask.run(id)}>{t(`req.i.${id}` as StringKey)}</Button>)}
        </div>
        <p role="status">{sentItem && !ask.error ? t('req.sent', { item: t(`req.i.${sentItem}` as StringKey) }) : ''}</p>
        <ul className="plain-list">
          <li><Link to="/ship/dnd">{t('req.dnd')}</Link> <span className="muted">{t('req.dndHint')}</span></li>
          <li><a href="#req-maintenance">{t('req.fixThis')}</a> <span className="muted">{t('req.fixThisHint')}</span></li>
        </ul>
      </section>
      {GROUPS.map((g) => (
        <section key={g} aria-labelledby={`req-${g}`}>
          <h2 id={`req-${g}`}>{th(`req.g.${g}` as StringKey)}</h2>
          <ul className="card-grid">
            {REQUEST_ITEMS.filter((i) => i.group === g).map((i) => (
              <li key={i.id}>
                <Card>
                  <h3 className="card__title">{th(`req.i.${i.id}` as StringKey)}</h3>
                  <p className="muted">{t('req.usually', { minutes: i.etaMin })}</p>
                  {i.maxQty > 1 && (
                    <div className="field">
                      <label htmlFor={`qty-${i.id}`}>{t('ab.qty')}</label>
                      <select id={`qty-${i.id}`} className="field__input" value={qty[i.id] ?? 1} onChange={(e) => setQty({ ...qty, [i.id]: Number(e.target.value) })}>
                        {Array.from({ length: i.maxQty }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  )}
                  <Button variant="secondary" disabled={ask.busy || !!me?.child} onClick={() => void ask.run(i.id)}>{t('req.ask')}</Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <h2>{th('req.yours')}</h2>
      <Load state={list}>
        {(rows) => rows.length === 0 ? <p className="muted">{t('req.none')}</p> : (
          <ul className="card-grid">
            {rows.map((r) => (
              <li key={r.id}>
                <Card>
                  <h3 className="card__title">{r.qty > 1 ? `${r.qty} × ` : ''}{th(`req.i.${r.item}` as StringKey)}</h3>
                  <p><StatusBadge kind={r.stage === 'done' ? 'booked' : r.stage === 'cancelled' ? 'cancelled' : r.stage === 'onTheWay' ? 'ready' : 'waitlist'} label={t(`req.s.${r.stage}` as StringKey)} /></p>
                  {r.stage !== 'cancelled' && <Stepper label={t('req.track')} steps={requestProgress(r.stage).map((x) => ({ id: x.id, state: x.state, label: t(`req.step.${x.id}` as StringKey) }))} />}
                  <p className="muted">{t(`req.team.${r.team}` as StringKey)}</p>
                  <p className="muted">{r.stage === 'done' || r.stage === 'cancelled' ? t('req.asked', { time: shipTime(r.placedAt) }) : t('req.eta', { time: shipTime(Math.max(r.etaAt, now)) })}</p>
                  {(r.stage === 'done' || r.stage === 'cancelled') && !r.confirmed && <p className="muted">{t(`req.noEta.${r.stage}` as StringKey)}</p>}
                  {r.escalated && <p>{t('req.escalated')}</p>}
                  {r.confirmed && <p>{t('req.closed')}</p>}
                  {(r.stage === 'received' || r.stage === 'onTheWay') && !r.escalated && !r.canEscalate && <p className="muted">{t('req.escalateHint', { minutes: 10 })}</p>}
                  {r.canEscalate && <Button variant="secondary" disabled={escalate.busy} onClick={() => void escalate.run(r.id)}>{t('req.escalate')}</Button>}
                  {r.canConfirm && (
                    <div role="group" aria-label={t('req.confirmQ')} className="button-row">
                      <Button disabled={confirm.busy} onClick={() => void confirm.run(r.id)}>{t('req.fixed')}</Button>
                      {r.canReopen && <Button variant="secondary" disabled={reopen.busy} onClick={() => void reopen.run(r.id)}>{t('req.reopen')}</Button>}
                    </div>
                  )}
                  {r.history.length > 0 && (
                    <details>
                      <summary>{t('req.history')}</summary>
                      <ul className="plain-list">{r.history.map((h) => <li key={`${h.kind}-${h.at}`}>{t(`req.h.${h.kind}` as StringKey, { time: shipTime(h.at) })}</li>)}</ul>
                    </details>
                  )}
                  {r.canCancel && <Button variant="tertiary" disabled={cancel.busy} onClick={() => void cancel.run(r.id)}>{t('req.cancel')}</Button>}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Load>
      <Back to="/ship" label={t('route.ship')} />
    </div>
  )
}

