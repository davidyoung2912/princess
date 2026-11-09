import { ShowMe } from '../ShowMe'
import { Link } from 'react-router'
import { asPortDayCopy } from '../../api/guards'
import type { PortDayView, TenderInfo, TourToday } from '../../api/types'
import { TENDER_GROUPS } from '../../domain/allaboard'
import { formatTime } from '../../domain/cruise'
import { PORTS } from '../../domain/sailings'
import { clockTime } from '../../domain/syncAge'
import { api } from '../../runtime'
import { useNow, usePersona, useSailing } from '../../hooks/useDemo'
import { StanleyReadCard, StanleyShoreCard } from '../ai/StanleyTravel'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { PORT_CONTACTS } from '../../domain/services'
import { LinkButton } from '../Button'
import { Card } from '../Card'
import { QrCode } from '../checkin/QrCode'
import { ContactsAshore, LastMinute, Readiness } from '../aboard/PortExtras'
import { BackLink, Saved } from './common'
import { duration, useShipTime } from './shipTime'
import { PushSwitch } from '../account/PushPanels'
import { PortCard } from './PortCard'
import { PortParty } from './PortParty'
import { PortPilot } from './PortPilot'
import { PinAndDayCard, PocketStopwatch, PortStamps, SunNudge, TakeMeBack } from '../delights/PortDelights'
import { TenderOutlook } from '../discover/TenderOutlook'
import { StanleyMoment } from '../ai/StanleyMoment'

/** The port day (POR-01 to POR-04, POR-11, POR-12): all-aboard, tender arrangements, and the day's tours with codes that work with no signal. */
export function PortDayScreen() {
  const me = usePersona()
  const copy = useSavedCopy('portDay', me?.booker ?? 'none', async () => ({ view: await api.onboard.portDay() }), asPortDayCopy, [me?.id])
  return (
    <div className="page">
      <PushSwitch question={t('push.allAboard.question')} />
      <Saved copy={copy}>
        {(c) => (c.view ? <Body v={c.view} /> : (
          <Banner kind="info" title={t('port.none')}><p>{t('port.noneBody')}</p></Banner>
        ))}
      </Saved>
      <BackLink to="/ship" label={t('route.ship')} />
    </div>
  )
}

function Body({ v }: { v: PortDayView }) {
  const port = PORTS[v.day.port]
  const now = useNow()
  const me = usePersona()
  const sailing = useSailing()
  return (
    <>
      {!v.skipped && now >= v.day.arriveAt && <StanleyMoment id="port" subject={String(v.day.day)} params={{ port: port.name }} />}
      {v.skipped && (
        <Banner kind="danger" title={t('port.skipped', { port: port.name })} action={<LinkButton to="/chat" variant="secondary">{t('port.skippedAsk')}</LinkButton>}>
          <p>{t('port.skippedBody')}</p>
        </Banner>
      )}
      <PortCard view={v.day} />
      <PocketStopwatch day={v.day} />
      <SunNudge day={v.day} />
      <PortPilot v={v} />
      {me && !v.skipped && <StanleyShoreCard sailingId={sailing.id} day={v.day.day} />}
      {me && !v.skipped && <StanleyReadCard sailingId={sailing.id} day={v.day.day} />}
      <PortParty v={v} />
      {v.tender && <Tender v={v} tender={v.tender} />}
      {v.day.tender && !v.skipped && <TenderOutlook port={v.day.port} date={v.day.date} headingId="tender-outlook-h" />}
      <Tours tours={v.tours} port={v.day.port} />
      <LastMinute />
      <Readiness tender={v.day.tender} />
      {v.day.port in PORT_CONTACTS && <ContactsAshore port={v.day.port} />}
      <TakeMeBack port={v.day.port} />
      <p><LinkButton to="/ship/safe-ashore" variant="secondary">{t('port.help')}</LinkButton></p>
      <PinAndDayCard day={v.day} />
      <PortStamps />
      <p><Link to={`/home/ports/${v.day.port}`}>{t('port.guide', { port: port.name })}</Link> · <Link to="/ship/port/guide">{t('route.portGuide')}</Link> · <Link to="/plan/assistance">{t('route.assistance')}</Link></p>
    </>
  )
}

function Tender({ v, tender }: { v: PortDayView; tender: TenderInfo }) {
  const shipTime = useShipTime()
  const local = (at: number) => clockTime(new Date(at), v.day.portZone)
  const group = TENDER_GROUPS.find((g) => g.id === tender.group.id) ?? tender.group
  return (
    <Card labelledBy="tender-h">
      <h2 id="tender-h" className="card__title">{th('tender.title')}</h2>
      {tender.mayTender && !v.day.tender && <Banner kind="warning" title={t('tender.mayTender')}><p>{t('tender.mayTenderBody')}</p></Banner>}
      {tender.delayMinutes > 0 && <Banner kind="warning" title={t('tender.delayed', { time: duration(tender.delayMinutes) })}><p>{t('tender.delayedBody')}</p></Banner>}
      <dl className="plain-dl">
        <div><dt>{t('tender.group')}</dt><dd>{group.name}</dd></div>
        <div><dt>{t('tender.call')}</dt><dd>{t('tender.callAt', { ship: shipTime(tender.callAt), local: local(tender.callAt) })}</dd></div>
        <div><dt>{t('tender.status')}</dt><dd>{t(`tender.s.${tender.status}` as StringKey)}{tender.waitMinutes > 0 ? `. ${t('tender.wait', { time: duration(tender.waitMinutes) })}` : ''}</dd></div>
        <div><dt>{t('tender.last')}</dt><dd>{t('tender.lastAt', { ship: shipTime(tender.lastTenderAt), local: local(tender.lastTenderAt) })}</dd></div>
      </dl>
      <p>{t('tender.priority')}</p>
      <p><ShowMe id="tender" /></p>
      <p>{tender.assistance ? t('tender.assist') : t('tender.assistAsk')} <Link to="/plan/assistance">{t('route.assistance')}</Link></p>
    </Card>
  )
}

function Tours({ tours, port }: { tours: TourToday[]; port: string }) {
  return (
    <section aria-labelledby="tours-h">
      <h2 id="tours-h">{th('port.tours')}</h2>
      {tours.length === 0 ? <p>{t('port.noTours', { port: PORTS[port as keyof typeof PORTS]?.name ?? port })} <Link to="/plan/excursions">{t('route.excursions')}</Link></p> : (
        <ul className="card-grid">
          {tours.map((x) => (
            <li key={x.id} className="card">
              <h3 className="card__title">{x.name}</h3>
              <p className="muted">{t('port.tourOperated')}</p>
              <ul className="tour__facts">
                <li>{t('port.meet', { time: formatTime(x.start) })}</li>
                <li>{x.meeting}</li>
                <li>{t('port.backBy', { time: formatTime(x.backBy) })}</li>
                {x.tender && <li>{t('port.tenderTour')}</li>}
              </ul>
              <div className="qr-row">
                {x.guests.map((g) => (
                  <figure key={g.id} className="qr-fig">
                    <QrCode text={g.code} label={t('port.qr', { name: g.name, tour: x.name })} className="pass__qr" />
                    <figcaption>{g.name}</figcaption>
                  </figure>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
