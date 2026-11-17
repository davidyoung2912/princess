import { Link } from 'react-router'
import type { BookingCardModel } from '../../domain/explorer/bookingState'
import { lineWords } from './lineWords'
import { t } from '../../i18n'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'

/**
 * What the guest can do in this Explorer and why, directly under the ship clock. A small card, not a page: the headline says whether Reserve is open
 * and a closed state always gives its reason and date, never a bare disabled button. Aboard, with nothing needing attention, it is one line.
 */
export function BookingCard({ model, labelledBy }: { model: BookingCardModel; labelledBy: string }) {
  if (model.compact) {
    const meals = model.facts.find((f) => f.key === 'bk.dining.mealsLeft')
    return meals ? <p className="muted">{lineWords(meals)}</p> : null
  }
  const kind = model.status === 'open' ? 'booked' : model.status === 'finished' ? 'soldOut' : 'ready'
  return (
    <Card labelledBy={labelledBy}>
      <h2 id={labelledBy} className="card__title">{lineWords(model.headline)}</h2>
      <p><StatusBadge kind={kind} label={model.canReserve ? t('explorers.open.now') : t('explorers.closed')} /></p>
      {model.detail && <p>{lineWords(model.detail)}</p>}
      {model.paymentsLink && <p><Link to="/me/payments">{t('route.payments')}</Link></p>}
      {model.facts.length > 0 && <ul className="tour__facts">{model.facts.map((f) => <li key={f.key}>{lineWords(f)}</li>)}</ul>}
    </Card>
  )
}
