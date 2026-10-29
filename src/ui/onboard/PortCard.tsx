import { Link } from 'react-router'
import type { PortDayView } from '../../api/types'
import { aboardState, LATE_STEPS, REMINDER_THRESHOLDS, reminderTimes } from '../../domain/allaboard'
import { GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { PORTS } from '../../domain/sailings'
import { useDemo, useNow, useSailing } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { ThreeClocks } from '../ThreeClocks'
import { duration, useShipTime } from './shipTime'

/** The all-aboard card (POR-02, POR-11): the deadline in ship time with the local equivalent, a countdown, the three clocks, and what to do if running late. */
export function PortCard({ view, compact }: { view: PortDayView['day']; compact?: boolean }) {
  const now = useNow()
  const sailing = useSailing()
  const demo = useDemo()
  const shipTime = useShipTime()
  const state = aboardState(view.allAboardAt, now)
  const port = PORTS[view.port]
  const differs = view.allAboardShip !== view.allAboardLocal
  const reminders = reminderTimes(view.allAboardAt)
  return (
    <Card hero labelledBy="aboard-h">
      <h2 id="aboard-h" className="card__title">{t('onb.aboard.title', { port: port.name })}</h2>
      <p className="aboard__deadline">
        <strong>{t('onb.aboard.at', { time: view.allAboardShip })}</strong> <span>{t('onb.aboard.shipTime')}</span>
      </p>
      {differs && <p className="muted">{t('onb.aboard.local', { time: view.allAboardLocal, port: port.name })}</p>}
      {state.level === 'gone' ? (
        <Banner kind="danger" title={t('onb.aboard.gone')}><p>{t('onb.aboard.goneBody')}</p></Banner>
      ) : state.level === 'late' ? (
        <Banner kind="danger" title={t('onb.aboard.late')}><p>{t('onb.aboard.lateBody')}</p></Banner>
      ) : (
        <p className={`aboard__left aboard__left--${state.level}`}>
          <strong>{t('onb.aboard.left', { time: duration(state.minutesLeft) })}</strong>
          <span className="aboard__level" role="status">{t(`onb.aboard.level.${state.level}` as StringKey)}</span>
        </p>
      )}
      <ThreeClocks sailing={sailing} at={now} phoneZone={demo.phoneZone} />
      {!compact && (
        <>
          <p className="muted">{t('onb.aboard.reminders', { list: REMINDER_THRESHOLDS.map((m) => t('onb.aboard.before', { count: m })).join(', ') })}</p>
          <ul className="plain-bullets">{reminders.map((r) => <li key={r.minutes}>{t('onb.aboard.reminderAt', { count: r.minutes, time: shipTime(r.at) })}</li>)}</ul>
          <h3>{t('onb.late.title')}</h3>
          <ol className="plain-bullets">{LATE_STEPS.map((s) => <li key={s}>{t(`onb.late.${s}` as StringKey, { number: GUEST_SERVICES_NUMBER })}</li>)}</ol>
        </>
      )}
      {compact && <p><Link to="/ship/port">{t('onb.aboard.more')}</Link></p>}
    </Card>
  )
}
