import { useState } from 'react'
import { Link } from 'react-router'
import type { TripView } from '../../api/types'
import { categoryById } from '../../domain/ship'
import { usePersona } from '../../hooks/useDemo'
import { carbonRange, childStory, cleanName, DEFAULT_DAILY, dressNights, guaranteeOdds, KG_PER_GUEST_NIGHT, moneyPlan, OCCASIONS, OUTLETS, parsePlan, PROHIBITED, STARTERS, STORY_DAYS, STYLES, styleFor, type Occasion, type PlanLine, type Style } from '../../domain/prepMore'
import { formatMoney } from '../../domain/pricing'
import { itinerary, PORTS, REFERENCE_SAILING, sailingById, sailingNights, type PortId } from '../../domain/sailings'
import { useMemory } from '../../hooks/useMemory'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { Load } from '../account/parts'
import { BackLink } from '../onboard/common'

const Page = ({ title, intro, children }: { title: StringKey; intro: StringKey; children: React.ReactNode }) => (
  <div className="page">
    <BackLink to="/plan" label={t('route.plan')} />
    <h1>{t(title)}</h1>
    <p>{t(intro)}</p>
    {children}
  </div>
)

const portName = (p: PortId): string => (p === 'sea' ? t('mplan.sea') : PORTS[p].name.split(',')[0])

/** Packing for this ship (S3-06): what is not allowed, the outlets, and which evenings are elegant. */
export function ShipPackingScreen() {
  const nights = 7
  return (
    <Page title="route.shipPacking" intro="shipPack.intro">
      <Card labelledBy="sp-no"><h2 id="sp-no" className="card__title">{t('shipPack.no')}</h2><ul>{PROHIBITED.map((k) => <li key={k}>{t(`shipPack.no.${k}` as StringKey)}</li>)}</ul></Card>
      <Card labelledBy="sp-out"><h2 id="sp-out" className="card__title">{t('shipPack.outlets')}</h2><ul>{OUTLETS.map((k) => <li key={k}>{t(`shipPack.out.${k}` as StringKey)}</li>)}</ul></Card>
      <Card labelledBy="sp-dress">
        <h2 id="sp-dress" className="card__title">{t('shipPack.dress')}</h2>
        <p>{t('shipPack.dressDays', { days: dressNights(nights).map((d) => t('shipPack.day', { n: d })).join(', ') })}</p>
        <p className="muted">{t('shipPack.dressOther')}</p>
      </Card>
      <p><Link to="/plan/packing">{t('route.packing')}</Link></p>
    </Page>
  )
}

/** Guaranteed-cabin odds (S2-07): authored history of how often a guarantee booking lands in the category booked or a better one. */
export function GuaranteeScreen() {
  return (
    <Page title="route.guarantee" intro="guar.intro">
      <Banner kind="info" title={t('guar.sim')} />
      <ul className="card-grid">
        {(['interior', 'oceanview', 'balcony', 'miniSuite', 'sanctuaryMiniSuite', 'signatureSuite'] as const).map((id) => {
          const o = guaranteeOdds(id)!
          const label = t('guar.row', { same: o.same, up: o.up })
          return <li key={id}><Card labelledBy={`g-${id}`}><h2 id={`g-${id}`} className="card__title">{categoryById(id)?.name}</h2><p>{label}</p><progress className="meter" max={100} value={o.same} aria-label={label} /></Card></li>
        })}
      </ul>
      <p className="muted">{t('guar.note')}</p>
    </Page>
  )
}

/** Carbon estimate range with its method shown (S2-09, XT-08); shown on the sustainability screen. */
export function CarbonCard() {
  const trips = useMine(() => api.trips.list())
  const trip: TripView | undefined = trips.data?.upcoming[0]
  const nights = sailingNights((trip && sailingById(trip.sailingId)) || REFERENCE_SAILING)
  const r = carbonRange(nights, trip?.guests ?? 1)
  return (
    <Card labelledBy="sus-co2-h">
      <h2 id="sus-co2-h" className="card__title">{t('carbon.title')}</h2>
      <p>{t('carbon.range', { low: r.lowKg.toLocaleString('en-US'), high: r.highKg.toLocaleString('en-US'), guests: trip?.guests ?? 1, nights })}</p>
      <p className="muted">{t('carbon.method', { low: KG_PER_GUEST_NIGHT.low, high: KG_PER_GUEST_NIGHT.high })}</p>
    </Card>
  )
}

/** Money plan (S3-12): a budget for each day by day type, cash for ports and card for the ship. */
export function MoneyPlanScreen() {
  const trips = useMine(() => api.trips.list())
  const trip = trips.data?.upcoming[0]
  const { state: mem, update } = useMemory()
  const saved = mem.planning.moneyDaily ?? DEFAULT_DAILY
  const [sea, setSea] = useState(String(saved.sea / 100))
  const [port, setPort] = useState(String(saved.port / 100))
  const s = (trip && sailingById(trip.sailingId)) || REFERENCE_SAILING
  const daily = { sea: Number(sea || '0') * 100, port: Number(port || '0') * 100 }
  const plan = moneyPlan(s, trip?.guests ?? 1, daily)
  const keep = (next: { sea: number; port: number }) => update((m) => ({ ...m, planning: { ...m.planning, moneyDaily: next } }))
  const isBudget = mem.budget === plan.total
  return (
    <Page title="route.moneyPlan" intro="mplan.intro">
      <Load state={trips}>
        {() => (
          <>
            <Card labelledBy="mp-in">
              <h2 id="mp-in" className="card__title">{t('mplan.perPerson')}</h2>
              <Field label={t('mplan.seaDay')} inputMode="numeric" value={sea} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 5); setSea(v); keep({ ...daily, sea: Number(v || '0') * 100 }) }} />
              <Field label={t('mplan.portDay')} inputMode="numeric" value={port} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 5); setPort(v); keep({ ...daily, port: Number(v || '0') * 100 }) }} />
            </Card>
            <Card labelledBy="mp-out">
              <h2 id="mp-out" className="card__title">{t('mplan.plan')}</h2>
              <ul className="plain-list">{plan.days.map((d) => <li key={d.day}>{t('mplan.row', { day: d.day, where: portName(d.port), amount: formatMoney(d.budget) })}</li>)}</ul>
              <p role="status"><strong>{t('mplan.total', { total: formatMoney(plan.total), cash: formatMoney(plan.cash), card: formatMoney(plan.card) })}</strong></p>
              <Button variant="secondary" disabled={isBudget || plan.total <= 0} onClick={() => update((m) => ({ ...m, budget: plan.total }))}>{isBudget ? t('mplan.isBudget') : t('mplan.useBudget')}</Button>
              <p className="muted">{t('mplan.budgetNote')} <Link to="/home/cruise/cost">{t('route.tripCost')}</Link></p>
            </Card>
          </>
        )}
      </Load>
      <p className="muted">{t('mplan.note')}</p>
    </Page>
  )
}

/** A child-friendly story of the trip (S3-14), made on the screen from the itinerary. */
export function ChildStoryScreen() {
  const [name, setName] = useState('')
  const trips = useMine(() => api.trips.list())
  const s = (trips.data?.upcoming[0] && sailingById(trips.data.upcoming[0].sailingId)) || REFERENCE_SAILING
  const lines = childStory(name, s)
  return (
    <Page title="route.childStory" intro="kstory.intro">
      <Field label={t('kstory.name')} value={name} maxLength={20} onChange={(e) => setName(cleanName(e.target.value))} />
      <Card labelledBy="cs-t"><h2 id="cs-t" className="card__title">{t('kstory.title')}</h2>{lines.map((l) => <p key={l}>{l}</p>)}</Card>
      <Button variant="secondary" onClick={() => window.print()}>{t('kstory.print')}</Button>
    </Page>
  )
}

/** Paste a plan (S0-07): lines are read into a draft; only the ones the guest ticks are kept, on this device. */
export function PasteScreen() {
  const { state, update } = useMemory()
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<PlanLine[]>([])
  const [keep, setKeep] = useState<Set<number>>(new Set())
  const read = () => { const d = parsePlan(text); setDraft(d); setKeep(new Set(d.map((_, i) => i))) }
  return (
    <Page title="route.paste" intro="paste.intro">
      <Card labelledBy="pa-t">
        <h2 id="pa-t" className="card__title">{t('paste.title')}</h2>
        <label htmlFor="paste-box">{t('paste.label')}</label>
        <textarea id="paste-box" className="field__input" rows={6} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
        <Button variant="secondary" disabled={text.trim() === ''} onClick={read}>{t('paste.read')}</Button>
      </Card>
      {draft.length > 0 && (
        <Card labelledBy="pa-d">
          <h2 id="pa-d" className="card__title">{t('paste.draft')}</h2>
          <p>{t('paste.confirm')}</p>
          <ul className="plain-list">{draft.map((l, i) => (
            <li key={`${l.day}-${l.text}`}><label className="choice"><input type="checkbox" checked={keep.has(i)} onChange={(e) => setKeep((k) => { const n = new Set(k); if (e.target.checked) n.add(i); else n.delete(i); return n })} /><span>{l.day ? t('paste.day', { n: l.day }) + ' ' : ''}{l.text}</span></label></li>
          ))}</ul>
          <Button onClick={() => { update((m) => ({ ...m, pasted: draft.filter((_, i) => keep.has(i)) })); setDraft([]); setText('') }}>{t('paste.keep')}</Button>
        </Card>
      )}
      {state.pasted.length > 0 && (
        <Card labelledBy="pa-k">
          <h2 id="pa-k" className="card__title">{t('paste.kept')}</h2>
          <ul>{state.pasted.map((l) => <li key={`${l.day}-${l.text}`}>{l.day ? t('paste.day', { n: l.day }) + ' ' : ''}{l.text}</li>)}</ul>
          <Button variant="tertiary" onClick={() => update((m) => ({ ...m, pasted: [] }))}>{t('paste.clear')}</Button>
        </Card>
      )}
      <p className="muted">{t('paste.note')}</p>
    </Page>
  )
}

/** Occasion starter and authored day stories (S0-09, S0-08). */
export function StarterScreen() {
  const [occasion, setOccasion] = useState<Occasion>('firstCruise')
  const me = usePersona()
  const [style, setStyle] = useState<Style>(styleFor(me?.id))
  const days = itinerary(REFERENCE_SAILING)
  return (
    <Page title="route.starter" intro="starter.intro">
      <Card labelledBy="st-o">
        <fieldset>
          <legend id="st-o">{t('starter.occasion')}</legend>
          {OCCASIONS.map((o) => <label key={o} className="choice"><input type="radio" name="occasion" checked={occasion === o} onChange={() => setOccasion(o)} /><span>{t(`starter.occ.${o}` as StringKey)}</span></label>)}
        </fieldset>
        <ol>{STARTERS[occasion].map((to) => <li key={to}><Link to={to}>{t(`starter.go.${to}` as StringKey)}</Link></li>)}</ol>
      </Card>
      <Card labelledBy="st-s">
        <fieldset>
          <legend id="st-s">{t('starter.style')}</legend>
          {STYLES.map((s) => <label key={s} className="choice"><input type="radio" name="style" checked={style === s} onChange={() => setStyle(s)} /><span>{t(`starter.style.${s}` as StringKey)}</span></label>)}
        </fieldset>
        {style === styleFor(me?.id) && <p className="muted">{t('starter.forYou')}</p>}
        {STORY_DAYS.map((d) => <p key={d}><strong>{t('paste.day', { n: d })} · {portName(days[d - 1].port)}.</strong> {t(`dstory.${style}.${d}` as StringKey)}</p>)}
        <p className="muted">{t('starter.note')}</p>
      </Card>
    </Page>
  )
}
