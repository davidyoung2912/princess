import { useState } from 'react'
import { Link } from 'react-router'
import { t, type StringKey } from '../../i18n'
import { calendarRows, compareRows, type CalendarSailing } from '../../domain/priceCalendar'
import { formatMoney, type Cents } from '../../domain/money'
import { rangeOf, type BrowseSailing } from '../../domain/catalogueBrowse'
import { Button } from '../Button'

/** The sailings by date, each with its from-price as a bar (N-D1). The bar is decorative; the price is always written beside it. Pick two to compare. */
export function PriceCalendar({ sailings, priceOf, today }: { sailings: readonly BrowseSailing[]; priceOf: (id: string) => Cents | null; today: string }) {
  const [picked, setPicked] = useState<string[]>([])
  const rows = calendarRows(sailings as readonly CalendarSailing[], priceOf, today)
  const byId = new Map(sailings.map((s) => [s.id, s]))
  const chosen = picked.filter((id) => byId.has(id))
  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur.filter((x) => byId.has(x)), id].slice(-2)))
  const pair = chosen.length === 2 ? chosen.map((id) => ({ row: rows.find((r) => r.id === id)!, s: byId.get(id)! })) : null
  const cmp = pair ? compareRows(pair[0].row, pair[1].row) : null
  return (
    <section aria-label={t('pcal.view.calendar')}>
      <p className="muted">{t('pcal.intro')}</p>
      <p className="muted">{t('pcal.pickHint')}</p>
      {pair && cmp && (
        <section className="price-cal__compare" aria-labelledby="pcal-compare" aria-live="polite">
          <h2 id="pcal-compare">{t('pcal.compare.title')}</h2>
          <p>{t('pcal.compare.first', { range: rangeOf(pair[0].s) })}{cmp.firstPrice !== null && ` (${t('pcal.price', { price: formatMoney(cmp.firstPrice) })})`}</p>
          <p>{t('pcal.compare.second', { range: rangeOf(pair[1].s) })}{cmp.secondPrice !== null && ` (${t('pcal.price', { price: formatMoney(cmp.secondPrice) })})`}</p>
          {cmp.cheaper === null && <p>{t('pcal.compare.noPrice')}</p>}
          {cmp.cheaper === 'same' && <p>{t('pcal.compare.same')}</p>}
          {(cmp.cheaper === 'first' || cmp.cheaper === 'second') && cmp.difference !== null && (
            <p>{t(cmp.cheaper === 'first' ? 'pcal.compare.cheaperFirst' : 'pcal.compare.cheaperSecond', { amount: formatMoney(Math.abs(cmp.difference)) })}</p>
          )}
          {cmp.perNightDifference !== null && cmp.perNightDifference !== 0 && (
            <p>{t('pcal.compare.perNight', { amount: formatMoney(Math.abs(cmp.perNightDifference)), direction: t(cmp.perNightDifference > 0 ? 'pcal.compare.more' : 'pcal.compare.less') })}</p>
          )}
          <Button variant="tertiary" onClick={() => setPicked([])}>{t('pcal.compare.clear')}</Button>
        </section>
      )}
      <ul className="price-cal">
        {rows.map((r) => {
          const s = byId.get(r.id)!
          return (
            <li key={r.id} className={`price-cal__row${r.badges.includes('hurricane') ? ' price-cal__row--storm' : ''}`}>
              <p className="price-cal__date"><Link to={`/home/sailings/${r.id}`}>{rangeOf(s)}<span className="visually-hidden">, {s.title}</span></Link></p>
              <div className="price-cal__bar" aria-hidden="true"><span style={{ width: `${r.barPercent}%` }} /></div>
              <p className="price-cal__price">{r.price === null ? t('pcal.noPrice') : t('pcal.price', { price: formatMoney(r.price) })}</p>
              <p className="muted">{r.weeksAway === null ? t('pcal.leftPort') : t('pcal.weeks', { count: r.weeksAway })}</p>
              {r.badges.length > 0 && <p>{r.badges.map((b) => <span key={b} className={`tag${b === 'cheapest' || b === 'bestValue' || b === 'quieter' ? ' tag--good' : ''}`}>{t(`pcal.badge.${b}` as StringKey)}</span>)}</p>}
              <label className="choice"><input type="checkbox" checked={chosen.includes(r.id)} onChange={() => toggle(r.id)} />{t('pcal.pick', { date: rangeOf(s) })}</label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
