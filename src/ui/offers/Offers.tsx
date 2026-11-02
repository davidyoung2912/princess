import { Link } from 'react-router'
import { marketingPaused, offersQuiet } from '../../domain/finishMore'
import { useMemory } from '../../hooks/useMemory'
import { homeOffer, offerModeOf, offerReasons, offerStageOf, offersFor, dismissedFor, MARKETING_WEEKLY_CAP, type OfferContext, type OfferDef } from '../../domain/offers'
import { stageAt } from '../../domain/sailings'
import { api } from '../../runtime'
import { useNow, usePersona, useSailing } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { useOffers } from '../../hooks/useOffers'
import { useSettings } from '../../hooks/useSettings'
import { t, type StringKey } from '../../i18n'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { Load } from '../account/parts'
import { Back } from '../ahead/common'

/** The part of the offer context that comes from who the guest is and where the trip is. */
function useOfferContext(trip: string | null): OfferContext & { stageId: ReturnType<typeof stageAt> } {
  const me = usePersona()
  const sailing = useSailing()
  const now = useNow()
  const { state } = useOffers()
  const { state: mem } = useMemory()
  const stageId = stageAt(sailing, now)
  return { mode: offerModeOf(mem.finish), stage: offerStageOf(stageId), stageId, tier: me?.tier ?? 'none', package: me?.package ?? 'none', dismissed: trip ? state.dismissed[trip] ?? [] : [] }
}

/** One offer: what it is, where it goes, and "Not for this trip". No timers and no talk of stock. */
function OfferItem({ offer, trip, onDismiss, ctx }: { offer: OfferDef; trip: string; onDismiss: (trip: string, id: OfferDef['id']) => void; ctx: OfferContext }) {
  const id = `offer-${offer.id}-h`
  return (
    <Card labelledBy={id}>
      <h3 id={id} className="card__title">{t(`offer.${offer.id}.title` as StringKey)}</h3>
      <p>{t(`offer.${offer.id}.body` as StringKey)}</p>
      <details className="explain">
        <summary>{t('offer.whyOpen')}<span className="visually-hidden"> {t(`offer.${offer.id}.title` as StringKey)}</span></summary>
        <ul className="plain-bullets">{offerReasons(offer, ctx).map((r) => <li key={r}>{t(`offer.why.${r}` as StringKey)}</li>)}</ul>
        <p className="muted">{t('offer.whyNothingElse')}</p>
      </details>
      <div className="button-row">
        <LinkButton to={offer.to} variant="secondary">{t('offer.see')}</LinkButton>
        <Button variant="secondary" onClick={() => onDismiss(trip, offer.id)}>{t('offer.dismiss')}</Button>
      </div>
    </Card>
  )
}

/** The one contextual card on Home. It is not shown while anything required waits, at embarkation, or at checkout (UX-02). */
export function HomeOfferCard() {
  const trips = useMine(() => api.trips.list())
  const trip = trips.data ? trips.data.upcoming.find((x) => x.kind === 'current') ?? trips.data.upcoming[0] ?? null : null
  const ctx = useOfferContext(trip?.number ?? null)
  const { dismiss } = useOffers()
  const [settings] = useSettings()
  const { state: mem } = useMemory()
  const cases = useMine(() => api.cases.list())
  if (!trip || settings.nudgesPerDay === 0 || settings.calm || offersQuiet(mem.finish)) return null
  if (cases.data && marketingPaused(cases.data.cases)) {
    return (
      <section aria-labelledby="home-offer-h">
        <h2 id="home-offer-h" className="muted">{t('offer.paused')}</h2>
        <p>{t('offer.pausedBody')} <Link to="/me/contact">{t('route.contact')}</Link></p>
      </section>
    )
  }
  const offer = homeOffer({ ...ctx, taskWaiting: trip.next !== 'allSet' })
  if (!offer) return null
  return (
    <section aria-labelledby="home-offer-h">
      <h2 id="home-offer-h" className="muted">{t('offer.homeHeading')}</h2>
      <OfferItem offer={offer} trip={trip.number} onDismiss={dismiss} ctx={ctx} />
      <p><Link to="/home/offers">{t('offer.allLink')}</Link></p>
    </section>
  )
}

/** All offers for this part of the trip in one place, with the ones set aside and the weekly cap on marketing messages (UX-02, CNT-02, NOT-04). */
export function OffersScreen() {
  const trips = useMine(() => api.trips.list())
  const trip = trips.data ? trips.data.upcoming.find((x) => x.kind === 'current') ?? trips.data.upcoming[0] ?? null : null
  const ctx = useOfferContext(trip?.number ?? null)
  const { dismiss, restore } = useOffers()
  const shown = offersFor(ctx)
  const aside = dismissedFor(ctx)
  return (
    <div className="page">
      <h1>{t('route.offers')}</h1>
      <p>{t('offer.intro')}</p>
      <Load state={trips}>
        {() => !trip ? <p>{t('offer.noTrip')}</p> : (
          <>
            {ctx.mode !== 'normal' && <p role="status">{t(`offer.mode.${ctx.mode}` as StringKey)}</p>}
            {shown.length === 0 ? <p>{ctx.mode === 'easy' ? t('offer.mode.easyNone') : t('offer.none')}</p> : (
              <ul className="card-grid">
                {shown.map((o) => <li key={o.id}><OfferItem offer={o} trip={trip.number} onDismiss={dismiss} ctx={ctx} /></li>)}
              </ul>
            )}
            {aside.length > 0 && (
              <section aria-labelledby="offer-aside-h">
                <h2 id="offer-aside-h">{t('offer.aside')}</h2>
                <ul className="link-list">
                  {aside.map((o) => (
                    <li key={o.id}>{t(`offer.${o.id}.title` as StringKey)} <Button variant="secondary" onClick={() => restore(trip.number, o.id)}>{t('offer.restore')}</Button></li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </Load>
      <p className="muted">{t('offer.cap', { count: MARKETING_WEEKLY_CAP })} <Link to="/me/marketing">{t('route.marketing')}</Link></p>
      <p className="muted">{t('offer.restraint')}</p>
      <Back to="/" label={t('route.home')} />
    </div>
  )
}
