import { CANCEL_ROWS, FREE_CANCEL_HOURS, FREE_CANCEL_MIN_DAYS, type CancelTier } from '../../domain/policy'
import { t } from '../../i18n'

/** When cancelling costs what, as a table so each row reads as days, then fee (BOK-08). The row that applies now is marked. */
export function CancellationTable({ current }: { current?: CancelTier }) {
  return (
    <table className="price-table">
      <caption>{t('book.cancel.caption')}</caption>
      <thead>
        <tr><th scope="col">{t('book.cancel.when')}</th><th scope="col">{t('book.cancel.fee')}</th></tr>
      </thead>
      <tbody>
        <tr aria-current={current === 'free24h' ? 'true' : undefined}>
          <th scope="row">{t('book.cancel.free24h', { hours: FREE_CANCEL_HOURS, days: FREE_CANCEL_MIN_DAYS })}</th>
          <td>{t('book.cancel.none')}{current === 'free24h' && <span className="tag">{t('book.cancel.now')}</span>}</td>
        </tr>
        {CANCEL_ROWS.map((r) => (
          <tr key={r.tier} aria-current={current === r.tier ? 'true' : undefined}>
            <th scope="row">{r.max === null ? t('book.cancel.rangeMore', { min: r.min }) : t('book.cancel.range', { min: r.min, max: r.max })}</th>
            <td>
              {r.share === 'deposit' ? t('book.cancel.deposit') : t('book.cancel.share', { percent: Math.round(r.share * 100) })}
              {current === r.tier && <span className="tag">{t('book.cancel.now')}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
