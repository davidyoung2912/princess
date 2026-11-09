import { Link, useLocation, useNavigate } from 'react-router'
import { useState, useSyncExternalStore, type FormEvent } from 'react'
import { getContext, subscribeContext } from '../account/context'
import { jumpTo } from '../demo/store'
import { dayLabel, dayLabelLong, timeIn, zonedToEpoch } from '../domain/timezones'
import { clockTime } from '../domain/syncAge'
import type { DayOfStage } from '../domain/journeyPosition'
import { JOURNEY_STAGES } from '../routes/hubs'
import { useJourneyPosition } from '../hooks/useJourneyPosition'
import { useNow } from '../hooks/useDemo'
import { t } from '../i18n'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { CloudSun, Compass, Drama } from './icons'
import { Field } from './Field'

const AT_LINKS = [
  { to: '/entertainment', Icon: Drama, label: 'testbar.at.entertainment' },
  { to: '/weather', Icon: CloudSun, label: 'testbar.at.weather' },
  { to: '/nautical', Icon: Compass, label: 'testbar.at.nautical' },
] as const

function dayText(stage: string, day: DayOfStage | null): string {
  if (!day) return stage
  if (day.kind === 'cruiseDay') return t('testbar.day.cruise', { stage, day: day.day, of: day.of })
  if (day.kind === 'daysToDeparture') return t('testbar.day.to', { stage, count: day.days })
  return t('testbar.day.since', { stage, count: day.days })
}

/**
 * The ship date with the guest's stage under it (the stage opens the stage welcome page). For demo accounts only, the date and a time block (whose clock it is under it) open a
 * picker that moves the testing date, which changes the guest's stage and what every screen shows. Demo accounts only.
 */
export function TestBar() {
  const context = useSyncExternalStore(subscribeContext, getContext, getContext)
  if (!context) return null
  return <TestBarBody isDemo={context.isDemo === true} />
}

function TestBarBody({ isDemo }: { isDemo: boolean }) {
  const position = useJourneyPosition()
  const now = useNow()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const stage = t(`journey.stage.${position.stage}`)
  const at = JOURNEY_STAGES.indexOf(position.stage)
  const previous = JOURNEY_STAGES[at - 1]
  const next = JOURNEY_STAGES[at + 1]
  const dateWords = (
    <>
      <span className="testbar__short">{dayLabel(now, position.zone)}</span>
      <span className="testbar__long">{dayLabelLong(now, position.zone)}</span>
    </>
  )
  return (
    <div className="testbar no-print" role="group" aria-label={t('testbar.label')}>
      <div className="testbar__item testbar__item--date">
        {isDemo
          ? <button type="button" className="testbar__main testbar__pick" onClick={() => setOpen(true)} aria-label={`${t('testbar.date')}: ${dayLabelLong(now, position.zone)}`}>{dateWords}</button>
          : <span className="testbar__main">{dateWords}</span>}
        <span className="testbar__stages" title={isDemo ? position.stageReason ?? undefined : undefined}>
          {previous && <span className="testbar__stage testbar__stage--side">{t(`journey.stage.${previous}`)}</span>}
          <Link to="/welcome" state={{ from: pathname }} className="testbar__stage testbar__stage--current" aria-current="step" aria-label={`${t('testbar.stage')}: ${dayText(stage, position.day)}`}>{dayText(stage, position.day)}</Link>
          {next && <span className="testbar__stage testbar__stage--side">{t(`journey.stage.${next}`)}</span>}
        </span>
      </div>
      <nav className="testbar__at" aria-label={t('testbar.at.label')}>
        {AT_LINKS.map(({ to, Icon, label }) => (
          <Link key={to} to={to} className="testbar__at-link" aria-label={t(label)} title={t(label)} aria-current={pathname === to ? 'page' : undefined}>
            <Icon aria-hidden="true" />
          </Link>
        ))}
      </nav>
      {isDemo && (
        <button type="button" className="testbar__item testbar__item--time" onClick={() => setOpen(true)} aria-label={`${t('testbar.time')}: ${clockTime(new Date(now), position.zone)}`}>
          <span className="testbar__main">{clockTime(new Date(now), position.zone)}</span>
          <span className="testbar__sub">{t(position.clock === 'ship' ? 'testbar.ship' : 'testbar.local')}</span>
        </button>
      )}
      {isDemo && open && <PickerDialog now={now} zone={position.zone} onClose={() => setOpen(false)} />}
    </div>
  )
}

function PickerDialog({ now, zone, onClose }: { now: number; zone: string; onClose: () => void }) {
  const [date, setDate] = useState(() => new Date(now).toLocaleDateString('sv-SE', { timeZone: zone }))
  const [time, setTime] = useState(() => timeIn(now, zone))
  const [error, setError] = useState(false)
  const navigate = useNavigate()
  const apply = (e: FormEvent) => {
    e.preventDefault()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) { setError(true); return }
    jumpTo(zonedToEpoch(date, time, zone))
    onClose()
    // The screen the tester was on may not fit the new stage: start again from the landing page.
    void navigate('/')
  }
  return (
    <Dialog title={t('testbar.dialog')} onClose={onClose}>
      <form className="testbar__dialog" onSubmit={apply} noValidate>
        <p>{t('testbar.dialog.note', { zone })}</p>
        <Field label={t('testbar.dialog.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Field label={t('testbar.dialog.time')} type="time" value={time} onChange={(e) => setTime(e.target.value)} error={error ? t('testbar.dialog.invalid') : undefined} />
        <Button type="submit">{t('testbar.dialog.apply')}</Button>
      </form>
    </Dialog>
  )
}
