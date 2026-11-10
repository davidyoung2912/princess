import { Link } from 'react-router'
import { asPortDayCopy } from '../../api/guards'
import { gangwayScan } from '../../sync/gangway'
import { useIsDemo } from '../../hooks/useIsDemo'
import { awayLevel, nextReturnTime, returnTimes, AWAY_PACK_KINDS } from '../../domain/awayFromShip'
import { LATE_STEPS } from '../../domain/allaboard'
import { GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { PORT_CONTACTS } from '../../domain/services'
import { PORTS } from '../../domain/sailings'
import { formatWhen } from '../../domain/offlineCapsule'
import { clockTime } from '../../domain/syncAge'
import { useMine } from '../../hooks/useMine'
import { PhoneCheck } from '../account/PushPanels'
import { useAwayFromShip, type PortToday } from '../../hooks/useAwayFromShip'
import { useNow, usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, th, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { ContactsAshore } from '../aboard/PortExtras'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { TakeMeBack } from '../delights/PortDelights'
import { BackLink, Saved } from './common'
import { Tours } from './PortTours'
import { duration, useShipTime } from './shipTime'

/** "Going ashore?" before the guest leaves, and a short note after they are back. Shown on Home and the port day during the hours the ship is in port. */
export function LeavingShipCard() {
  const a = useAwayFromShip()
  const shipTime = useShipTime()
  const demo = useIsDemo()
  if (!a.day) return null
  if (a.away) {
    return (
      <Card labelledBy="aship-leave-h">
        <h2 id="aship-leave-h" className="card__title">{th('aship.title')}</h2>
        <p>{t('aship.leave.away')}</p>
        <p><LinkButton to="/ship/away">{t('aship.leave.open')}</LinkButton></p>
      </Card>
    )
  }
  return (
    <Card labelledBy="aship-leave-h" hero>
      <h2 id="aship-leave-h" className="card__title">{th('aship.leave.title')}</h2>
      {a.presence === 'back' && a.at !== null && <p className="muted">{t('aship.leave.backAt', { time: shipTime(a.at) })}</p>}
      <p>{t('aship.leave.body')}</p>
      <Button block onClick={a.leave}>{a.presence === 'back' ? t('aship.leave.again') : t('aship.leave.button')}</Button>
      {demo && <p className="muted"><Button variant="tertiary" onClick={() => { void gangwayScan('off').then((recorded) => { if (!recorded) a.leave() }) }}>{t('aship.demo.leave')}</Button></p>}
    </Card>
  )
}

/**
 * "Get the return reminders by text": shown only while the phone number is not confirmed, and only when the status could be read (so never with no signal). Texts go
 * only to a confirmed number, and a guest ashore may have no data for a push, so this is the moment to confirm it.
 */
function TextReminderNudge() {
  const status = useMine(() => api.phoneCheck.status())
  if (status.status !== 'ready' || !status.data || status.data.verified) return null
  return (
    <Card labelledBy="aship-text-h">
      <h2 id="aship-text-h" className="card__title">{th('aship.text.title')}</h2>
      <p>{t('aship.text.body')}</p>
      {status.data.hasPhone ? <PhoneCheck /> : <p><Link to="/me/profile">{t('aship.text.add')}</Link></p>}
    </Card>
  )
}

/** The Away From Ship page: the way back first, then everything a guest wants in hand while off the ship. Replaces Home while the guest is away. */
export function AwayFromShipPanel({ day }: { day: PortToday }) {
  const a = useAwayFromShip()
  const now = useNow()
  const me = usePersona()
  const shipTime = useShipTime()
  const port = PORTS[day.port]
  const level = awayLevel(day, now)
  const times = returnTimes(day, now)
  const next = nextReturnTime(times)
  const local = (at: number) => clockTime(new Date(at), day.portZone)
  const view = useSavedCopy('portDay', me?.booker ?? 'none', async () => ({ view: await api.onboard.portDay() }), asPortDayCopy, [me?.id])
  const demo = useIsDemo()
  const landing = times.find((x) => x.id === 'landing')!
  const levelKind = level === 'plenty' ? 'info' : level === 'soon' ? 'warning' : 'danger'
  return (
    <>
      <h1 className="visually-hidden">{t('aship.title')}</h1>
      <Card hero labelledBy="aship-hero-h">
        <h2 id="aship-hero-h" className="card__title">{th('aship.hero.title')}</h2>
        <p className="aboard__deadline"><strong>{t('aship.hero.ship', { time: day.allAboardShip })}</strong></p>
        {day.allAboardShip !== day.allAboardLocal && <p className="muted">{t('aship.hero.local', { time: day.allAboardLocal, port: port.name })}</p>}
        {level !== 'gone' && level !== 'late' && next && <p className={`aboard__left aboard__left--${level}`}><strong role="timer">{t('aship.hero.left', { time: duration(Math.max(0, Math.ceil((day.allAboardAt - now) / 60_000))) })}</strong></p>}
        <Banner kind={levelKind} title={t(`aship.level.${level}` as StringKey)}>
          {!landing.passed && <p>{t('aship.hero.leftAt', { place: t(day.tender ? 'aship.place.tender' : 'aship.place.pier'), time: shipTime(landing.at) })}</p>}
        </Banner>
        <Button block onClick={a.back}>{t('aship.back.button')}</Button>
        <p className="muted">{t('aship.back.note')}</p>
      </Card>

      <TextReminderNudge />

      <Card labelledBy="aship-times-h">
        <h2 id="aship-times-h" className="card__title">{th('aship.times.title')}</h2>
        <ul className="plain-bullets">
          {times.map((x) => (
            <li key={x.id}>
              <strong>{x.id === 'landing' ? t(day.tender ? 'aship.time.landing.tender' : 'aship.time.landing.pier') : t(`aship.time.${x.id}` as StringKey)}</strong>
              {' '}{t('aship.time.row', { ship: shipTime(x.at), local: local(x.at), port: port.name })}
              {' · '}{x.passed ? t('aship.time.passed') : t('aship.time.in', { time: duration(x.minutesLeft) })}
            </li>
          ))}
        </ul>
        <p className="muted">{t('aship.time.note')}</p>
      </Card>

      <Card labelledBy="aship-pack-h">
        <h2 id="aship-pack-h" className="card__title">{th('aship.pack.title')}</h2>
        <p role="status">{t(`aship.pack.${a.pack.state}` as StringKey, { saved: a.pack.saved, total: a.pack.total })}{a.pack.at !== null && <> {t('aship.pack.at', { time: formatWhen(a.pack.at) })}</>}</p>
        <ul className="plain-bullets">
          {AWAY_PACK_KINDS.map((k) => <li key={k}>{t(`aship.pack.${k}` as StringKey)}: {a.pack.missing.includes(k) ? t('aship.pack.missing') : t('aship.pack.ok')}</li>)}
        </ul>
        <Button variant="secondary" onClick={a.save} disabled={a.saving}>{a.saving ? t('aship.pack.saving') : t('aship.pack.refresh')}</Button>
      </Card>

      <Card labelledBy="aship-help-h">
        <h2 id="aship-help-h" className="card__title">{th('aship.help.title')}</h2>
        <p><a className="btn btn--secondary" href={`tel:${GUEST_SERVICES_NUMBER}`}>{t('aship.help.call', { number: GUEST_SERVICES_NUMBER })}</a></p>
        <h3>{th('onb.late.title')}</h3>
        <ol className="plain-bullets">{LATE_STEPS.map((s) => <li key={s}>{t(`onb.late.${s}` as StringKey, { number: GUEST_SERVICES_NUMBER })}</li>)}</ol>
      </Card>

      <Saved copy={view}>{(c) => (c.view ? <Tours tours={c.view.tours} port={day.port} /> : null)}</Saved>
      {day.port in PORT_CONTACTS && <ContactsAshore port={day.port} />}
      <TakeMeBack port={day.port} />

      <section aria-labelledby="aship-links-h">
        <h2 id="aship-links-h">{th('aship.links.title')}</h2>
        <p><Link to="/home/boarding-pass">{t('route.boardingPass')}</Link> · <Link to="/ship/emergency">{t('route.emergency')}</Link> · <Link to="/ship/muster">{t('route.muster')}</Link> · <Link to="/ship/port">{t('route.portDay')}</Link> · <Link to="/ship/safe-ashore">{t('port.help')}</Link></p>
      </section>

      {demo && (
        <Card labelledBy="aship-demo-h">
          <h2 id="aship-demo-h" className="card__title">{th('aship.demo.title')}</h2>
          <p className="muted">{t('aship.demo.body')}</p>
          <Button variant="tertiary" onClick={() => { void gangwayScan('on').then((recorded) => { if (!recorded) a.back() }) }}>{t('aship.demo.button')}</Button>
        </Card>
      )}
    </>
  )
}

/** The route: the panel while the guest is away, the "Going ashore?" card when they are not, a plain note when no port day is in progress. */
export function AwayFromShipScreen() {
  const a = useAwayFromShip()
  return (
    <div className="page">
      {!a.day ? (
        <Banner kind="info" title={t('aship.none')}><p>{t('aship.noneBody')}</p></Banner>
      ) : a.away ? <AwayFromShipPanel day={a.day} /> : <LeavingShipCard />}
      <BackLink to="/ship" label={t('route.ship')} />
    </div>
  )
}
