import { useState } from 'react'
import { usePromoteRebooking } from '../../hooks/useRebookGate'
import { Link } from 'react-router'
import { compareDeals, dealVerdict, type Deal, type DealKind } from '../../domain/offerCompare'
import { formatMoney, parseMoney } from '../../domain/money'
import { marketingPaused, offersQuiet } from '../../domain/finishMore'
import { useMemory } from '../../hooks/useMemory'
import { homeOffer, offerModeOf, offerReasons, offerStageOf, offersFor, dismissedFor, MARKETING_WEEKLY_CAP, type OfferContext, type OfferDef } from '../../domain/offers'
import { stageAt } from '../../domain/sailings'
import { api } from '../../runtime'
import { useNow, usePersona, useSailing } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { useOffers } from '../../hooks/useOffers'
import { useSettings } from '../../hooks/useSettings'
import { t, th, type StringKey } from '../../i18n'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
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
      <h3 id={id} className="card__title">{th(`offer.${offer.id}.title` as StringKey)}</h3>
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
        <h2 id="home-offer-h" className="muted">{th('offer.paused')}</h2>
        <p>{t('offer.pausedBody')} <Link to="/me/contact">{t('route.contact')}</Link></p>
      </section>
    )
  }
  const offer = homeOffer({ ...ctx, taskWaiting: trip.next !== 'allSet' })
  if (!offer) return null
  return (
    <section aria-labelledby="home-offer-h">
      <h2 id="home-offer-h" className="muted">{th('offer.homeHeading')}</h2>
      <OfferItem offer={offer} trip={trip.number} onDismiss={dismiss} ctx={ctx} />
      <p><Link to="/home/offers">{t('offer.allLink')}</Link></p>
    </section>
  )
}


const DEAL_KINDS: readonly DealKind[] = ['percent', 'off', 'credit']

/** One advert, as the guest reads it: what kind of offer and how much. */
function DealFields({ name, kind, text, onKind, onText }: { name: string; kind: DealKind; text: string; onKind: (k: DealKind) => void; onText: (v: string) => void }) {
  return (
    <fieldset className="field">
      <legend>{name}</legend>
      <label>{t('offer.cmp.kind')}
        <select className="field__input" value={kind} onChange={(e) => onKind(e.target.value as DealKind)}>
          {DEAL_KINDS.map((k) => <option key={k} value={k}>{t(`offer.cmp.kind.${k}` as StringKey)}</option>)}
        </select>
      </label>
      <Field label={kind === 'percent' ? t('offer.cmp.percent') : t('offer.cmp.dollars')} inputMode="decimal" value={text} onChange={(e) => onText(e.target.value)} />
    </fieldset>
  )
}

const dealOf = (kind: DealKind, text: string): Deal | null => {
  if (kind === 'percent') { const n = Number(text); return text.trim() !== '' && Number.isFinite(n) && n >= 0 ? { kind, amount: n } : null }
  const c = parseMoney(text)
  return c !== null && c >= 0 ? { kind, amount: c } : null
}

/** Two offers turned into plain money for the guest's own party: "5% off now" against "$100 credit". */
function OfferCompare() {
  const [fareText, setFareText] = useState('')
  const [guestsText, setGuestsText] = useState('2')
  const [spendText, setSpendText] = useState('')
  const [kindA, setKindA] = useState<DealKind>('percent')
  const [kindB, setKindB] = useState<DealKind>('credit')
  const [textA, setTextA] = useState('')
  const [textB, setTextB] = useState('')
  const fare = parseMoney(fareText)
  const guests = Math.max(1, Math.min(12, Math.floor(Number(guestsText)) || 1))
  const spend = spendText.trim() === '' ? 0 : parseMoney(spendText) ?? 0
  const a = dealOf(kindA, textA)
  const b = dealOf(kindB, textB)
  const result = fare && fare > 0 && a && b ? compareDeals(a, b, fare, guests, spend) : null
  return (
    <section aria-labelledby="offer-cmp-h">
      <h2 id="offer-cmp-h">{th('offer.cmp.title')}</h2>
      <p>{t('offer.cmp.intro')}</p>
      <Field label={t('offer.cmp.fare')} help={t('helptip.fare')} inputMode="decimal" value={fareText} onChange={(e) => setFareText(e.target.value)} error={fareText.trim() !== '' && fare === null ? t('decide.budgetBad') : undefined} />
      <Field label={t('offer.cmp.guests')} help={t('helptip.guests')} inputMode="numeric" value={guestsText} onChange={(e) => setGuestsText(e.target.value)} />
      <DealFields name={t('offer.cmp.a')} kind={kindA} text={textA} onKind={setKindA} onText={setTextA} />
      <DealFields name={t('offer.cmp.b')} kind={kindB} text={textB} onKind={setKindB} onText={setTextB} />
      {(kindA === 'credit' || kindB === 'credit') && <Field label={t('offer.cmp.spend')} hint={t('offer.cmp.spendHint')} inputMode="decimal" value={spendText} onChange={(e) => setSpendText(e.target.value)} />}
      <div role="status">
        {result ? (
          <Card labelledBy="offer-cmp-r">
            <h3 id="offer-cmp-r" className="card__title">{dealVerdict(result, guests)}</h3>
            <ul className="plain-bullets">
              <li>{t('offer.cmp.worthA', { value: formatMoney(result.a), net: formatMoney(result.netA) })}</li>
              <li>{t('offer.cmp.worthB', { value: formatMoney(result.b), net: formatMoney(result.netB) })}</li>
            </ul>
            {result.creditTrimmed && <p className="muted">{t('offer.cmp.trimmed')}</p>}
            <p className="muted">{t('offer.cmp.rules')}</p>
          </Card>
        ) : <p className="muted">{t('offer.cmp.waiting')}</p>}
      </div>
    </section>
  )
}

/** All offers for this part of the trip in one place, with the ones set aside and the weekly cap on marketing messages (UX-02, CNT-02, NOT-04). */
export function OffersScreen() {
  const trips = useMine(() => api.trips.list())
  const trip = trips.data ? trips.data.upcoming.find((x) => x.kind === 'current') ?? trips.data.upcoming[0] ?? null : null
  const ctx = useOfferContext(trip?.number ?? null)
  const { dismiss, restore } = useOffers()
  // While a case is open (or cannot be checked) the book-again offer is not pushed (phase 13); the guest can still open the booking page themselves.
  const mayRebook = usePromoteRebooking()
  const shown = offersFor(ctx).filter((o) => o.id !== 'rebook' || mayRebook)
  const aside = dismissedFor(ctx)
  return (
    <div className="page">
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
                <h2 id="offer-aside-h">{th('offer.aside')}</h2>
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
      <OfferCompare />
      <p className="muted">{t('offer.cap', { count: MARKETING_WEEKLY_CAP })} <Link to="/me/marketing">{t('route.marketing')}</Link></p>
      <p className="muted">{t('offer.restraint')}</p>
      <Back to="/" label={t('route.home')} />
    </div>
  )
}
