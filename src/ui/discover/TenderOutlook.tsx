import { formatDate } from '../../domain/cruise'
import { useTenderOutlook } from '../../hooks/useServedFeeds'
import { t, type StringKey } from '../../i18n'
import { Card } from '../Card'

/** How likely the tender boats are to run late at this port on the day the ship visits (X10b). Quiet until the server's answer is here. */
export function TenderOutlook({ port, date, headingId = 'tender-h' }: { port: string; date: string; headingId?: string }) {
  const outlook = useTenderOutlook(port, date)
  if (!outlook) return null
  return (
    <section aria-labelledby={headingId}>
      <Card info labelledBy={headingId}>
        <h2 id={headingId}>{t('tenderOutlook.title')}</h2>
        <p><strong>{t(`tenderOutlook.band.${outlook.band}` as StringKey)}</strong></p>
        <p>{t('tenderOutlook.chance', { percent: String(outlook.percent), date: formatDate(outlook.date) })}</p>
        <ul>{outlook.youCan.map((k) => <li key={k}>{t(`tenderOutlook.youCan.${k}` as StringKey)}</li>)}</ul>
        <p className="muted">{t('tenderOutlook.note')}</p>
      </Card>
    </section>
  )
}
