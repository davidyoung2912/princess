import { useState, type FormEvent } from 'react'
import { ALERT_KINDS, planSpeech, portSnapshot, READ_RATES, VIBRATION, walkSpeech, allergyChain, askShip, BREATH, DOCTOR_TELL, easyLeaveBy, EASY_EXTRA_MIN, farewellDone, fareIndicator, FAREWELL_MOMENTS, flightAdvice, followState, FOLLOW_DAYS, GROUND_STEPS, giftsFor, HABITS, notesFor, poolRide, bagNight, SWEEP_ITEMS, sweepAllDone, tierForHabits, TRAVELLERS, RIDE_NAMES_MAX, type FinishState, type Traveller } from '../../domain/finishMore'
import { GUIDE_PORTS, PORT_KNOWLEDGE, type GuidePort } from '../../domain/portContent'
import { PORTS } from '../../domain/sailings'
import { useCurrentDay, useDayPlan } from '../../hooks/useDayPlan'
import { disembarkTimes, groupFor, onwardMode, ONWARD_MODES, type OnwardMode } from '../../domain/disembark'
import { FARES } from '../../domain/fares'
import { formatMoney } from '../../domain/money'
import { ledgerSummary } from '../../domain/bookingPrep'
import { CATEGORIES, type CategoryId } from '../../domain/ship'
import { SAILINGS } from '../../domain/sailings'
import { useNow, useSailing } from '../../hooks/useDemo'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { FeedWaiting } from '../FeedWaiting'
import { Card } from '../Card'
import { Field } from '../Field'
import { BackLink } from './common'
import { useShipTime } from './shipTime'

type Back = { to: string; label: StringKey }
const Page = ({ intro, back, children }: { intro: StringKey; back: Back; children: React.ReactNode }) => (
  <div className="page">
    <BackLink to={back.to} label={t(back.label)} />
    <p>{t(intro)}</p>
    {children}
  </div>
)
const DIS: Back = { to: '/home/disembark', label: 'route.disembark' }
const SHIP: Back = { to: '/ship', label: 'route.ship' }
const ME: Back = { to: '/me', label: 'route.me' }
const PLAN: Back = { to: '/plan', label: 'route.plan' }

/** The last-day state on this device and a way to change just that part. */
function useFinish() {
  const { state, update } = useMemory()
  const set = (change: (f: FinishState) => FinishState) => update((s) => ({ ...s, finish: change(s.finish) }))
  return { f: state.finish, set, memory: state }
}
const Human = () => <p className="muted">{t('fin.human')} <LinkButton to="/me/contact" variant="tertiary">{t('route.contact')}</LinkButton></p>

/** Cabin sweep (S7-02): a last look, with one tap for all checked. */
export function SweepScreen() {
  const { f, set } = useFinish()
  return (
    <Page intro="sweep.intro" back={DIS}>
      <Card labelledBy="sweep-h"><h2 id="sweep-h" className="card__title">{th('sweep.list')}</h2>
        <ul className="plain-list">
          {SWEEP_ITEMS.map((k) => (
            <li key={k}><label className="choice"><input type="checkbox" checked={f.sweep.includes(k)} onChange={(e) => set((x) => ({ ...x, sweep: e.target.checked ? [...x.sweep, k] : x.sweep.filter((i) => i !== k) }))} /><span>{t(`sweep.item.${k}` as StringKey)}</span></label></li>
          ))}
        </ul>
        <Button variant="secondary" onClick={() => set((x) => ({ ...x, sweep: [...SWEEP_ITEMS] }))}>{t('sweep.all')}</Button>
        {sweepAllDone(f.sweep) && <p role="status">{t('sweep.done')}</p>}
        <p className="muted">{t('sweep.note')}</p></Card>
    </Page>
  )
}

/** Bag night (S7-03): the hallway deadline in plain words and the states "out" and "collected". */
export function BagsScreen() {
  const { f, set } = useFinish()
  const now = useNow()
  const sailing = useSailing()
  const time = useShipTime()
  const times = disembarkTimes(sailing)
  const n = bagNight(times.bagsOutAt, now, f.bags)
  return (
    <Page intro="bags.intro" back={DIS}>
      <Card labelledBy="bags-h"><h2 id="bags-h" className="card__title">{th('bags.deadline', { time: time(times.bagsOutAt) })}</h2>
        <p role="status">{n.state === 'open' ? t('bags.open', { min: n.minutesLeft }) : t(`bags.${n.state}` as StringKey)}</p>
        <div className="button-row">
          {f.bags === 'none' && <Button onClick={() => set((x) => ({ ...x, bags: 'out' }))}>{t('bags.markOut')}</Button>}
          {f.bags === 'out' && <Button onClick={() => set((x) => ({ ...x, bags: 'collected' }))}>{t('bags.markCollected')}</Button>}
          {f.bags !== 'none' && <Button variant="tertiary" onClick={() => set((x) => ({ ...x, bags: 'none' }))}>{t('bags.undo')}</Button>}
        </div>
        <p className="muted">{t('bags.note')}</p></Card>
    </Page>
  )
}

/** Flight-aware choice and low-stress mode (S7-01, S7-06): which way off suits the flight, with an hour of extra buffer when asked. */
export function FlightScreen() {
  const { f, set, memory } = useFinish()
  const sailing = useSailing()
  const time = useShipTime()
  const [flightAt, setFlightAt] = useState('')
  const [mode, setMode] = useState<OnwardMode>('airportTransfer')
  const group = groupFor(memory.hold?.label ?? 'guest', false)
  const advice = flightAdvice(sailing, { mode, flightAt, flight: '', note: '' }, group, f.easy)
  const first = advice.options.find((o) => o.option === advice.best)!
  const leave = flightAt ? easyLeaveBy(first.offFrom, f.easy) : null
  return (
    <Page intro="flight.intro" back={DIS}>
      <Card labelledBy="fl-set"><h2 id="fl-set" className="card__title">{th('flight.set')}</h2>
        <Field label={t('flight.time')} hint={t('flight.timeHint')} type="time" value={flightAt} onChange={(e) => setFlightAt(e.target.value)} />
        <fieldset><legend>{t('flight.mode')}</legend>
          {ONWARD_MODES.map((m) => <label key={m.id} className="choice"><input type="radio" name="fl-mode" checked={mode === m.id} onChange={() => setMode(m.id)} /><span>{t(`onw.mode.${m.id}` as StringKey)} ({onwardMode(m.id)!.minutes} min)</span></label>)}
        </fieldset>
        <label className="choice"><input type="checkbox" checked={f.easy} onChange={(e) => set((x) => ({ ...x, easy: e.target.checked }))} /><span>{t('flight.easy')}<small>{t('flight.easyHint', { min: EASY_EXTRA_MIN })}</small></span></label>
        {f.easy && <label className="choice"><input type="checkbox" checked={f.assistBooked} onChange={(e) => set((x) => ({ ...x, assistBooked: e.target.checked }))} /><span>{t('flight.assist')}<small>{t('flight.assistHint')}</small></span></label>}
      </Card>
      <Card labelledBy="fl-res"><h2 id="fl-res" className="card__title">{th('flight.result')}</h2>
        {!flightAt ? <p>{t('flight.noFlight')}</p> : (
          <>
            <p role="status"><strong>{t(`flight.best.${advice.best}` as StringKey)}</strong>{leave !== null && <> {t('flight.leaveBy', { time: time(leave) })}</>}</p>
            <ul>{advice.options.map((o) => <li key={o.option}>{t(`flight.best.${o.option}` as StringKey)}: {t(`flight.fit.${o.fit}` as StringKey)}</li>)}</ul>
            {advice.risky && <Banner kind="warning" title={t('flight.risky')}><p>{t('flight.riskyBody')}</p></Banner>}
            {advice.earlyFlight && <p>{t('flight.early')}</p>}
          </>
        )}
        {f.easy && <p className="muted">{t('flight.noPromos')}</p>}
      </Card>
      <Human />
    </Page>
  )
}

/** Meet-up and ride pool (S7-07): one ride split between parties in a ledger on the booker's device. Nothing is collected. */
export function RideScreen() {
  const { f, set } = useFinish()
  const [meet, setMeet] = useState('')
  const [cost, setCost] = useState('')
  const [names, setNames] = useState('')
  const [bad, setBad] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const total = Math.round(Number(cost) * 100)
    const pool = poolRide(meet, total, names.split(','), () => newMemoryId())
    setBad(pool === null)
    if (pool) set((x) => ({ ...x, ride: pool }))
  }
  const sum = f.ride ? ledgerSummary(f.ride.shares) : null
  return (
    <Page intro="ride.intro" back={DIS}>
      {!f.ride ? (
        <form onSubmit={submit}>
          <Field label={t('ride.meet')} hint={t('ride.meetHint')} value={meet} maxLength={60} onChange={(e) => setMeet(e.target.value)} />
          <Field label={t('ride.cost')} hint={t('ride.costHint')} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          <Field label={t('ride.names')} hint={t('ride.namesHint', { n: RIDE_NAMES_MAX })} value={names} onChange={(e) => setNames(e.target.value)} />
          {bad && <Banner kind="warning" title={t('ride.bad')} />}
          <Button type="submit">{t('ride.make')}</Button>
        </form>
      ) : (
        <Card labelledBy="ride-h"><h2 id="ride-h" className="card__title">{th('ride.where', { meet: f.ride.meet })}</h2>
          <ul className="plain-list">
            {f.ride.shares.map((s) => (
              <li key={s.id}><label className="choice"><input type="checkbox" checked={s.paid} onChange={(e) => set((x) => ({ ...x, ride: x.ride && { ...x.ride, shares: x.ride.shares.map((y) => (y.id === s.id ? { ...y, paid: e.target.checked } : y)) } }))} /><span>{s.name}: {formatMoney(s.amount)}{s.paid ? ` (${t('ride.paid')})` : ''}</span></label></li>
            ))}
          </ul>
          {sum && <p role="status">{t('ride.summary', { owed: formatMoney(sum.owed), total: formatMoney(sum.total) })}</p>}
          <Button variant="tertiary" onClick={() => set((x) => ({ ...x, ride: null }))}>{t('ride.clear')}</Button></Card>
      )}
      <p className="muted">{t('ride.note')}</p>
    </Page>
  )
}

/** Three-tap farewell (S7-08): one moment, a rating, done; the note is optional. */
export function FarewellScreen() {
  const { f, set } = useFinish()
  const fw = f.farewell
  return (
    <Page intro="farewell.intro" back={ME}>
      <Card labelledBy="fw-m"><h2 id="fw-m" className="card__title">{th('farewell.moment')}</h2>
        <div className="button-row" role="group" aria-labelledby="fw-m">
          {FAREWELL_MOMENTS.map((k) => <Button key={k} variant={fw.moment === k ? 'primary' : 'secondary'} aria-pressed={fw.moment === k} onClick={() => set((x) => ({ ...x, farewell: { ...x.farewell, moment: k } }))}>{t(`farewell.m.${k}` as StringKey)}</Button>)}
        </div></Card>
      <Card labelledBy="fw-r"><h2 id="fw-r" className="card__title">{th('farewell.rating')}</h2>
        <div className="button-row" role="group" aria-labelledby="fw-r">
          {[1, 2, 3, 4, 5].map((n) => <Button key={n} variant={fw.rating === n ? 'primary' : 'secondary'} aria-pressed={fw.rating === n} onClick={() => set((x) => ({ ...x, farewell: { ...x.farewell, rating: n } }))}>{String(n)}</Button>)}
        </div>
        <p className="muted">{t('farewell.ratingHint')}</p></Card>
      <Card labelledBy="fw-n"><h2 id="fw-n" className="card__title">{th('farewell.more')}</h2>
        <Field label={t('farewell.note')} hint={t('farewell.noteHint')} value={fw.note} maxLength={200} onChange={(e) => set((x) => ({ ...x, farewell: { ...x.farewell, note: e.target.value } }))} />
        {farewellDone(fw) && <p role="status">{t('farewell.done')}</p>}
        <p><LinkButton to="/me/feedback" variant="tertiary">{t('farewell.full')}</LinkButton></p></Card>
    </Page>
  )
}

/** After-cruise health note (S7-09): on the screen at day 3 and 7 for a guest who agreed; nothing is sent. */
export function FollowUpScreen() {
  const { f, set } = useFinish()
  const now = useNow()
  const sailing = useSailing()
  const leftAt = disembarkTimes(sailing).arrivalAt
  return (
    <Page intro="follow.intro" back={ME}>
      <Card labelledBy="fu-c"><h2 id="fu-c" className="card__title">{th('follow.consent')}</h2>
        <label className="choice"><input type="checkbox" checked={f.follow.consent} onChange={(e) => set((x) => ({ ...x, follow: { ...x.follow, consent: e.target.checked } }))} /><span>{t('follow.agree')}</span></label>
        <p className="muted">{t('follow.nothingSent')}</p></Card>
      {f.follow.consent && FOLLOW_DAYS.map((d) => {
        const st = followState(d, leftAt, now, f.follow)
        return (
          <Card key={d} labelledBy={`fu-${d}`}><h2 id={`fu-${d}`} className="card__title">{th('follow.day', { n: d })}</h2>
            {st === 'later' && <p>{t('follow.later')}</p>}
            {st === 'answered' && <p role="status">{t(`follow.said.${f.follow.answers[String(d)]}` as StringKey)}</p>}
            {st === 'due' && (
              <div className="button-row">
                <Button onClick={() => set((x) => ({ ...x, follow: { ...x.follow, answers: { ...x.follow.answers, [d]: 'well' } } }))}>{t('follow.well')}</Button>
                <Button variant="secondary" onClick={() => set((x) => ({ ...x, follow: { ...x.follow, answers: { ...x.follow.answers, [d]: 'unwell' } } }))}>{t('follow.unwell')}</Button>
              </div>
            )}
          </Card>
        )
      })}
      {Object.values(f.follow.answers).includes('unwell') && (
        <Card labelledBy="fu-doc"><h2 id="fu-doc" className="card__title">{th('follow.tell')}</h2>
          <ul>{DOCTOR_TELL.map((k) => <li key={k}>{t(`follow.tell.${k}` as StringKey)}</li>)}</ul>
          <Human /></Card>
      )}
    </Page>
  )
}

/** Ask the ship (S6-26): facts that are not a service request, from authored content. */
export function AskShipScreen() {
  const [q, setQ] = useState('')
  const [asked, setAsked] = useState<string | null>(null)
  const fact = asked === null ? null : askShip(asked)
  const submit = (e: FormEvent) => { e.preventDefault(); if (q.trim()) setAsked(q) }
  return (
    <Page intro="askShip.intro" back={SHIP}>
      <form onSubmit={submit}>
        <Field label={t('askShip.label')} value={q} maxLength={120} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit">{t('ask.send')}</Button>
      </form>
      <section aria-live="polite">
        {asked !== null && (fact ? <Card><p><strong>{fact.q}</strong></p><p>{fact.a}</p></Card> : <Banner kind="info" title={t('askShip.unknown')}><p>{t('askShip.unknownBody')}</p><LinkButton to="/me/contact" variant="secondary">{t('route.contact')}</LinkButton></Banner>)}
      </section>
      <p className="muted">{t('askShip.note')}</p>
    </Page>
  )
}

/** Safe-ashore notes (XI-08): relevant, factual notes for the travellers the guest picks. */
export function SafeAshoreScreen() {
  const { f, set } = useFinish()
  return (
    <Page intro="ashore.intro" back={SHIP}>
      <Card labelledBy="as-who"><h2 id="as-who" className="card__title">{th('ashore.who')}</h2>
        {TRAVELLERS.map((w) => <label key={w} className="choice"><input type="checkbox" checked={f.travellers.includes(w)} onChange={(e) => set((x) => ({ ...x, travellers: e.target.checked ? [...x.travellers, w as Traveller] : x.travellers.filter((i) => i !== w) }))} /><span>{t(`ashore.w.${w}` as StringKey)}</span></label>)}
        <p className="muted">{t('ashore.private')}</p></Card>
      {notesFor(f.travellers).map((n) => <Card key={n.who} labelledBy={`as-${n.who}`}><h2 id={`as-${n.who}`} className="card__title">{th(`ashore.w.${n.who}` as StringKey)}</h2><ul>{n.notes.map((x) => <li key={x}>{x}</li>)}</ul></Card>)}
      <LinkButton to="/ship/port/guide" variant="secondary">{t('ashore.portGuide')}</LinkButton>
      <p className="muted">{t('ashore.verify')}</p>
    </Page>
  )
}

/** Allergy confidence (XI-09): the chain from the pre-flag to each venue, with simulated acknowledgements. */
export function AllergyChainScreen() {
  const { memory } = useFinish()
  const now = useNow()
  const chain = allergyChain(memory.allergy, now)
  return (
    <Page intro="chain.intro" back={SHIP}>
      <Banner kind="info" title={t('chain.sim')} />
      <Card labelledBy="ch-steps"><h2 id="ch-steps" className="card__title">{th('chain.steps')}</h2>
        <ol>{chain.steps.map((s) => <li key={s.id}>{t(`chain.step.${s.id}` as StringKey)}: {s.done ? t('chain.done') : t('chain.waiting')}</li>)}</ol>
        {memory.allergy.items.length === 0 && <LinkButton to="/plan/allergy" variant="secondary">{t('chain.start')}</LinkButton>}</Card>
      {memory.allergy.items.length > 0 && (
        <Card labelledBy="ch-v"><h2 id="ch-v" className="card__title">{th('chain.venues')}</h2>
          <ul>{chain.venues.map((v) => <li key={v.id}>{v.name}: {t(`chain.status.${v.status}` as StringKey)}, {t('chain.safe', { n: v.safe })}</li>)}</ul>
          <p className="muted">{t('chain.change')}</p></Card>
      )}
      <Human />
    </Page>
  )
}

/** Gentle wording (XI-10) for guests travelling after a loss. */
export function GentleScreen() {
  const { f, set } = useFinish()
  return (
    <Page intro="gentle.intro" back={ME}>
      <Card labelledBy="gn-h"><h2 id="gn-h" className="card__title">{th('gentle.title')}</h2>
        <label className="choice"><input type="checkbox" checked={f.gentle} onChange={(e) => set((x) => ({ ...x, gentle: e.target.checked }))} /><span>{t('gentle.wording')}<small>{t('gentle.onHint')}</small></span></label>
        <Field label={t('gentle.memorial')} hint={t('gentle.memorialHint')} value={f.memorial} maxLength={80} onChange={(e) => set((x) => ({ ...x, memorial: e.target.value }))} />
        {f.gentle && <p role="status">{t('gentle.on.said')}</p>}</Card>
      <Card labelledBy="gn-q"><h2 id="gn-q" className="card__title">{th('gentle.quiet')}</h2>
        <p>{t('gentle.quietBody')}</p>
        <LinkButton to="/me/calm" variant="secondary">{t('gentle.quietLink')}</LinkButton></Card>
      <Card labelledBy="gn-a"><h2 id="gn-a" className="card__title">{th('gentle.ashes')}</h2><p>{t('gentle.ashesBody')}</p><Human /></Card>
    </Page>
  )
}

/** Anxiety toolkit (XI-11): breathing and grounding on the page, no scores, and a path to a quiet person. */
export function AnxietyScreen() {
  return (
    <Page intro="anx.intro" back={ME}>
      <Card labelledBy="ax-b"><h2 id="ax-b" className="card__title">{th('anx.breath')}</h2>
        <ol>
          <li>{t('anx.in', { n: BREATH.in })}</li>
          <li>{t('anx.hold', { n: BREATH.hold })}</li>
          <li>{t('anx.out', { n: BREATH.out })}</li>
        </ol>
        <p>{t('anx.rounds', { n: BREATH.rounds })}</p></Card>
      <Card labelledBy="ax-g"><h2 id="ax-g" className="card__title">{th('anx.ground')}</h2>
        <ol>{GROUND_STEPS.map((k) => <li key={k}>{t(`anx.g.${k}` as StringKey)}</li>)}</ol></Card>
      <Card labelledBy="ax-s"><h2 id="ax-s" className="card__title">{th('anx.struggling')}</h2>
        <p>{t('anx.strugglingBody')}</p>
        <LinkButton to="/me/contact">{t('anx.person')}</LinkButton>
        <LinkButton to="/me/calm" variant="secondary">{t('gentle.quietLink')}</LinkButton></Card>
    </Page>
  )
}

/** Fare indicator (S1-01): low, typical or high for a room against a simulated history, and the tier that fits the guest's habits. */
export function FareCheckScreen() {
  const [sailingId, setSailingId] = useState(SAILINGS.find((s) => s.reference)?.id ?? SAILINGS[0].id)
  const [category, setCategory] = useState<CategoryId>('balcony')
  const [habits, setHabits] = useState<string[]>([])
  const ind = fareIndicator(sailingId, category)
  const tier = tierForHabits(habits)
  return (
    <Page intro="fare.intro" back={PLAN}>
      <Banner kind="info" title={t('fare.sim')} />
      <Card labelledBy="fc-room"><h2 id="fc-room" className="card__title">{th('fare.room')}</h2>
        <label className="field"><span>{t('fare.sailing')}</span>
          <select value={sailingId} onChange={(e) => setSailingId(e.target.value)}>{SAILINGS.map((s) => <option key={s.id} value={s.id}>{s.departure}</option>)}</select></label>
        <label className="field"><span>{t('fare.category')}</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {ind ? <p role="status"><strong>{t(`fare.band.${ind.band}` as StringKey)}</strong> {t('fare.range', { now: formatMoney(ind.now), low: formatMoney(ind.lowest), high: formatMoney(ind.highest) })}</p> : <p>{t('fare.none')}</p>}</Card>
      <Card labelledBy="fc-tier"><h2 id="fc-tier" className="card__title">{th('fare.habits')}</h2>
        {HABITS.map((h) => <label key={h} className="choice"><input type="checkbox" checked={habits.includes(h)} onChange={(e) => setHabits((x) => (e.target.checked ? [...x, h] : x.filter((i) => i !== h)))} /><span>{t(`fare.h.${h}` as StringKey)}</span></label>)}
        <p role="status">{t('fare.tier', { tier: FARES[tier].name })}</p>
        <p className="muted">{t('fare.tierNote')}</p></Card>
    </Page>
  )
}

/** Gifts that read the room (S4-11): only what fits the budget, the occasion and the dietary notes, on a screen of their own. */
export function GiftsScreen() {
  const { f, memory } = useFinish()
  const [occasion, setOccasion] = useState<'birthday' | 'anniversary' | 'none'>('none')
  const [noAlcohol, setNoAlcohol] = useState(false)
  const list = giftsFor(memory.budget, occasion, memory.allergy.items, noAlcohol, f.gentle)
  return (
    <Page intro="gifts.intro" back={PLAN}>
      <Card labelledBy="gf-o"><h2 id="gf-o" className="card__title">{th('gifts.occasion')}</h2>
        {(['none', 'birthday', 'anniversary'] as const).map((o) => <label key={o} className="choice"><input type="radio" name="gf-occ" checked={occasion === o} onChange={() => setOccasion(o)} /><span>{t(`gifts.o.${o}` as StringKey)}</span></label>)}
        <label className="choice"><input type="checkbox" checked={noAlcohol} onChange={(e) => setNoAlcohol(e.target.checked)} /><span>{t('gifts.noAlcohol')}</span></label>
        <p className="muted">{memory.budget === null ? t('gifts.noBudget') : t('gifts.budget', { amount: formatMoney(memory.budget) })}{memory.allergy.items.length > 0 && ` ${t('gifts.allergy')}`}</p></Card>
      {list.length === 0 ? <Banner kind="info" title={t('gifts.none')} /> : <ul className="card-grid">{list.map((g) => <li key={g.id}><Card labelledBy={`g-${g.id}`}><h2 id={`g-${g.id}`} className="card__title">{th(`gifts.g.${g.id}` as StringKey)}</h2><p>{formatMoney(g.cents)}</p></Card></li>)}</ul>}
      <p className="muted">{t('gifts.note')}</p>
    </Page>
  )
}

/** Visual and vibration alerts (XI-07): try each kind of alert, so you know what it looks and feels like. */
export function AlertsScreen() {
  const [shown, setShown] = useState<string | null>(null)
  const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  const test = (k: (typeof ALERT_KINDS)[number]) => { setShown(k); if (canVibrate) navigator.vibrate(VIBRATION[k]) }
  return (
    <Page intro="alerts.intro" back={ME}>
      <Card labelledBy="al-h"><h2 id="al-h" className="card__title">{th('alerts.try')}</h2>
        <div className="button-row">{ALERT_KINDS.map((k) => <Button key={k} variant="secondary" onClick={() => test(k)}>{t(`alerts.k.${k}` as StringKey)}</Button>)}</div>
        <div role="status">{shown && <Banner kind={shown === 'critical' ? 'danger' : shown === 'important' ? 'warning' : 'info'} title={t(`alerts.k.${shown}` as StringKey)}><p>{t('alerts.shown')}</p></Banner>}</div>
        <p className="muted">{canVibrate ? t('alerts.vibrate') : t('alerts.noVibrate')}</p></Card>
      <p><LinkButton to="/me/settings" variant="secondary">{t('alerts.captions')}</LinkButton></p>
      <Human />
    </Page>
  )
}

/** Read aloud (XI-06): the day, or a port walk with its accessible version, spoken by the device. */
export function ReadAloudScreen() {
  const day = useCurrentDay()
  const dp = useDayPlan(day)
  const [port, setPort] = useState<GuidePort>('cozumel')
  const [rate, setRate] = useState<number>(1)
  const [reading, setReading] = useState(false)
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
  const speak = (text: string) => {
    const synth = window.speechSynthesis
    if (reading) { synth.cancel(); setReading(false); return }
    const u = new SpeechSynthesisUtterance(text)
    u.rate = rate
    u.onend = () => setReading(false)
    setReading(true)
    synth.speak(u)
  }
  const plan = dp.ready ? planSpeech(dp.rows.filter((r) => r.state !== 'dropped').map((r) => r.entry), t('read.empty')) : null
  const walk = PORT_KNOWLEDGE[port].walks[0]
  return (
    <Page intro="read.intro" back={SHIP}>
      {!canSpeak && <Banner kind="info" title={t('read.unsupported')} />}
      <Card labelledBy="rd-r"><h2 id="rd-r" className="card__title">{th('read.speed')}</h2>
        {READ_RATES.map((r) => <label key={r} className="choice"><input type="radio" name="rd-rate" checked={rate === r} onChange={() => setRate(r)} /><span>{t(`read.rate.${String(r).replace('.', '')}` as StringKey)}</span></label>)}</Card>
      <Card labelledBy="rd-p"><h2 id="rd-p" className="card__title">{th('read.plan')}</h2>
        {plan === null ? <FeedWaiting /> : <p>{plan}</p>}
        {canSpeak && plan !== null && <Button onClick={() => speak(plan)}>{reading ? t('read.stop') : t('read.play')}</Button>}</Card>
      <Card labelledBy="rd-w"><h2 id="rd-w" className="card__title">{th('read.walk')}</h2>
        {GUIDE_PORTS.map((p) => <label key={p} className="choice"><input type="radio" name="rd-port" checked={port === p} onChange={() => setPort(p)} /><span>{PORTS[p].name}</span></label>)}
        {walk && <><p>{walkSpeech(walk)}</p>{canSpeak && <Button onClick={() => speak(walkSpeech(walk))}>{reading ? t('read.stop') : t('read.play')}</Button>}</>}</Card>
    </Page>
  )
}

/** Port snapshot (S6A-14): a text summary of the port day to copy for the group or the recap. No photos. */
export function PortSnapshotScreen() {
  const [port, setPort] = useState<GuidePort>('cozumel')
  const [people, setPeople] = useState(2)
  const [copied, setCopied] = useState(false)
  const lines = portSnapshot(port, people)
  const copy = async () => { try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true) } catch { setCopied(false) } }
  return (
    <Page intro="snap.intro" back={{ to: '/ship/port', label: 'route.portDay' }}>
      <Card labelledBy="sn-h"><h2 id="sn-h" className="card__title">{th('snap.which')}</h2>
        {GUIDE_PORTS.map((p) => <label key={p} className="choice"><input type="radio" name="sn-port" checked={port === p} onChange={() => { setPort(p); setCopied(false) }} /><span>{PORTS[p].name}</span></label>)}
        <label className="field"><span>{t('snap.people')}</span><select value={people} onChange={(e) => setPeople(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label></Card>
      <Card labelledBy="sn-t"><h2 id="sn-t" className="card__title">{PORTS[port].name}</h2>
        <ul>{lines.map((l) => <li key={l}>{l}</li>)}</ul>
        <Button onClick={() => void copy()}>{t('snap.copy')}</Button>
        {copied && <p role="status">{t('snap.copied')}</p>}
        <p className="muted">{t('snap.note')}</p></Card>
    </Page>
  )
}
