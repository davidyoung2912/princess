import { Link } from 'react-router'
import { t, type StringKey } from '../../i18n'
import { calendarRows, type CalendarSailing } from '../../domain/priceCalendar'
import { formatMoney, type Cents } from '../../domain/money'
import { rangeOf, type BrowseSailing } from '../../domain/catalogueBrowse'

/** The sailings by date, each with its from-price as a bar (N-D1). The bar is decorative; the price is always written beside it. */
export function PriceCalendar({ sailings, priceOf, today }: { sailings: readonly BrowseSailing[]; priceOf: (id: string) => Cents | null; today: string }) {
  const rows = calendarRows(sailings as readonly CalendarSailing[], priceOf, today)
  const byId = new Map(sailings.map((s) => [s.id, s]))
  return (
    <section aria-label={t('pcal.view.calendar')}>
      <p className="muted">{t('pcal.intro')}</p>
      <ul className="price-cal">
        {rows.map((r) => {
          const s = byId.get(r.id)!
          return (
            <li key={r.id} className={`price-cal__row${r.badges.includes('hurricane') ? ' price-cal__row--storm' : ''}`}>
              <p className="price-cal__date"><Link to={`/home/sailings/${r.id}`}>{rangeOf(s)}<span className="visually-hidden">, {s.title}</span></Link></p>
              <div className="price-cal__bar" aria-hidden="true"><span style={{ width: `${r.barPercent}%` }} /></div>
              <p className="price-cal__price">{r.price === null ? t('pcal.noPrice') : t('pcal.price', { price: formatMoney(r.price) })}</p>
              <p className="muted">{r.weeksAway === null ? t('pcal.leftPort') : t('pcal.weeks', { count: r.weeksAway })}</p>
              {r.badges.length > 0 && <p>{r.badges.map((b) => <span key={b} className={`tag${b === 'cheapest' || b === 'bestValue' ? ' tag--good' : ''}`}>{t(`pcal.badge.${b}` as StringKey)}</span>)}</p>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
