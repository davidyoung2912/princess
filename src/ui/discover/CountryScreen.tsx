import { Link, useParams } from 'react-router'
import { t, th, type StringKey } from '../../i18n'
import type { CountryGuideData } from '../../domain/countryGuide'
import { useCountryGuide } from '../../hooks/useServedFeeds'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { FeedWaiting } from '../FeedWaiting'
import { Flag } from '../Flag'

/**
 * Country Details: what the country guide holds for one country or territory (reached from the country name on a Port Details page): a summary, how it
 * is governed, its economy, a short history, people to know, culture, links to read more and the ports that call there. A place that is not a sovereign
 * state says so under its name.
 */
export function CountryScreen() {
  const { id = '' } = useParams()
  const valid = /^[a-z]{2}$/.test(id)
  const guide = useCountryGuide(valid ? id : '')
  if (!valid) {
    return (
      <div className="page">
        <Banner kind="warning" title={t('country.notFound')} action={<Link to="/home/ports">{t('country.back')}</Link>}><p>{t('country.notFoundBody')}</p></Banner>
      </div>
    )
  }
  return (
    <div className="page port-details">
      {guide ? <h2><Flag code={guide.id} />{guide.name}</h2> : <h2><Flag code={id} />{id.toUpperCase()}</h2>}
      {guide?.status && <p><span className="tag tag--alert">{t('country.status')}</span> {guide.status}</p>}
      {guide?.region && <p className="muted">{t('country.region', { region: guide.region })}</p>}
      {!guide && <FeedWaiting />}
      {guide && <CountryBody guide={guide} />}
      <p><Link to="/home/countries">{t('country.list.all')}</Link> · <Link to="/home/ports">{t('country.back')}</Link></p>
    </div>
  )
}

function CountryBody({ guide }: { guide: CountryGuideData }) {
  const all: { id: string; label: StringKey; body: string }[] = [
    { id: 'cd-gov-h', label: 'country.government', body: guide.government },
    { id: 'cd-eco-h', label: 'country.economy', body: guide.economy },
    { id: 'cd-history-h', label: 'country.history', body: guide.timeline },
    { id: 'cd-people-h', label: 'country.people', body: guide.people },
    { id: 'cd-culture-h', label: 'country.culture', body: guide.culture },
  ]
  const text = all.filter((s) => s.body)
  const jumps: { id: string; label: StringKey }[] = [
    ...text.map((s) => ({ id: s.id, label: s.label })),
    ...(guide.ports.length > 0 ? [{ id: 'cd-ports-h', label: 'country.ports' as StringKey }] : []),
    ...(guide.links.length > 0 ? [{ id: 'cd-links-h', label: 'country.links' as StringKey }] : []),
  ]
  return (
    <>
      {guide.atAGlance && <p className="port-details__lead"><strong>{t('country.glance')}.</strong> {guide.atAGlance}</p>}
      {guide.freedom && <p><strong>{t('country.freedom')}:</strong> {guide.freedom}</p>}

      {jumps.length > 1 && (
        <nav aria-label={t('country.jump')}>
          <ul className="naut-jump">
            {jumps.map((j) => <li key={j.id}><a href={`#${j.id}`} onClick={(e) => { e.preventDefault(); const el = document.getElementById(j.id); el?.scrollIntoView({ block: 'start' }); el?.focus() }}>{t(j.label)}</a></li>)}
          </ul>
        </nav>
      )}

      {text.map((s, i) => (
        <section key={s.id} aria-labelledby={s.id}>
          {i === 0 ? <Card info labelledBy={s.id}><h2 id={s.id} tabIndex={-1}>{th(s.label)}</h2><p>{s.body}</p></Card> : <><h2 id={s.id} tabIndex={-1}>{th(s.label)}</h2><p>{s.body}</p></>}
        </section>
      ))}

      {guide.ports.length > 0 && (
        <section aria-labelledby="cd-ports-h">
          <h2 id="cd-ports-h" tabIndex={-1}>{th('country.ports')}</h2>
          {guide.cruiseCalls && <p className="muted">{guide.cruiseCalls}</p>}
          <ul>{guide.ports.map((p) => <li key={p.id}><Link to={`/home/ports/${p.id}`}>{p.name}</Link></li>)}</ul>
        </section>
      )}

      {guide.links.length > 0 && (
        <section aria-labelledby="cd-links-h">
          <h2 id="cd-links-h" tabIndex={-1}>{th('country.links')}</h2>
          <ul>{guide.links.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer">{l.label}<span className="visually-hidden"> {t('portguide.newTab')}</span></a></li>)}</ul>
        </section>
      )}
      <p className="muted">{t('country.verify')}</p>
    </>
  )
}
