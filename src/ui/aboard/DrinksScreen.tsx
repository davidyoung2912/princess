import { Link } from 'react-router'
import { formatMoney } from '../../domain/pricing'
import { ALERT_AFTER, ALERT_WINDOW_MIN, BAR_MENU, DAILY_PACKAGE_DRINKS, STOP_AFTER, drinkById } from '../../domain/services'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { useShipTime } from '../onboard/shipTime'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Load } from '../account/parts'
import { AboardError, Back } from './common'

/** The bar menu and a drinks tracker (DIN-06): what you have had today, what the package covers, and a nudge to slow down. */
export function DrinksScreen() {
  const view = useMine(() => api.aboard.drinks.view())
  const shipTime = useShipTime()
  const log = useAction(async (id: string) => { await api.aboard.drinks.log(id); view.retry() })
  const undo = useAction(async (id: string) => { await api.aboard.drinks.undo(id); view.retry() })
  return (
    <div className="page">
      <h1>{t('route.drinks')}</h1>
      <p>{t('drk.intro')}</p>
      <Load state={view}>
        {(v) => (
          <>
            {v.summary.alert === 'stop' && <Banner kind="danger" title={t('drk.stop')}><p>{t('drk.stopBody', { count: STOP_AFTER, hours: ALERT_WINDOW_MIN / 60 })}</p></Banner>}
            {v.summary.alert === 'slow' && <Banner kind="warning" title={t('drk.slow')}><p>{t('drk.slowBody', { count: ALERT_AFTER, hours: ALERT_WINDOW_MIN / 60 })}</p></Banner>}
            <Card labelledBy="drk-sum">
              <h2 id="drk-sum" className="card__title">{t('drk.today')}</h2>
              <dl className="facts">
                <div><dt>{t('drk.had')}</dt><dd>{v.summary.today}</dd></div>
                <div><dt>{t('drk.package')}</dt><dd>{v.capUsd > 0 ? t('drk.cap', { cap: v.capUsd, left: v.summary.left ?? 0, max: DAILY_PACKAGE_DRINKS }) : t('drk.noPackage')}</dd></div>
                <div><dt>{t('drk.paid')}</dt><dd>{formatMoney(v.summary.paid)}</dd></div>
              </dl>
              {v.capUsd === 0 && <p><Link to="/me/packages">{t('route.packages')}</Link></p>}
              <p className="muted">{t('drk.note')}</p>
            </Card>
            <AboardError error={log.error ?? undo.error} />
            <ul className="card-grid">
              {BAR_MENU.map((d) => {
                const covered = v.capUsd * 100 >= d.cents && v.capUsd > 0
                const blocked = d.alcohol && !v.adult
                return (
                  <li key={d.id}>
                    <Card>
                      <h3 className="card__title">{t(`drk.d.${d.id}` as StringKey)}</h3>
                      <p className="muted">{formatMoney(d.cents)}{d.alcohol ? ` · ${t('drk.alcohol')}` : ''}{covered ? ` · ${t('drk.covered')}` : ''}</p>
                      {blocked ? <p className="muted">{t('drk.age')}</p> : <Button variant="secondary" disabled={log.busy} onClick={() => void log.run(d.id)}>{t('drk.add')}</Button>}
                    </Card>
                  </li>
                )
              })}
            </ul>
            <h2>{t('drk.log')}</h2>
            {v.logs.length === 0 ? <p className="muted">{t('drk.none')}</p> : (
              <ul className="plain-bullets">
                {v.logs.map((l) => (
                  <li key={l.id}>{t(`drk.d.${drinkById(l.drinkId)?.id ?? 'soda'}` as StringKey)} · {shipTime(l.at)} <Button variant="tertiary" disabled={undo.busy} onClick={() => void undo.run(l.id)}>{t('drk.undo')}</Button></li>
                ))}
              </ul>
            )}
          </>
        )}
      </Load>
      <Back to="/ship" label={t('route.ship')} />
    </div>
  )
}
