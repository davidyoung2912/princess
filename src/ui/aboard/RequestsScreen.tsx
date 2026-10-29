import { useState } from 'react'
import { REQUEST_ITEMS, type RequestGroup } from '../../domain/services'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { useNow } from '../../hooks/useDemo'
import { useShipTime } from '../onboard/shipTime'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
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
  const ask = useAction(async (item: string) => { await api.aboard.requests.create(item, qty[item] ?? 1, ''); list.retry() })
  const cancel = useAction(async (id: string) => { await api.aboard.requests.cancel(id); list.retry() })
  return (
    <div className="page">
      <h1>{t('route.requests')}</h1>
      <p>{t('req.intro')}</p>
      <ChildNote />
      <AboardError error={ask.error ?? cancel.error} />
      {GROUPS.map((g) => (
        <section key={g} aria-labelledby={`req-${g}`}>
          <h2 id={`req-${g}`}>{t(`req.g.${g}` as StringKey)}</h2>
          <ul className="card-grid">
            {REQUEST_ITEMS.filter((i) => i.group === g).map((i) => (
              <li key={i.id}>
                <Card>
                  <h3 className="card__title">{t(`req.i.${i.id}` as StringKey)}</h3>
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
      <h2>{t('req.yours')}</h2>
      <Load state={list}>
        {(rows) => rows.length === 0 ? <p className="muted">{t('req.none')}</p> : (
          <ul className="card-grid">
            {rows.map((r) => (
              <li key={r.id}>
                <Card>
                  <h3 className="card__title">{r.qty > 1 ? `${r.qty} × ` : ''}{t(`req.i.${r.item}` as StringKey)}</h3>
                  <p><StatusBadge kind={r.stage === 'done' ? 'booked' : r.stage === 'cancelled' ? 'cancelled' : r.stage === 'onTheWay' ? 'ready' : 'waitlist'} label={t(`req.s.${r.stage}` as StringKey)} /></p>
                  <p className="muted">{r.stage === 'done' || r.stage === 'cancelled' ? t('req.asked', { time: shipTime(r.placedAt) }) : t('req.eta', { time: shipTime(Math.max(r.etaAt, now)) })}</p>
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

