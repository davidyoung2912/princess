import { t } from '../i18n'
import { StatusBadge } from './StatusBadge'

export type TimelineStatus = 'normal' | 'changed' | 'cancelled'

export interface TimelineItem {
  id: string
  /** Display time, e.g. "3:00 pm". */
  time: string
  title: string
  detail?: string
  status?: TimelineStatus
  /** What changed, shown with a changed item ("Moved from 7:30 pm"). */
  change?: string
}

interface TimelineProps {
  items: readonly TimelineItem[]
  label: string
  /** Index of the item that is happening now or next; gets a marker with words. */
  nowIndex?: number
}

/**
 * A day's plan. A cancelled event stays in the list, struck through and labelled, until the day ends; a changed
 * event says what changed. An event never silently disappears (requirement OB-08).
 */
export function Timeline({ items, label, nowIndex }: TimelineProps) {
  return (
    <ol className="timeline" aria-label={label}>
      {items.map((item, i) => {
        const status = item.status ?? 'normal'
        return (
          <li key={item.id} className={`timeline__item timeline__item--${status}`} aria-current={i === nowIndex ? 'time' : undefined}>
            <span className="timeline__time">{item.time}</span>
            <div className="timeline__body">
              {i === nowIndex && <span className="timeline__now">{t('timeline.now')}</span>}
              <p className="timeline__title">{item.title}</p>
              {item.detail && <p className="timeline__detail">{item.detail}</p>}
              {status === 'changed' && <p className="timeline__change"><StatusBadge kind="changed" label={t('timeline.changed')} /> {item.change}</p>}
              {status === 'cancelled' && <p className="timeline__change"><StatusBadge kind="cancelled" label={t('timeline.cancelled')} /> {item.change}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
