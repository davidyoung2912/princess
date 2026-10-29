import { Link } from 'react-router'
import { asEmbarkView } from '../../api/guards'
import type { EmbarkView } from '../../api/types'
import { EMBARK, WAIT_MINUTES } from '../../domain/boarding'
import { formatTime } from '../../domain/cruise'
import { PORT_FACTS } from '../../domain/travel'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useNow, usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
import { SyncChip } from '../SyncChip'
import { LoadError } from '../discover/parts'
import { ActionError, SupervisedNote } from '../account/parts'
import { personaById } from '../../domain/personas'

const time = (epoch: number) => formatTime(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(epoch))

/** Embarkation day (CHK-05, CHK-15): arrival, terminal, map, traffic, bags, documents, carry-on, stateroom and the first afternoon. */
export function EmbarkScreen() {
  const me = usePersona()
  const embark = useSavedCopy('embark', me?.booker ?? 'none', () => api.boarding.embark(), asEmbarkView, [me?.id])
  const now = useNow()
  return (
    <div className="page">
      <h1>{t('route.embarkation')}</h1>
      {embark.data ? (
        <>
          {embark.at !== null && <SyncChip updated={new Date(embark.at)} now={new Date(now)} state={embark.fromCopy ? 'offline' : 'live'} timeZone="America/New_York" />}
          <Body view={embark.data} offline={embark.fromCopy} reload={embark.retry} />
        </>
      ) : embark.status === 'error' ? <LoadError retry={embark.retry} /> : <p role="status" className="muted">{t('account.loading')}</p>}
    </div>
  )
}

function Body({ view, offline, reload }: { view: EmbarkView; offline: boolean; reload: () => void }) {
  const me = usePersona()
  const { boarding } = view
  const bags = useAction(async (dropped: boolean) => { await api.boarding.setBags(dropped); reload() })
  const carry = useAction(async (item: EmbarkView['carryOn'][number]['id'], done: boolean) => { await api.boarding.setCarryOn(item, done); reload() })
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(EMBARK.mapQuery)}`
  const nurse = view.nurseCheck
  return (
    <>
      {!view.canEdit && me && <SupervisedNote booker={personaById(me.booker)!.firstName} />}
      {offline && <Banner kind="offline" title={t('pass.offline')}><p>{t('pass.offlineBody')}</p></Banner>}
      {boarding.terminal.changedFrom && <Banner kind="warning" title={t('pass.terminalChanged', { from: boarding.terminal.changedFrom, to: boarding.terminal.name })}><p>{t('pass.terminalChangedBody')}</p></Banner>}

      <Card hero labelledBy="arrive-h">
        <p className="eyebrow">{t('embark.arrival')}</p>
        {boarding.arrival ? <h2 id="arrive-h" className="booking-number">{formatTime(boarding.arrival.start)} – {formatTime(boarding.arrival.end)}</h2> : <h2 id="arrive-h">{t('embark.noWindow')}</h2>}
        <p>{boarding.arrival ? t('embark.waitGuide', { minutes: WAIT_MINUTES[boarding.arrival.crowd] }) : <Link to="/home/check-in/arrival">{t('embark.chooseWindow')}</Link>}</p>
        <p className="muted">{t('embark.timesNote', { opens: time(view.opensAt), closes: time(view.gangwayClosesAt) })}</p>
        <div className="button-row">
          <LinkButton to="/home/boarding-pass">{t('route.boardingPass')}</LinkButton>
          <LinkButton to="/home/embarkation/steps" variant="secondary">{t('embark.companion')}</LinkButton>
        </div>
      </Card>

      {!boarding.checkinDone && <Banner kind="warning" title={t('pass.notReady')} action={<LinkButton to="/home/check-in" variant="secondary">{t('route.checkin')}</LinkButton>}><p>{t('pass.notReadyBody')} <Link to="/home/check-in/terminal">{t('route.terminalCheckin')}</Link></p></Banner>}

      <section aria-labelledby="where-h">
        <h2 id="where-h">{t('embark.where')}</h2>
        <dl className="summary">
          <div className="summary__row"><dt>{t('pass.terminalLabel')}</dt><dd>{boarding.terminal.name}</dd></div>
          <div className="summary__row"><dt>{t('travel.fact.address')}</dt><dd>{PORT_FACTS.address}</dd></div>
          <div className="summary__row"><dt>{t('embark.traffic')}</dt><dd>{view.traffic ? t(`embark.traffic.${view.traffic}` as StringKey) : t('embark.traffic.unknown')}</dd></div>
          <div className="summary__row"><dt>{t('embark.parking')}</dt><dd>{t('embark.parkingBody')}</dd></div>
        </dl>
        <p><a href={mapUrl} target="_blank" rel="noreferrer">{t('embark.map')}<span className="visually-hidden"> {t('embark.newTab')}</span></a></p>
        <Link to="/plan/travel">{t('route.travel')}</Link>
      </section>

      <section aria-labelledby="bags-h">
        <h2 id="bags-h">{t('embark.bags')}</h2>
        <p>{t('embark.bagsBody')}</p>
        <p role="status"><StatusBadge kind={view.luggage.status === 'delivered' ? 'booked' : view.luggage.status === 'dropped' ? 'ready' : 'waitlist'} label={t(`embark.bags.${view.luggage.status}` as StringKey)} /></p>
        {view.canEdit && !offline && (view.luggage.status === 'notDropped' ? <Button variant="secondary" disabled={bags.busy} onClick={() => void bags.run(true)}>{t('embark.bags.drop')}</Button> : view.luggage.status === 'dropped' ? <Button variant="tertiary" disabled={bags.busy} onClick={() => void bags.run(false)}>{t('embark.bags.undo')}</Button> : null)}
        <ActionError error={bags.error} />
        <p className="muted">{t('embark.stateroom', { time: time(view.stateroomReadyAt) })} {view.stateroomReady && <strong>{t('embark.stateroomReady')}</strong>}</p>
      </section>

      <section aria-labelledby="docs-h">
        <h2 id="docs-h">{t('embark.docs')}</h2>
        <ul className="plain-list">
          {view.documents.map((d) => (
            <li key={d.id}><span>{d.name}</span>{d.ready ? <StatusBadge kind="booked" label={t('embark.docs.ready')} /> : <span><StatusBadge kind="changed" label={t('embark.docs.missing')} /> <Link to="/me/documents">{t('route.documents')}</Link></span>}</li>
          ))}
        </ul>
        {nurse.length > 0 && <Banner kind="info" title={t('embark.nurse', { names: nurse.join(', ') })}><p>{t('embark.nurseBody')}</p></Banner>}
      </section>

      <section aria-labelledby="carry-h">
        <h2 id="carry-h">{t('embark.carry')}</h2>
        <p>{t('embark.carryBody')}</p>
        {view.carryOn.map((c) => (
          <label key={c.id} className="choice">
            <input type="checkbox" checked={c.done} disabled={!view.canEdit || carry.busy || offline} onChange={() => void carry.run(c.id, !c.done)} />
            <span>{t(`embark.carry.${c.id}` as StringKey)}</span>
          </label>
        ))}
        <ActionError error={carry.error} />
      </section>

      <section aria-labelledby="pm-h">
        <h2 id="pm-h">{t('embark.afternoon')}</h2>
        <ol className="day-card__entries">
          {view.afternoon.map((a) => <li key={a.id}><span className="day-card__time">{time(a.at)}</span><span>{t(`embark.afternoon.${a.id}` as StringKey)}</span></li>)}
        </ol>
      </section>
    </>
  )
}
