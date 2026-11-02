import type { PaymentsView } from '../../api/types'
import { ShareSliders } from '../delights/PlanPolish'
import { SharingNote } from '../SharingNote'
import { useState } from 'react'
import { Link } from 'react-router'
import { useFareHistory } from '../../hooks/useServedFeeds'
import { ACCESS_FLAGS, accessNotes, needsWithAccess, ALLERGY_MAX, AREAS, cleanAllergy, cleanHoldLabel, contractText, galleyStatus, HOLD_HOURS, HOLD_LABEL_MAX, holdState, ledgerSummary, leftInWords, MOBILITY_DEVICES, personReadiness, priceWatch, splitEven, tripContract, type AccessFlag, type MobilityDevice } from '../../domain/bookingPrep'
import { formatDate } from '../../domain/cruise'
import { formatMoney } from '../../domain/money'
import { dateIn } from '../../domain/timezones'
import { daysBetween } from '../../domain/trip'
import type { WhatIfBooking } from '../../domain/whatIf'
import { useNow } from '../../hooks/useDemo'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { FeedWaiting } from '../FeedWaiting'
import { Field } from '../Field'
import { Printer, Share } from '../icons'
import { Load } from '../account/parts'
import { BackLink } from '../onboard/common'

const Page = ({ title, intro, children }: { title: StringKey; intro: StringKey; children: React.ReactNode }) => (
  <div className="page page--print">
    <BackLink to="/plan" label={t('route.plan')} />
    <h1>{t(title)}</h1>
    <p className="no-print">{t(intro)}</p>
    {children}
  </div>
)

/** Short free hold (S2-03): 48 hours, kept on this device. The countdown shows on this screen only and is in words. */
export function HoldScreen() {
  const { state, update } = useMemory()
  const now = useNow()
  const [label, setLabel] = useState('')
  const h = holdState(state.hold, now)
  return (
    <Page title="route.hold" intro="hold.intro">
      <Card labelledBy="hold-t">
        <h2 id="hold-t" className="card__title">{t('hold.title')}</h2>
        {h.state === 'active' && <p role="status">{t('hold.active', { what: state.hold?.label ?? '', left: leftInWords(h.msLeft) })}</p>}
        {h.state === 'lapsed' && <p role="status">{t('hold.lapsed', { what: state.hold?.label ?? '' })}</p>}
        {h.state !== 'active' && (
          <form onSubmit={(e) => { e.preventDefault(); const l = cleanHoldLabel(label); if (l) { update((m) => ({ ...m, hold: { label: l, at: now } })); setLabel('') } }}>
            <Field label={t('hold.what')} hint={t('hold.hint', { hours: HOLD_HOURS })} value={label} maxLength={HOLD_LABEL_MAX} onChange={(e) => setLabel(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={cleanHoldLabel(label) === ''}>{t('hold.start')}</Button>
          </form>
        )}
        {h.state !== 'none' && <Button variant="tertiary" onClick={() => update((m) => ({ ...m, hold: null }))}>{t('hold.release')}</Button>}
      </Card>
      <p className="muted">{t('hold.note')}</p>
    </Page>
  )
}

/** Accessibility-first profile (S2-06): captured once; says what each part of the app will look out for. */
export function AccessScreen() {
  const { state, update, me } = useMemory()
  const p = state.access
  const notes = accessNotes(p)
  /** One answer in two places: the account profile's needs (which the server's dining and cabin rules read) follow the access profile. Best effort; the profile form shows any problem. */
  const mirrorToProfile = (next: typeof p) => {
    if (!me) return
    void api.account.profile(me.id).then((v) => api.account.saveProfile(me.id, { ...v.profile, needs: needsWithAccess(v.profile.needs, next) })).catch(() => undefined)
  }
  return (
    <Page title="route.accessProfile" intro="access.intro">
      <Card labelledBy="acc-t">
        <fieldset>
          <legend id="acc-t">{t('access.legend')}</legend>
          {ACCESS_FLAGS.map((f: AccessFlag) => (
            <label key={f} className="choice"><input type="checkbox" checked={p[f]} onChange={(e) => { update((m) => ({ ...m, access: { ...m.access, [f]: e.target.checked } })); mirrorToProfile({ ...p, [f]: e.target.checked }) }} /><span>{t(`access.flag.${f}` as StringKey)}</span></label>
          ))}
        </fieldset>
        <fieldset>
          <legend>{t('access.device')}</legend>
          {MOBILITY_DEVICES.map((d: MobilityDevice) => (
            <label key={d} className="choice"><input type="radio" name="device" checked={p.device === d} onChange={() => update((m) => ({ ...m, access: { ...m.access, device: d } }))} /><span>{t(`access.dev.${d}` as StringKey)}</span></label>
          ))}
        </fieldset>
      </Card>
      <Card labelledBy="acc-r">
        <h2 id="acc-r" className="card__title">{t('access.reads')}</h2>
        {AREAS.map((a) => (
          <section key={a} aria-labelledby={`acc-${a}`}>
            <h3 id={`acc-${a}`}>{t(`access.area.${a}` as StringKey)}</h3>
            {notes[a].length === 0 ? <p className="muted">{t('access.nothing')}</p> : <ul>{notes[a].map((n) => <li key={n}>{t(`access.note.${n}` as StringKey)}</li>)}</ul>}
          </section>
        ))}
      </Card>
      <p className="muted">{t('access.note')}</p>
    </Page>
  )
}

/** One-page trip contract (S2-08): printed or copied; read aloud by the browser's own reader on the printed page. */
export function ContractScreen() {
  const view = useMine(() => api.payments.get())
  const { me } = useMemory()
  const now = useNow()
  const [note, setNote] = useState('')
  return (
    <Page title="route.contract" intro="contract.intro">
      <Load state={view}>
        {(v) => {
          const s = tripContract({ number: v.trip.number, name: me?.name ?? '', departure: v.trip.departure, guests: v.trip.guests, category: v.trip.categoryName, plan: v.trip.plan, balancePaid: v.trip.payment === 'paid', today: dateIn(now, 'America/New_York') })
          const head = (id: string) => t(`contract.sec.${id}` as StringKey)
          return (
            <>
              <div className="button-row no-print">
                <Button variant="secondary" onClick={() => window.print()}><Printer aria-hidden="true" /> {t('contract.print')}</Button>
                <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(contractText(s, head)).then(() => setNote(t('contract.copied')), () => setNote(t('contract.copyFailed'))) }}><Share aria-hidden="true" /> {t('contract.copy')}</Button>
              </div>
              <p className="muted no-print" role="status">{note}</p>
              <div className="print-sheet">
                {s.map((sec) => (
                  <section key={sec.id} aria-labelledby={`ct-${sec.id}`}>
                    <h2 id={`ct-${sec.id}`}>{head(sec.id)}</h2>
                    <ul>{sec.lines.map((l) => <li key={l}>{l}</li>)}</ul>
                  </section>
                ))}
                <p className="print-sheet__foot">{t('contract.foot')}</p>
              </div>
            </>
          )
        }}
      </Load>
    </Page>
  )
}

/** Per-person readiness (S3-01): one number for each traveller, weighted by deadline, papers first. */
export function ReadinessScreen() {
  const list = useMine(() => api.plan.checklist.get())
  const docs = useMine(() => api.documents.get())
  return (
    <Page title="route.readiness" intro="ready.intro">
      <Load state={list}>
        {(c) => (
          <Load state={docs}>
            {(d) => (
              <>
                {d.guests.map((g) => {
                  const r = personReadiness(c.entries, g.blocking)
                  const label = t('ready.percent', { name: g.name, percent: r.percent })
                  return (
                    <Card key={g.id} labelledBy={`rd-${g.id}`}>
                      <h2 id={`rd-${g.id}`} className="card__title">{g.name}</h2>
                      <p><strong>{label}</strong></p>
                      <progress className="meter" max={100} value={r.percent} aria-label={label} />
                      {r.open.length === 0 ? <p>{t('ready.all')}</p> : (
                        <ul>{r.open.slice(0, 5).map((o) => <li key={o.id}>{t(`plan.check.item.${o.id}` as StringKey)} <span className="muted">· {formatDate(o.due)}</span></li>)}</ul>
                      )}
                    </Card>
                  )
                })}
                <p className="muted">{t('ready.how')} <Link to="/plan/checklist">{t('route.checklist')}</Link></p>
              </>
            )}
          </Load>
        )}
      </Load>
    </Page>
  )
}

/** Allergy pre-flag (S3-13): flag allergies once; the status of the galley's reply is simulated and says so. */
export function AllergyScreen() {
  const { state, update } = useMemory()
  const now = useNow()
  const [draft, setDraft] = useState('')
  const a = state.allergy
  const status = galleyStatus(a, now)
  const add = () => {
    const v = cleanAllergy(draft)
    if (v === '' || a.items.length >= ALLERGY_MAX || a.items.some((i) => i.toLowerCase() === v.toLowerCase())) return
    update((m) => ({ ...m, allergy: { items: [...m.allergy.items, v], at: now } }))
    setDraft('')
  }
  return (
    <Page title="route.allergy" intro="allergy.intro">
      <Card labelledBy="al-t">
        <h2 id="al-t" className="card__title">{t('allergy.title')}</h2>
        {a.items.length === 0 ? <p>{t('allergy.none')}</p> : (
          <ul>{a.items.map((i) => <li key={i}>{i} <Button variant="tertiary" onClick={() => update((m) => { const items = m.allergy.items.filter((x) => x !== i); return { ...m, allergy: { items, at: items.length ? now : null } } })}>{t('allergy.remove')}<span className="visually-hidden"> {i}</span></Button></li>)}</ul>
        )}
        {a.items.length < ALLERGY_MAX && (
          <form onSubmit={(e) => { e.preventDefault(); add() }}>
            <Field label={t('allergy.add')} hint={t('allergy.hint')} value={draft} maxLength={40} onChange={(e) => setDraft(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={cleanAllergy(draft) === ''}>{t('allergy.addButton')}</Button>
          </form>
        )}
        <p role="status"><strong>{t('allergy.status')}:</strong> {t(`allergy.s.${status}` as StringKey)}</p>
      </Card>
      <Banner kind="info" title={t('allergy.sim')} />
    </Page>
  )
}

/** Pay-your-share ledger (S2-04): who has paid what part, on the booker's device. No payment links. */
export function ShareLedgerScreen() {
  const view = useMine(() => api.payments.get())
  const { state, update } = useMemory()
  const [name, setName] = useState('')
  const sum = ledgerSummary(state.shares)
  return (
    <Page title="route.shares" intro="shares.intro">
      <SharingNote field="spending" />
      <Load state={view}>
        {(v) => (
          <Card labelledBy="sh-t">
            <h2 id="sh-t" className="card__title">{t('shares.title', { total: formatMoney(v.trip.plan.total) })}</h2>
            <form onSubmit={(e) => { e.preventDefault(); const n = name.replace(/\s+/g, ' ').trim(); if (n) { const names = [...state.shares.map((s) => s.name), n]; const parts = splitEven(v.trip.plan.total, names); update((m) => ({ ...m, shares: parts.map((p, i) => ({ id: m.shares[i]?.id ?? newMemoryId(), name: p.name, amount: p.amount, paid: m.shares[i]?.paid ?? false })) })); setName('') } }}>
              <Field label={t('shares.add')} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
              <Button type="submit" variant="secondary" disabled={name.trim() === '' || state.shares.length >= 12}>{t('shares.addButton')}</Button>
            </form>
            {state.shares.length > 0 && (
              <ul className="plain-list">
                {state.shares.map((s) => (
                  <li key={s.id}>
                    <label className="choice"><input type="checkbox" checked={s.paid} onChange={(e) => update((m) => ({ ...m, shares: m.shares.map((x) => (x.id === s.id ? { ...x, paid: e.target.checked } : x)) }))} /><span>{t('shares.row', { name: s.name, amount: formatMoney(s.amount) })}</span></label>
                    <Button variant="tertiary" onClick={() => update((m) => ({ ...m, shares: m.shares.filter((x) => x.id !== s.id) }))}>{t('shares.remove')}<span className="visually-hidden"> {s.name}</span></Button>
                  </li>
                ))}
              </ul>
            )}
            <ShareSliders total={v.trip.plan.total} />
            <p role="status">{t('shares.sum', { paid: formatMoney(sum.paid), owed: formatMoney(sum.owed) })}</p>
          </Card>
        )}
      </Load>
      <p className="muted">{t('shares.note')}</p>
    </Page>
  )
}

/** Price-drop watch (S2-02): a simulated fare history; says whether re-pricing is allowed, the steps and the saving. */
export function PriceWatchScreen() {
  const view = useMine(() => api.payments.get())
  const now = useNow()
  const today = dateIn(now, 'America/New_York')
  return (
    <Page title="route.priceWatch" intro="pwatch.intro">
      <Banner kind="info" title={t('pwatch.sim')} />
      <Load state={view}>
        {(v) => <PriceWatchBody v={v} today={today} />}
      </Load>
    </Page>
  )
}

/** The price-drop card; its own component so the fare history hook runs once per render. */
function PriceWatchBody({ v, today }: { v: PaymentsView; today: string }) {
      const b: WhatIfBooking = { plan: v.trip.plan, guests: v.trip.guests, today, departure: v.trip.departure, balancePaid: v.trip.payment === 'paid', finalDays: daysBetween(v.trip.plan.finalDue, v.trip.departure) }
      const history = useFareHistory(b, v.trip.number)
      if (!history) return <FeedWaiting />
      const w = priceWatch(b, history)
      if (!w) return <p>{t('pwatch.none')}</p>
      return (
        <Card labelledBy="pw-t">
          <h2 id="pw-t" className="card__title">{t('pwatch.title')}</h2>
          <dl className="facts">
            <div><dt>{t('pwatch.booked')}</dt><dd>{formatMoney(v.trip.plan.total)}</dd></div>
            <div><dt>{t('pwatch.now')}</dt><dd>{formatMoney(w.latest.total)}</dd></div>
            <div><dt>{t('pwatch.lowest')}</dt><dd>{formatMoney(w.lowest.total)} · {formatDate(w.lowest.date)}</dd></div>
          </dl>
          <div role="status">
            {w.drop.ok ? (
              <>
                <p>{t('pwatch.ok', { amount: formatMoney(w.drop.saving), date: formatDate(v.trip.plan.finalDue) })}</p>
                <ol>{w.steps.map((s) => <li key={s}>{t(`pwatch.step.${s}` as StringKey)}</li>)}</ol>
                <Link to="/me/contact">{t('pwatch.ask')}</Link>
              </>
            ) : <p>{t(w.drop.reason === 'notLower' ? 'pwatch.notLower' : 'pwatch.afterFinal')}</p>}
          </div>
        </Card>
      )
}
