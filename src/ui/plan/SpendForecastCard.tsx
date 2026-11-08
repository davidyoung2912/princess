import { Link } from 'react-router'
import { api } from '../../runtime'
import { formatMoney } from '../../domain/money'
import { spendForecast, type SpendLine } from '../../domain/spendForecast'
import { useMemory } from '../../hooks/useMemory'
import { useMine } from '../../hooks/useMine'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Card } from '../Card'

/** What is bought or planned before sailing, by category, against the trip budget (N-P2). */
export function SpendForecastCard() {
  const { state: memory } = useMemory()
  const data = useMine(async () => {
    const [packages, excursions, dining] = await Promise.all([api.plan.packages.view(), api.plan.excursions.list(), api.plan.dining.view()])
    return { packages, excursions, dining }
  })
  if (data.status !== 'ready') return null
  const { packages, excursions, dining } = data.data
  const lines: SpendLine[] = [
    ...packages.purchases.filter((p) => p.status === 'active').map((p): SpendLine => ({ category: p.kind === 'upgrade' ? 'upgrades' : 'packages', cents: p.total, planned: false })),
    ...excursions.booked.filter((b) => b.status === 'booked').map((b): SpendLine => ({ category: 'excursions', cents: b.total - b.credit, planned: false })),
    { category: 'excursions', cents: excursions.cartTotal - excursions.creditApplied, planned: true },
    ...dining.reservations.map((r): SpendLine => ({ category: 'dining', cents: r.charge, planned: false })),
  ]
  const f = spendForecast(lines, memory.budget)
  const s = f.status
  return (
    <Card labelledBy="spend-h">
      <h2 id="spend-h" className="card__title">{th('spend.title')}</h2>
      {f.total === 0 ? <p>{t('spend.none')}</p> : (
        <>
          <p><strong>{t('spend.total', { total: formatMoney(f.total) })}</strong> {f.planned > 0 && <span className="muted">{t('spend.planned', { planned: formatMoney(f.planned) })}</span>}</p>
          <ul>
            {f.categories.map((c) => (
              <li key={c.category}>
                {t(`spend.cat.${c.category}` as StringKey)}: {formatMoney(c.total)}
                <progress className="meter" max={100} value={c.share} aria-label={t('spend.share', { category: t(`spend.cat.${c.category}` as StringKey), percent: c.share })} />
              </li>
            ))}
          </ul>
        </>
      )}
      {s.limit === null
        ? <p className="muted">{t('spend.noBudget')} <Link to="/home/cruise/cost">{t('route.tripCost')}</Link></p>
        : s.state === 'over'
          ? <Banner kind="warning" title={t('spend.over', { over: formatMoney(s.spent - s.limit) })} />
          : <Banner kind="info" title={t(s.state === 'near' ? 'spend.near' : 'spend.left', { left: formatMoney(s.left), percent: s.percent })} />}
    </Card>
  )
}
