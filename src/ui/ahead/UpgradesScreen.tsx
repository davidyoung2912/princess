import { useState } from 'react'
import { formatMoney } from '../../domain/pricing'
import { categoryById } from '../../domain/ship'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
import { Load } from '../account/parts'
import { formatDateTime } from '../account/format'
import { AheadError, Back, ChildNote } from './common'
import type { UpgradeOffer } from '../../domain/ahead'

function Offer({ offer, open, canEdit, reload }: { offer: UpgradeOffer; open: boolean; canEdit: boolean; reload: () => void }) {
  const [dollars, setDollars] = useState(Math.round((offer.minBid + (offer.buyNow - offer.minBid) / 2) / 100))
  const bid = useAction(async (cents: number) => { await api.ahead.upgrades.bid(offer.category, cents); reload() })
  const c = categoryById(offer.category)!
  const id = `bid-${offer.category}`
  return (
    <Card>
      <h3 className="card__title">{c.name}</h3>
      <p>{c.summary}</p>
      <p className="muted">{t('upg.diff', { amount: formatMoney(offer.difference) })}</p>
      {open && canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); void bid.run(dollars * 100) }}>
          <div className="field">
            <label htmlFor={id}>{t('upg.yourBid')}</label>
            <p className="field__hint">{t('upg.range', { min: formatMoney(offer.minBid), max: formatMoney(offer.buyNow) })}</p>
            <input id={id} className="field__input" type="number" inputMode="numeric" min={offer.minBid / 100} max={offer.buyNow / 100} step={1} value={dollars} onChange={(e) => setDollars(Number(e.target.value))} />
          </div>
          <AheadError error={bid.error} />
          <div className="button-row">
            <Button type="submit" variant="secondary" disabled={bid.busy}>{t('upg.bid')}<span className="visually-hidden"> {c.name}</span></Button>
            <Button disabled={bid.busy} onClick={() => void bid.run(offer.buyNow)}>{t('upg.buyNow', { amount: formatMoney(offer.buyNow) })}<span className="visually-hidden"> {c.name}</span></Button>
          </div>
        </form>
      )}
    </Card>
  )
}

/** Offer to move up a room type: bid for it, or pay the fixed price now (MNG-06). Nobody is pushed: the offer never interrupts a required task. */
export function UpgradesScreen() {
  const view = useMine(() => api.ahead.upgrades.view())
  const withdraw = useAction(async (id: string) => { await api.ahead.upgrades.withdraw(id); view.retry() })
  return (
    <div className="page">
      <h1>{t('route.upgrades')}</h1>
      <p>{t('upg.intro')}</p>
      <ChildNote />
      <Load state={view}>
        {(v) => (
          <>
            <p>{t('upg.current', { room: categoryById(v.current)!.name })}</p>
            {!v.open && <Banner kind="info" title={t('upg.closed')}><p>{t('upg.closedBody')}</p></Banner>}
            {v.offers.length === 0 ? <p>{t('upg.none')}</p> : (
              <ul className="card-grid">
                {v.offers.map((o) => <li key={o.category}><Offer offer={o} open={v.open} canEdit={v.canEdit} reload={view.retry} /></li>)}
              </ul>
            )}
            <p className="muted">{t('upg.how', { time: formatDateTime(v.decidedAt) })}</p>
            <AheadError error={withdraw.error} />
            <h2>{t('upg.yours')}</h2>
            {v.bids.length === 0 ? <p className="muted">{t('upg.noBids')}</p> : (
              <ul className="card-grid">
                {v.bids.map((b) => (
                  <li key={b.id}>
                    <Card>
                      <h3 className="card__title">{categoryById(b.category)!.name}: {formatMoney(b.cents)}</h3>
                      <p><StatusBadge kind={b.status === 'accepted' ? 'booked' : b.status === 'open' ? 'waitlist' : 'cancelled'} label={t(`upg.status.${b.status}` as StringKey)} /></p>
                      {b.status === 'open' && v.canEdit && <Button variant="tertiary" disabled={withdraw.busy} onClick={() => void withdraw.run(b.id)}>{t('upg.withdraw')}<span className="visually-hidden"> {categoryById(b.category)!.name}</span></Button>}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Load>
      <Back to="/plan" label={t('route.plan')} />
    </div>
  )
}
