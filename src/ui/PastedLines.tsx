import { useMemory } from '../hooks/useMemory'
import { t } from '../i18n'
import { Card } from './Card'

/**
 * The lines the guest kept from a pasted plan (S0-07) that belong to this day, beside the day's own plan. They are the guest's words,
 * not bookings: nothing here is added to the plan, the bill or a clash check.
 */
export function PastedLines({ day }: { day: number }) {
  const { state } = useMemory()
  const mine = state.pasted.filter((l) => l.day === day)
  if (mine.length === 0) return null
  return (
    <Card labelledBy={`pasted-${day}`}>
      <h2 id={`pasted-${day}`} className="card__title">{t('paste.today')}</h2>
      <ul className="plain-bullets">{mine.map((l) => <li key={l.text}>{l.text}</li>)}</ul>
      <p className="muted">{t('paste.todayNote')}</p>
    </Card>
  )
}
