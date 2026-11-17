import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Plan } from '../icons'
import { shortDate } from '../../domain/explorer/presentation'
import type { DayChoice } from '../../domain/explorer/explorerDay'
import type { ExplorerDayState } from '../../hooks/useExplorer'
import { portById } from '../../domain/sailings'
import { useExplorerStage } from '../../hooks/useExplorerStage'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { DialogHeader } from '../DialogHeader'
import { StatusBadge } from '../StatusBadge'
import { DayIcon } from '../onboard/ItineraryScreen'

const placeOf = (c: DayChoice): string => (c.atSea ? t('exp.clock.sea') : portById(c.port)?.name ?? c.port)

/** Pick a date: a button that opens the list of sailing days, with previous, next and today beside it. */
export function PickDateButton({ state }: { state: ExplorerDayState }) {
  const [open, setOpen] = useState(false)
  const { stage } = useExplorerStage()
  return (
    <div className="exp-date">
      <Button variant="tertiary" className="exp-date__step" onClick={() => state.step(-1)} disabled={state.day <= 1} aria-label={t('exp.date.prev')}><ChevronLeft aria-hidden="true" /></Button>
      <Button variant="secondary" onClick={() => setOpen(true)} aria-haspopup="dialog">{t('exp.date.pick')}</Button>
      <Button variant="tertiary" className="exp-date__step" onClick={() => state.step(1)} disabled={state.day >= state.total} aria-label={t('exp.date.next')}><ChevronRight aria-hidden="true" /></Button>
      <Button variant="tertiary" onClick={state.today} disabled={state.day === Math.min(Math.max(state.currentDay, 1), state.total)}><Plan aria-hidden="true" />{stage === 'ahead' ? t('exp.date.firstDay') : t('exp.date.today')}</Button>
      {open && (
        <Dialog title={t('exp.date.title')} onClose={() => setOpen(false)} header={(titleId) => <DialogHeader titleId={titleId} title={t('exp.date.title')} subtext={t('exp.date.sub')} icon={Plan} onClose={() => setOpen(false)} />}>
          <ul className="exp-days">
            {state.choices.map((c) => (
              <li key={c.day}>
                <button type="button" className="exp-days__btn" aria-pressed={c.day === state.day} onClick={() => { state.setDay(c.day); setOpen(false) }}>
                  <span className="exp-days__head"><DayIcon day={c.day} last={c.day === state.choices.length} sea={c.atSea} /><strong>{t('exp.date.option', { day: c.day, date: shortDate(c.date) })}</strong>{c.isToday && stage === 'aboard' && <StatusBadge kind="booked" label={t('exp.date.todayTag')} />}</span>
                  <span>{placeOf(c)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </div>
  )
}
