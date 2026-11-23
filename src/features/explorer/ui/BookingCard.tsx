import { Link } from 'react-router'
import type { BookingCardModel } from '../domain/bookingState'
import { lineWords } from './lineWords'
import { t } from '../../../shared/i18n'
import { Card } from '../../../shared/ui/Card'
import { StatusBadge } from '../../../shared/ui/StatusBadge'
import { StanleyExplain } from '../../stanley/ui/StanleyExplain'

/**
 * What the guest can do in this Explorer and why, directly under the ship clock. A small card, not a page: the headline says whether Reserve is open
 * and a closed state always gives its reason and date, never a bare disabled button. Aboard, with nothing needing attention, it is one line.
 */
export function BookingCard({ model, labelledBy, tour }: { model: BookingCardModel; labelledBy: string; tour?: string }) {
  if (model.compact) {
    const meals = model.facts.find((f) => f.key === 'bk.dining.mealsLeft')
    return meals ? <p className="muted">{lineWords(meals)}</p> : null
  }
  const kind = model.status === 'open' ? 'booked' : model.status === 'finished' ? 'soldOut' : 'ready'
  return (
    <Card labelledBy={labelledBy} tour={tour}>
      <h2 id={labelledBy} className="card__title">{lineWords(model.headline)}</h2>
      <p><StatusBadge kind={kind} label={model.canReserve ? t('explorers.open.now') : t('explorers.closed')} /></p>
      {model.detail && <p>{lineWords(model.detail)}</p>}
      {model.paymentsLink && <p><Link to="/me/payments">{t('route.payments')}</Link></p>}
      {model.facts.length > 0 && <ul className="tour__facts">{model.facts.map((f) => <li key={f.key}>{lineWords(f)}{f.key === 'bk.dining.anytime' && <> <StanleyExplain term="anytimeDining" /></>}</li>)}</ul>}
    </Card>
  )
}
