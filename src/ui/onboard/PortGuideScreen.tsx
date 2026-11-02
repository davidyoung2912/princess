import { useState } from 'react'
import { Link } from 'react-router'
import { portDayAt } from '../../domain/allaboard'
import { usePortCrowd } from '../../hooks/useServedFeeds'
import { GUIDE_PORTS, PORT_KNOWLEDGE, perPerson, type GuidePort } from '../../domain/portContent'
import { PORTS } from '../../domain/sailings'
import { useNow, useSailing } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { BackLink } from './common'

/** Port know-how (S6A-03, S6A-07 to S6A-13): fair prices and scam alerts, safety and local rules, phrases and allergy cards, walks, day passes, family notes and local vendors. Authored concept content (verify before real use). */
export function PortGuideScreen() {
  const sailing = useSailing()
  const now = useNow()
  const next = portDayAt(sailing, now)?.port
  const [port, setPort] = useState<GuidePort>(next && GUIDE_PORTS.includes(next) ? next : 'cozumel')
  const k = PORT_KNOWLEDGE[port]
  const day = portDayAt(sailing, now)
  const served = usePortCrowd(port, day?.date ?? '')
  const crowd = day && day.port === port ? served : null

  return (
    <div className="page">
      <h1>{t('route.portGuide')}</h1>
      <p>{t('guide.intro')}</p>
      <Banner kind="info" title={t('guide.verify')}><p>{t('guide.verifyBody')}</p></Banner>
      <fieldset>
        <legend>{t('guide.port')}</legend>
        {GUIDE_PORTS.map((p) => <label key={p} className="choice"><input type="radio" name="guide-port" checked={port === p} onChange={() => setPort(p)} /><span>{PORTS[p].name}</span></label>)}
      </fieldset>

      <Card labelledBy="g-price">
        <h2 id="g-price" className="card__title">{t('guide.price')}</h2>
        <div className="table-wrap"><table className="bill-table">
          <caption className="visually-hidden">{t('guide.price')}</caption>
          <thead><tr><th scope="col">{t('guide.price.route')}</th><th scope="col">{t('guide.price.car')}</th><th scope="col">{t('guide.price.each')}</th><th scope="col">{t('guide.price.ceiling')}</th></tr></thead>
          <tbody>{k.fairPrices.map((p) => <tr key={p.route}><th scope="row">{p.route}</th><td>${p.car}</td><td>${perPerson(p, 4)}</td><td>${p.ceiling}</td></tr>)}</tbody>
        </table></div>
        <p className="muted">{t('guide.price.note')}</p>
        <h3>{t('guide.stand')}</h3>
        <p>{k.taxiStand}</p>
        <h3>{t('guide.scams')}</h3>
        <ul className="plain-bullets">{k.scams.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="muted">{t('guide.scams.calm')}</p>
      </Card>

      <Card labelledBy="g-safe">
        <h2 id="g-safe" className="card__title">{t('guide.safety')}</h2>
        {crowd?.stayAboardNote && <Banner kind="info" title={t('crowd.stayAboard')}><p>{t('crowd.stayAboardBody')}</p></Banner>}
        <ul className="plain-bullets">{k.advisories.map((x) => <li key={x}>{x}</li>)}</ul>
        <h3>{t('guide.laws')}</h3>
        <ul className="plain-bullets">{k.laws.map((x) => <li key={x}>{x}</li>)}</ul>
        <h3>{t('guide.return')}</h3>
        <p>{t('guide.return.body')}</p>
      </Card>

      <Card labelledBy="g-bring">
        <h2 id="g-bring" className="card__title">{t('guide.bring')}</h2>
        <ul className="plain-bullets">{k.dontBringBack.map((x) => <li key={x}>{x}</li>)}</ul>
        <p><Link to="/home/disembark/customs">{t('route.customs')}</Link></p>
      </Card>

      <Card labelledBy="g-talk">
        <h2 id="g-talk" className="card__title">{t('guide.talk')}</h2>
        <p className="muted">{t('guide.talk.note')}</p>
        <dl className="plain-dl">{k.phrases.map((p) => <div key={p.say}><dt lang={port === 'belize' ? 'en' : 'es'}>{p.say}</dt><dd>{p.means} <span className="muted">({p.sounds})</span></dd></div>)}</dl>
        <h3>{t('guide.etiquette')}</h3>
        <ul className="plain-bullets">{k.etiquette.map((x) => <li key={x}>{x}</li>)}</ul>
        <h3>{t('guide.allergy')}</h3>
        {k.allergy.map((a) => (
          <div key={a.language} className="card card--info">
            <p className="muted">{t('guide.allergy.card', { allergy: a.allergy, language: a.language })}</p>
            <p lang={a.language.startsWith('Spanish') ? 'es' : 'en'}>{a.text}</p>
            <p className="muted">{a.english}</p>
          </div>
        ))}
      </Card>

      <Card labelledBy="g-walk">
        <h2 id="g-walk" className="card__title">{t('guide.walks')}</h2>
        <p className="muted">{t('guide.walks.note')}</p>
        {k.walks.map((w) => (
          <div key={w.id}>
            <h3>{w.name} <span className="muted">({t('guide.walks.minutes', { minutes: w.minutes })})</span></h3>
            <p>{w.step}</p>
            <dl className="plain-dl">
              <div><dt>{t('guide.walks.access')}</dt><dd>{w.accessible}</dd></div>
              <div><dt>{t('guide.walks.sit')}</dt><dd>{w.sit}</dd></div>
              <div><dt>{t('guide.walks.restroom')}</dt><dd>{w.restroom}</dd></div>
            </dl>
          </div>
        ))}
      </Card>

      <Card labelledBy="g-pass">
        <h2 id="g-pass" className="card__title">{t('guide.pass')}</h2>
        <p className="muted">{t('guide.pass.note')}</p>
        <ul className="plain-bullets">{k.dayPasses.map((p) => <li key={p.id}>{t('guide.pass.line', { name: p.name, price: p.price, distance: p.distance, crowd: t(`crowd.level.${p.crowd}` as StringKey) })}</li>)}</ul>
      </Card>

      <Card labelledBy="g-kids">
        <h2 id="g-kids" className="card__title">{t('guide.kids')}</h2>
        <ul className="plain-bullets">{k.kids.map((x) => <li key={x}>{x}</li>)}</ul>
      </Card>

      <Card labelledBy="g-local">
        <h2 id="g-local" className="card__title">{t('guide.local')}</h2>
        <p className="muted">{t('guide.local.note')}</p>
        <ul className="plain-bullets">{k.vendors.map((x) => <li key={x.name}>{x.name}: {x.what}</li>)}</ul>
        <h3>{t('guide.souvenirs')}</h3>
        <ul className="plain-bullets">{k.souvenirs.map((x) => <li key={x.item}>{x.item}: {x.fair}</li>)}</ul>
        <p className="muted">{t('guide.local.reef')}</p>
      </Card>

      <BackLink to="/ship/port" label={t('route.portDay')} />
    </div>
  )
}
