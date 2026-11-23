import { useState } from 'react'
import type { ExcursionOffer, ExcursionsView } from '../../../api/types'
import { formatDate } from '../../../domain/cruise'
import { ACTIVITIES, EXCURSIONS, type ExcursionPort } from '../../../domain/excursions'
import { fitTours, NO_FIT, type FitAnswers } from '../../../domain/excursionFit'
import { t, th, type StringKey } from '../../../i18n'
import { Button } from '../../Button'
import { FieldLabel } from '../../Field'
import { portLabel } from '../../plan/portLabel'

const PRICES = [50, 75, 100]
const PORTS = [...new Set(EXCURSIONS.map((e) => e.port))]

/** "Which tour fits me?": four questions and the best matches, each with the reasons and a way to add it to the cart. */
export function TourFit({ view, busy, onAdd }: { view: ExcursionsView; busy: boolean; onAdd: (o: ExcursionOffer) => void }) {
  const [fit, setFit] = useState<FitAnswers | null>(null)
  const matches = fit ? fitTours(view.offers, fit) : []
  return (
    <section aria-labelledby="fit-h">
      <h2 id="fit-h">{th('exc.fit.title')}</h2>
      <p>{t('exc.fit.intro')}</p>
      <div className="filters">
        <div className="field">
          <FieldLabel htmlFor="fit-active" help={t('helptip.activeFit')}>{t('exc.fit.active')}</FieldLabel>
          <select id="fit-active" value={fit?.activity ?? ''} onChange={(e) => setFit({ ...(fit ?? NO_FIT), activity: e.target.value as FitAnswers['activity'] })}>
            {!fit && <option value="">{t('exc.fit.choose')}</option>}
            {ACTIVITIES.map((a) => <option key={a} value={a}>{t(`exc.fit.active.${a}` as StringKey)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fit-spend">{t('exc.fit.spend')}</label>
          <select id="fit-spend" value={fit?.maxPrice ?? ''} onChange={(e) => setFit({ ...(fit ?? NO_FIT), maxPrice: e.target.value ? Number(e.target.value) : null })}>
            <option value="">{t('exc.f.any')}</option>
            {PRICES.map((p) => <option key={p} value={p}>{t('exc.f.under', { amount: `$${p}` })}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fit-who">{t('exc.fit.who')}</label>
          <select id="fit-who" value={fit?.who ?? 'adults'} onChange={(e) => setFit({ ...(fit ?? NO_FIT), who: e.target.value as FitAnswers['who'] })}>
            {(['adults', 'children', 'wheelchair'] as const).map((w) => <option key={w} value={w}>{t(`exc.fit.who.${w}` as StringKey)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fit-port">{t('exc.f.port')}</label>
          <select id="fit-port" value={fit?.port ?? ''} onChange={(e) => setFit({ ...(fit ?? NO_FIT), port: (e.target.value || null) as ExcursionPort | null })}>
            <option value="">{t('exc.f.all')}</option>
            {PORTS.map((p) => <option key={p} value={p}>{portLabel(p)}</option>)}
          </select>
        </div>
      </div>
      {fit && (
        <div role="status">
          {matches.length === 0 ? <p>{t('exc.fit.none')}</p> : (
            <ol className="card-grid">
              {matches.slice(0, 5).map((m) => (
                <li key={m.offer.item.id} className="card">
                  <h3 className="card__title">{m.offer.item.name}</h3>
                  <p className="muted">{portLabel(m.offer.item.port)} · {formatDate(m.offer.date)}</p>
                  <p>{m.reasons.join(', ')}.</p>
                  {view.canBook && <Button disabled={busy || view.cart.some((l) => l.excursionId === m.offer.item.id)} onClick={() => onAdd(m.offer)}>{t('exc.addToCart')}<span className="visually-hidden"> {m.offer.item.name}</span></Button>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
