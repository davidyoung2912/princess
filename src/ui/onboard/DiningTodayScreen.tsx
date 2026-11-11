import { Link } from 'react-router'
import { asDiningView } from '../../api/guards'
import { formatTime } from '../../domain/cruise'
import { venueById } from '../../domain/dining'
import { useCurrentDay } from '../../hooks/useDayPlan'
import { usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, th } from '../../i18n'
import { api } from '../../runtime'
import { Card } from '../Card'
import { Saved } from './common'

/** Dining today: the guest's dinner reservations for today (and their fixed seating, if any), with where and the dress code. */
export function DiningTodayScreen() {
  const me = usePersona()
  const day = useCurrentDay()
  const dining = useSavedCopy('dining', me?.booker ?? 'none', () => api.plan.dining.view(), asDiningView, [me?.id])
  return (
    <div className="page">
      <Saved copy={dining}>
        {(view) => {
          const mine = view.reservations.filter((r) => r.day === day).sort((a, b) => a.time.localeCompare(b.time))
          return (
            <>
              {view.seating && <p>{t('res.fixed', { time: formatTime(view.seating) })}</p>}
              <Card hero labelledBy="dt-h">
                <h2 id="dt-h" className="card__title">{th('dtoday.title')}</h2>
                {mine.length === 0 ? <p>{t('dtoday.none')}</p> : (
                  <ul className="plain-bullets">
                    {mine.map((r) => {
                      const v = venueById(r.venueId)
                      return <li key={r.id}><strong>{formatTime(r.time)}</strong> {v?.name ?? r.venueId}</li>
                    })}
                  </ul>
                )}
              </Card>
              <p><Link to="/plan/dining">{t('res.find')}</Link></p>
            </>
          )
        }}
      </Saved>
    </div>
  )
}
