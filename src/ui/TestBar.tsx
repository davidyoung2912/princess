import { useState, useSyncExternalStore, type FormEvent } from 'react'
import { getContext, subscribeContext } from '../account/context'
import { jumpTo } from '../demo/store'
import { dayLabel, timeIn, zonedToEpoch } from '../domain/timezones'
import { clockTime } from '../domain/syncAge'
import type { DayOfStage } from '../domain/journeyPosition'
import { useJourneyPosition } from '../hooks/useJourneyPosition'
import { useNow } from '../hooks/useDemo'
import { t } from '../i18n'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Field } from './Field'

function dayText(stage: string, day: DayOfStage | null): string {
  if (!day) return stage
  if (day.kind === 'cruiseDay') return t('testbar.day.cruise', { stage, day: day.day, of: day.of })
  if (day.kind === 'daysToDeparture') return t('testbar.day.to', { stage, count: day.days })
  return t('testbar.day.since', { stage, count: day.days })
}

/**
 * For testers: the ship date with the guest's stage under it, and the time with whose clock it is under that. Either opens a
 * picker that moves the testing date, which changes the guest's stage and what every screen shows. Demo accounts only.
 */
export function TestBar() {
  const context = useSyncExternalStore(subscribeContext, getContext, getContext)
  if (!context?.isDemo) return null
  return <TestBarBody />
}

function TestBarBody() {
  const position = useJourneyPosition()
  const now = useNow()
  const [open, setOpen] = useState(false)
  const stage = t(`journey.stage.${position.stage}`)
  return (
    <div className="testbar no-print" role="group" aria-label={t('testbar.label')}>
      <button type="button" className="testbar__item" onClick={() => setOpen(true)} aria-label={`${t('testbar.date')}: ${dayLabel(now, position.zone)}`}>
        <span className="testbar__main">{dayLabel(now, position.zone)}</span>
        <span className="testbar__sub">{dayText(stage, position.day)}</span>
      </button>
      <button type="button" className="testbar__item testbar__item--time" onClick={() => setOpen(true)} aria-label={`${t('testbar.time')}: ${clockTime(new Date(now), position.zone)}`}>
        <span className="testbar__main">{clockTime(new Date(now), position.zone)}</span>
        <span className="testbar__sub">{t(position.clock === 'ship' ? 'testbar.ship' : 'testbar.local')}</span>
      </button>
      {open && <PickerDialog now={now} zone={position.zone} onClose={() => setOpen(false)} />}
    </div>
  )
}

function PickerDialog({ now, zone, onClose }: { now: number; zone: string; onClose: () => void }) {
  const [date, setDate] = useState(() => new Date(now).toLocaleDateString('sv-SE', { timeZone: zone }))
  const [time, setTime] = useState(() => timeIn(now, zone))
  const [error, setError] = useState(false)
  const apply = (e: FormEvent) => {
    e.preventDefault()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) { setError(true); return }
    jumpTo(zonedToEpoch(date, time, zone))
    onClose()
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
