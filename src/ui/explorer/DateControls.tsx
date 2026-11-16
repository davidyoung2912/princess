import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Plan } from '../icons'
import { shortDate } from '../../domain/explorer/presentation'
import type { DayChoice } from '../../domain/explorer/explorerDay'
import type { ExplorerDayState } from '../../hooks/useExplorer'
import { portById } from '../../domain/sailings'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { DialogHeader } from '../DialogHeader'

const placeOf = (c: DayChoice): string => (c.atSea ? t('exp.clock.sea') : portById(c.port)?.name ?? c.port)

/** The day the page shows, said plainly, and which it is when it is not the ship's day. */
export function ChosenDayNote({ state }: { state: ExplorerDayState }) {
  const c = state.choices[state.day - 1]
  // The ship's own day is already said by the date bar at the top and the ship clock below it; only another day needs a note.
  if (!c || c.isToday) return null
  const rel = c.isPast ? ` · ${t('exp.day.past')}` : ` · ${t('exp.day.future')}`
  return <p className="exp-chosen" role="status"><strong>{t('exp.day.viewing', { day: c.day, date: shortDate(c.date) })}</strong>{rel} · {placeOf(c)}</p>
}

/** Pick a date: a button that opens the list of sailing days, with previous, next and today beside it. */
export function PickDateButton({ state }: { state: ExplorerDayState }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="exp-date">
      <Button variant="tertiary" className="exp-date__step" onClick={() => state.step(-1)} disabled={state.day <= 1} aria-label={t('exp.date.prev')}><ChevronLeft aria-hidden="true" /></Button>
      <Button variant="secondary" onClick={() => setOpen(true)} aria-haspopup="dialog">{t('exp.date.pick')}</Button>
      <Button variant="tertiary" className="exp-date__step" onClick={() => state.step(1)} disabled={state.day >= state.total} aria-label={t('exp.date.next')}><ChevronRight aria-hidden="true" /></Button>
      <Button variant="tertiary" onClick={state.today} disabled={state.day === state.currentDay}><Plan aria-hidden="true" />{t('exp.date.today')}</Button>
      {open && (
        <Dialog title={t('exp.date.title')} onClose={() => setOpen(false)} header={(titleId) => <DialogHeader titleId={titleId} title={t('exp.date.title')} subtext={t('exp.date.sub')} icon={Plan} onClose={() => setOpen(false)} />}>
          <ul className="exp-days">
            {state.choices.map((c) => (
              <li key={c.day}>
                <button type="button" className="exp-days__btn" aria-pressed={c.day === state.day} onClick={() => { state.setDay(c.day); setOpen(false) }}>
                  <strong>{t('exp.date.option', { day: c.day, date: shortDate(c.date) })}</strong>
                  <span>{placeOf(c)}{c.isToday ? ` · ${t('exp.date.todayTag')}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </div>
  )
}
