import { stormWatch } from '../../domain/storm'
import { formatDate } from '../../domain/cruise'
import { dateIn } from '../../domain/timezones'
import { daysBetween } from '../../domain/trip'
import { useNow, useSailing } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { BackLink } from '../onboard/common'
import { Link } from 'react-router'

/** Storm watch (S3-04): how likely a storm is to touch this sailing, what the line may do and what you can do. Calm, worked out, and never an alert. */
export function StormScreen() {
  const sailing = useSailing()
  const today = dateIn(useNow(), 'America/New_York')
  const r = stormWatch(sailing, daysBetween(today, sailing.departure))
  return (
    <div className="page">
      <BackLink to="/plan" label={t('route.plan')} />
      <h1>{t('route.storm')}</h1>
      <p>{t('storm.intro')}</p>
      <Banner kind="info" title={t('storm.sim')} />
      <Card labelledBy="storm-now">
        <h2 id="storm-now" className="card__title">{t(`storm.band.${r.band}` as StringKey)}</h2>
        <p>{t('storm.dates', { from: formatDate(r.departure), to: formatDate(r.returns) })}</p>
        <p>{t(r.inSeason ? 'storm.season' : 'storm.offSeason')}</p>
        {r.percent > 0 && <p>{t('storm.chance', { percent: r.percent })}</p>}
        {r.peak && <p>{t('storm.peak')}</p>}
        <p><strong>{t(`storm.phase.${r.phase}` as StringKey)}</strong></p>
      </Card>
      {r.lineMay.length > 0 && (
        <Card labelledBy="storm-line">
          <h2 id="storm-line" className="card__title">{t('storm.lineMay')}</h2>
          <ul className="plain-list">{r.lineMay.map((k) => <li key={k}>{t(`storm.line.${k}` as StringKey)}</li>)}</ul>
          <p className="muted">{t('storm.terms')}</p>
        </Card>
      )}
      {r.youCan.length > 0 && (
        <Card labelledBy="storm-you">
          <h2 id="storm-you" className="card__title">{t('storm.youCan')}</h2>
          <ul className="plain-list">{r.youCan.map((k) => <li key={k}>{t(`storm.you.${k}` as StringKey)}</li>)}</ul>
        </Card>
      )}
      <p><Link to="/plan/what-if">{t('route.whatIf')}</Link> · <Link to="/home/disruption">{t('route.disruption')}</Link></p>
    </div>
  )
}
