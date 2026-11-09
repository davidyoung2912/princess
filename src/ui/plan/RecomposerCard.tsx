import { useState } from 'react'
import { Link } from 'react-router'
import { EXCURSIONS, excursionById } from '../../domain/excursions'
import { formatDate, formatTime } from '../../domain/cruise'
import { impactedOn } from '../../domain/recompose'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { t, th } from '../../i18n'
import { Card } from '../Card'
import { firstName } from './people'

/** The weather recomposer (QOL-15): pick a day the weather may touch, see which reservations are affected and what else fits. It changes nothing: no cancelling, no rebooking. */
export function RecomposerCard() {
  const plan = useMine(() => api.plan.overview())
  const booked = useMine(() => api.plan.excursions.list())
  const [day, setDay] = useState('')
  if (plan.status !== 'ready') return null
  const days = plan.data.days.filter((d) => d.entries.some((e) => (e.kind === 'tour' || e.kind === 'dinner') && e.id))
  if (days.length === 0) return null
  const chosen = days.find((d) => String(d.day) === day)
  const excursionIdOf = (id: string) => booked.data?.booked.find((b) => b.id === id)?.excursionId ?? null
  const impacted = impactedOn(chosen, EXCURSIONS, excursionIdOf)
  return (
    <Card labelledBy="rc-h">
      <h2 id="rc-h" className="card__title">{th('recompose.title')}</h2>
      <p>{t('recompose.intro')}</p>
      <div className="field">
        <label htmlFor="rc-day">{t('recompose.day')}</label>
        <select id="rc-day" className="field__input" value={day} onChange={(e) => setDay(e.target.value)}>
          <option value="">{t('recompose.pick')}</option>
          {days.map((d) => <option key={d.day} value={d.day}>{t('plan.day', { n: d.day })} · {formatDate(d.date)} · {d.place || t('plan.atSea')}</option>)}
        </select>
      </div>
      {chosen && (
        <ul className="plain-list" aria-live="polite">
          {impacted.map((i) => (
            <li key={`${i.kind}-${i.id}`}>
              <strong>{formatTime(i.time)}</strong> {t(i.kind === 'tour' ? 'plan.entry.tour' : 'plan.entry.dinner', { name: i.name })} <span className="muted">· {i.guests.map(firstName).join(', ')}</span>
              <p className="muted">{t(i.kind === 'tour' ? 'recompose.tour' : 'recompose.dinner')}</p>
              {i.alternatives.length > 0 && (
                <p>{t('recompose.instead')} {i.alternatives.map((a, n) => <span key={a.id}>{n > 0 ? ', ' : ''}<Link to={`/plan/excursions`}>{excursionById(a.id)?.name ?? a.name}</Link></span>)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="muted">{t('recompose.promise')}</p>
    </Card>
  )
}
