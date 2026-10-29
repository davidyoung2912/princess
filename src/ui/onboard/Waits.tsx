import { Link } from 'react-router'
import { directoryVenue } from '../../domain/menus'
import { formatTime } from '../../domain/cruise'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { useNow, usePersona } from '../../hooks/useDemo'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
import { ActionError } from '../account/parts'
import { PlanError } from '../plan/common'
import { useShipTime } from './shipTime'

const useWaits = () => {
  const id = usePersona()?.id
  const now = useNow()
  // The positions move with the clock, so ask again each minute of demo time.
  return useAsync(() => api.waits.list(), [id, Math.floor(now / 60_000)])
}

/** Join or leave a virtual queue for a walk-in place (DIN-02). Says why when the place is shut. */
export function QueueControl({ venueId }: { venueId: string }) {
  const waits = useWaits()
  const join = useAction(async () => { await api.waits.joinQueue(venueId); waits.retry() })
  const leave = useAction(async (id: string) => { await api.waits.leaveQueue(id); waits.retry() })
  const shipTime = useShipTime()
  const me = usePersona()
  if (!waits.data) return null
  const mine = waits.data.queues.find((q) => q.venueId === venueId)
  const open = waits.data.open.includes(venueId)
  return (
    <section aria-labelledby="queue-h">
      <h2 id="queue-h">{t('que.title')}</h2>
      <p>{t('que.intro')}</p>
      {mine && mine.stage === 'waiting' && (
        <Banner kind="info" title={t('que.position', { position: mine.position })}><p>{t('que.wait', { minutes: mine.waitMinutes, time: shipTime(mine.readyAt) })}</p></Banner>
      )}
      {mine && mine.stage === 'ready' && <Banner kind="success" title={t('que.ready')}><p>{t('que.readyBody', { time: shipTime(mine.expiresAt) })}</p></Banner>}
      {mine && mine.stage === 'expired' && <Banner kind="warning" title={t('que.expired')}><p>{t('que.expiredBody')}</p></Banner>}
      <PlanError error={join.error ?? leave.error} />
      {me?.child ? <p className="muted">{t('que.adult')}</p> : mine && mine.stage !== 'expired' ? (
        <Button variant="secondary" disabled={leave.busy} onClick={() => void leave.run(mine.id)}>{t('que.leave')}</Button>
      ) : open ? (
        <Button variant="secondary" disabled={join.busy} onClick={() => void join.run()}>{mine ? t('que.again') : t('que.join')}</Button>
      ) : <p className="muted">{t('que.closed')}</p>}
    </section>
  )
}

/** The guest's queues and waitlisted tables, with the offers to take (DIN-02). */
export function WaitsList() {
  const waits = useWaits()
  const shipTime = useShipTime()
  const leaveQueue = useAction(async (id: string) => { await api.waits.leaveQueue(id); waits.retry() })
  const leaveList = useAction(async (id: string) => { await api.waits.leaveWaitlist(id); waits.retry() })
  const accept = useAction(async (id: string) => { await api.waits.acceptWaitlist(id); waits.retry() })
  if (!waits.data) return null
  const queues = waits.data.queues.filter((q) => q.stage !== 'expired')
  const waiting = waits.data.waitlist.filter((w) => w.stage !== 'expired')
  const booked = waits.data.autoBooked
  if (queues.length === 0 && waiting.length === 0 && booked.length === 0) return null
  return (
    <section aria-labelledby="waits-h">
      <h2 id="waits-h">{t('wait.title')}</h2>
      {booked.map((b) => <p key={b.id} role="status"><StatusBadge kind="booked" label={t('wait.autoDone', { venue: directoryVenue(b.venueId)?.name ?? '', day: b.day, time: formatTime(b.time) })} /></p>)}
      <ActionError error={accept.error ?? leaveQueue.error ?? leaveList.error} />
      <ul className="card-grid">
        {queues.map((q) => (
          <li key={q.id}>
            <Card>
              <h3 className="card__title">{directoryVenue(q.venueId)?.name ?? q.venueId}</h3>
              <p>{q.stage === 'ready' ? <StatusBadge kind="ready" label={t('que.ready')} /> : <StatusBadge kind="waitlist" label={t('que.position', { position: q.position })} />}</p>
              <p className="muted">{q.stage === 'ready' ? t('que.readyBody', { time: shipTime(q.expiresAt) }) : t('que.wait', { minutes: q.waitMinutes, time: shipTime(q.readyAt) })}</p>
              <Button variant="secondary" disabled={leaveQueue.busy} onClick={() => void leaveQueue.run(q.id)}>{t('que.leave')}</Button>
            </Card>
          </li>
        ))}
        {waiting.map((w) => (
          <li key={w.id}>
            <Card>
              <h3 className="card__title">{directoryVenue(w.venueId)?.name ?? w.venueId}</h3>
              <p className="muted">{t('wait.for', { day: w.day, time: formatTime(w.time), count: w.guests.length })}</p>
              {w.stage === 'offered' ? (
                <>
                  <StatusBadge kind="ready" label={t('wait.offered')} />
                  <p>{t('wait.offerBody', { time: shipTime(w.expiresAt) })}</p>
                  <div className="button-row">
                    <Button disabled={accept.busy} onClick={() => void accept.run(w.id)}>{t('wait.take')}</Button>
                    <Button variant="secondary" disabled={leaveList.busy} onClick={() => void leaveList.run(w.id)}>{t('wait.leave')}</Button>
                  </div>
                </>
              ) : (
                <>
                  <StatusBadge kind="waitlist" label={t('wait.waiting', { position: w.position })} />
                  <p className="muted">{t('wait.waitingBody', { time: shipTime(w.offerAt) })}{w.auto ? ` ${t('wait.autoOn')}` : ''}</p>
                  <Button variant="secondary" disabled={leaveList.busy} onClick={() => void leaveList.run(w.id)}>{t('wait.leave')}</Button>
                </>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <p><Link to="/plan/dining">{t('res.find')}</Link></p>
    </section>
  )
}
