import { useState } from 'react'
import { Link } from 'react-router'
import type { GuestDraft } from '../../domain/booking'
import { formatDate } from '../../domain/cruise'
import { CURRENCIES } from '../../domain/services'
import {
  canSaveTraveller, cleanNickname, forgetTraveller, homeRates, isHomeCurrency, MOODS, NICKNAME_MAX, passportByPort, rankPorts, recapMailto, remindFrom, reminderState,
  RING_RADIUS, ringDash, saveTraveller, smallThing, unusedSaved, wantsSeaDays, worstEntry, type MoodId,
} from '../../domain/prepareDelights'
import { personReadiness } from '../../domain/bookingPrep'
import { passportValidUntil, type Citizenship } from '../../domain/documents'
import { portById, sailingById } from '../../domain/sailings'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { useNow, useSailing } from '../../hooks/useDemo'
import { useRates } from '../../hooks/useRates'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { useSettings } from '../../hooks/useSettings'
import { t, th, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'

/** D3-1: a ring that fills as a traveller's papers, payments and requests are done. The number is always written too. */
export function ReadyRing({ percent, label }: { percent: number; label: string }) {
  const { circumference, filled } = ringDash(percent)
  return (
    <svg className="ready-ring" viewBox="0 0 100 100" role="img" aria-label={label}>
      <circle className="ready-ring__track" cx="50" cy="50" r={RING_RADIUS} />
      <circle className="ready-ring__fill" cx="50" cy="50" r={RING_RADIUS} strokeDasharray={`${filled} ${circumference}`} transform="rotate(-90 50 50)" />
      <text x="50" y="56" textAnchor="middle" className="ready-ring__text" aria-hidden="true">{Math.round(percent)}%</text>
    </svg>
  )
}

/** D3-1 on Home: the signed-in traveller's own ring and the next thing still open. Nothing shows until both answers have arrived. */
export function HomeReadyCard() {
  const { me } = useMemory()
  const list = useMine(() => api.plan.checklist.get())
  const docs = useMine(() => api.documents.get())
  if (!list.data || !docs.data) return null
  const g = docs.data.guests.find((x) => x.id === me?.id) ?? docs.data.guests[0]
  if (!g) return null
  const r = personReadiness(list.data.entries, g.blocking)
  const label = t('ready.percent', { name: g.name, percent: r.percent })
  const next = r.open[0]
  return (
    <Card labelledBy="dl5-home-ring-h">
      <h2 id="dl5-home-ring-h" className="card__title">{th('dl5.homeRing.title')}</h2>
      <div className="ready-ring-row">
        <ReadyRing percent={r.percent} label={label} />
        <div>
          <p><strong>{label}</strong></p>
          <p>{next ? t('dl5.homeRing.next', { item: t(`plan.check.item.${next.id}` as StringKey), date: formatDate(next.due) }) : t('ready.all')}</p>
          <Link to="/plan/readiness">{t('route.readiness')}</Link>
        </div>
      </div>
    </Card>
  )
}

/** D3-2: one two-minute task a week, shown quietly on Home. Done ticks it off; "Not for me" turns the card off for good. */
export function SmallThingCard({ daysToDeparture }: { daysToDeparture: number }) {
  const { state, update } = useMemory()
  const [settings] = useSettings()
  const thing = smallThing(daysToDeparture, state.prepare.smallDone, state.prepare.smallOff)
  if (!thing || settings.nudgesPerDay === 0 || settings.calm) return null
  return (
    <Card labelledBy="dl5-small-h">
      <h2 id="dl5-small-h" className="card__title">{th('dl5.small.title')}</h2>
      <p>{t(`dl5.small.${thing.id}` as StringKey)}</p>
      <p className="muted">{t('dl5.small.minutes')}</p>
      <div className="button-row">
        {thing.to && <Link to={thing.to}>{t('dl5.small.go')}</Link>}
        <Button variant="secondary" onClick={() => update((s) => ({ ...s, prepare: { ...s.prepare, smallDone: [...s.prepare.smallDone, thing.id] } }))}>{t('dl5.small.done')}</Button>
        <Button variant="tertiary" onClick={() => update((s) => ({ ...s, prepare: { ...s.prepare, smallOff: true } }))}>{t('dl5.small.off')}</Button>
      </div>
    </Card>
  )
}

/** D3-3: type a passport expiry date and see, stop by stop, whether it is long enough. Typed here, checked here, never kept. */
export function PassportByPortCard() {
  const sailing = useSailing()
  const docs = useMine(() => api.documents.get())
  const [expires, setExpires] = useState('')
  const [chosen, setChosen] = useState<Citizenship | null>(null)
  // Starts from what the guest told us about the first traveller; they can change it for anyone.
  const citizenship: Citizenship = chosen ?? docs.data?.guests[0]?.citizenship ?? 'us'
  const checks = passportByPort(expires, sailing, citizenship)
  const worst = checks ? worstEntry(checks) : null
  return (
    <Card labelledBy="dl5-pass-h">
      <h2 id="dl5-pass-h" className="card__title">{th('dl5.pass.title')}</h2>
      <p>{t('dl5.pass.body', { date: formatDate(passportValidUntil(sailing.departure)) })}</p>
      <fieldset>
        <legend>{t('clr.who')}</legend>
        {(['us', 'other'] as const).map((c) => (
          <label key={c} className="choice"><input type="radio" name="dl5-pass-who" checked={citizenship === c} onChange={() => setChosen(c)} />{t(`clr.who.${c}` as StringKey)}</label>
        ))}
      </fieldset>
      <Field label={t('dl5.pass.field')} type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
      <div aria-live="polite">
        {checks && worst && (
          <>
            <p><strong>{t(`dl5.pass.worst.${worst}` as StringKey)}</strong></p>
            <ul className="plain-list">
              {checks.map((c) => (
                <li key={c.port}>
                  <span><strong>{c.port === 'fll' ? t('dl5.pass.home') : portById(c.port)?.name ?? c.port}</strong> · {formatDate(c.date)}<br />{t(`dl5.pass.${c.status}` as StringKey, { until: formatDate(c.needUntil) })}{c.visaCheck && <><br />{t('dl5.pass.visa')}</>}{c.source && <><br /><a href={c.source} target="_blank" rel="noreferrer">{t('dl5.pass.source')}<span className="visually-hidden"> {t('embark.newTab')}</span></a>{c.asOf && <span className="muted"> · {t('dl5.pass.asOf', { date: formatDate(c.asOf) })}</span>}</>}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <p className="muted">{t('dl5.pass.note')} <Link to="/me/documents">{t('route.documents')}</Link></p>
    </Card>
  )
}

/** D3-8: what $100 is worth at home and on the way, with the date of the rate. */
export function HomeMoneyCard() {
  const { state, update } = useMemory()
  const { table } = useRates()
  const h = homeRates(table, state.prepare.homeCurrency)
  return (
    <Card labelledBy="dl5-money-h">
      <h2 id="dl5-money-h" className="card__title">{th('dl5.money.title')}</h2>
      <div className="field">
        <label htmlFor="dl5-home-cur">{t('dl5.money.field')}</label>
        <select id="dl5-home-cur" className="field__input" value={state.prepare.homeCurrency} onChange={(e) => { if (isHomeCurrency(e.target.value)) update((s) => ({ ...s, prepare: { ...s.prepare, homeCurrency: e.target.value } })) }}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </div>
      <p><strong>{t('dl5.money.home', { amount: h.home })}</strong></p>
      <ul className="plain-list">{h.ports.map((p) => <li key={p.code}>{t('dl5.money.port', { amount: p.text, code: p.code })}</li>)}</ul>
      <p className="muted">{t('dl5.money.asOf', { date: formatDate(h.asOf) })} {t('dl5.money.note')}</p>
    </Card>
  )
}

/** D0-2: a name for the trip that shows wherever it appears next (Home, the decision summary, the invitation). */
export function NicknameCard() {
  const { state, update } = useMemory()
  const [text, setText] = useState(state.prepare.nickname)
  const save = () => update((s) => ({ ...s, prepare: { ...s.prepare, nickname: cleanNickname(text) } }))
  return (
    <Card labelledBy="dl5-nick-h">
      <h2 id="dl5-nick-h" className="card__title">{th('dl5.nick.title')}</h2>
      <Field label={t('dl5.nick.field')} hint={t('dl5.nick.hint')} value={text} maxLength={NICKNAME_MAX} onChange={(e) => setText(e.target.value)} onBlur={save} />
      <div className="button-row">
        <Button variant="secondary" onClick={save}>{t('dl5.nick.save')}</Button>
        {state.prepare.nickname && <Button variant="tertiary" onClick={() => { setText(''); update((s) => ({ ...s, prepare: { ...s.prepare, nickname: '' } })) }}>{t('dl5.nick.clear')}</Button>}
      </div>
    </Card>
  )
}

/** The nickname as a quiet line under a heading; nothing when there is none. */
export function NicknameLine() {
  const { state } = useMemory()
  return state.prepare.nickname ? <p className="muted">{t('dl5.nick.line', { name: state.prepare.nickname })}</p> : null
}

/** D0-4: tap what sounds good; the stops are put in order of how well they match, and each says why. */
export function MoodTiles() {
  const { state, update } = useMemory()
  const picked = state.prepare.moods
  const toggle = (m: MoodId) => update((s) => ({ ...s, prepare: { ...s.prepare, moods: s.prepare.moods.includes(m) ? s.prepare.moods.filter((x) => x !== m) : [...s.prepare.moods, m] } }))
  const ranked = rankPorts(picked)
  return (
    <Card labelledBy="dl5-mood-h">
      <h2 id="dl5-mood-h" className="card__title">{th('dl5.mood.title')}</h2>
      <p>{t('dl5.mood.body')}</p>
      <fieldset className="plain-fieldset">
        <legend>{t('dl5.mood.legend')}</legend>
        {MOODS.map((m) => (
          <label key={m} className="choice"><input type="checkbox" checked={picked.includes(m)} onChange={() => toggle(m)} /><span>{t(`dl5.mood.${m}` as StringKey)}</span></label>
        ))}
      </fieldset>
      <h3>{th('dl5.mood.order')}</h3>
      <ol className="plain-list" aria-live="polite">
        {ranked.map((r) => (
          <li key={r.port}>
            <span>
              <strong>{r.name}</strong><br />
              {r.matched.length > 0 ? t('dl5.mood.why', { moods: r.matched.map((m) => t(`dl5.mood.${m}` as StringKey).toLowerCase()).join(', ') }) : picked.length > 0 ? t('dl5.mood.none') : t('dl5.mood.pick')}
            </span>
          </li>
        ))}
      </ol>
      {wantsSeaDays(picked) && <p>{t('dl5.mood.sea')}</p>}
      <p className="muted">{t('dl5.mood.note')}</p>
    </Card>
  )
}

/** D0-8: one tap to come back to this in a week. It shows on Home once, when the week is up, and never repeats. */
export function RemindCard({ sailingId }: { sailingId: string }) {
  const { state, update } = useMemory()
  const now = useNow()
  const r = state.prepare.remind
  const st = reminderState(r, now)
  const [email, setEmail] = useState(false)
  return (
    <Card labelledBy="dl5-remind-h">
      <h2 id="dl5-remind-h" className="card__title">{th('dl5.remind.title')}</h2>
      {st === 'none' ? (
        <>
          <p>{t('dl5.remind.body')}</p>
          <label className="choice"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /><span>{t('dl5.remind.email')}</span></label>
          <Button variant="secondary" onClick={() => update((s) => ({ ...s, prepare: { ...s.prepare, remind: remindFrom(now, sailingId, email) } }))}>{t('dl5.remind.set')}</Button>
        </>
      ) : (
        <>
          <p role="status">{t('dl5.remind.waiting', { date: formatDate(new Date(r!.at).toISOString().slice(0, 10)) })}</p>
          <label className="choice"><input type="checkbox" checked={r!.email} onChange={(e) => update((s) => ({ ...s, prepare: { ...s.prepare, remind: s.prepare.remind ? { ...s.prepare.remind, email: e.target.checked } : null } }))} /><span>{t('dl5.remind.email')}</span></label>
          <Button variant="tertiary" onClick={() => update((s) => ({ ...s, prepare: { ...s.prepare, remind: null } }))}>{t('dl5.remind.cancel')}</Button>
        </>
      )}
      <p className="muted">{t('dl5.remind.note')}</p>
    </Card>
  )
}

/** Shown on Home when the week is up: one plain note, then it is gone. */
export function ReminderDueCard() {
  const { state, update } = useMemory()
  const now = useNow()
  const r = state.prepare.remind
  if (reminderState(r, now) !== 'due' || !r) return null
  const sailing = sailingById(r.sailingId)
  return (
    <Card labelledBy="dl5-due-h">
      <h2 id="dl5-due-h" className="card__title">{th('dl5.due.title')}</h2>
      <p>{sailing ? t('dl5.due.body', { date: formatDate(sailing.departure) }) : t('dl5.due.bodyPlain')}</p>
      <div className="button-row">
        <Link to="/home/decide">{t('route.decide')}</Link>
        <Button variant="tertiary" onClick={() => update((s) => ({ ...s, prepare: { ...s.prepare, remind: null } }))}>{t('dl5.due.done')}</Button>
      </div>
    </Card>
  )
}

/** D2-6: on the guests form, offer the people saved before, and save the one being typed. */
export function SavedTravellers({ people, onPick }: { people: readonly GuestDraft[]; onPick: (saved: { firstName: string; lastName: string; dob: string; citizenship: GuestDraft['citizenship'] }) => void }) {
  const { state, update } = useMemory()
  const list = state.prepare.travellers
  const offer = unusedSaved(list, people)
  const savable = people.filter((g) => canSaveTraveller(g) && unusedSaved(list, [g]).length === list.length)
  const [note, setNote] = useState('')
  if (list.length === 0 && savable.length === 0) return null
  return (
    <section aria-labelledby="dl5-trav-h" className="saved-travellers">
      <h3 id="dl5-trav-h">{th('dl5.trav.title')}</h3>
      {offer.length > 0 && (
        <ul className="plain-list">
          {offer.map((s) => (
            <li key={s.id}>
              <span>{s.firstName} {s.lastName}</span>
              <span className="button-row">
                <Button variant="secondary" onClick={() => { onPick(s); setNote(t('dl5.trav.used', { name: s.firstName })) }}>{t('dl5.trav.use')}<span className="visually-hidden"> {s.firstName} {s.lastName}</span></Button>
                <Button variant="tertiary" onClick={() => { update((m) => ({ ...m, prepare: { ...m.prepare, travellers: forgetTraveller(m.prepare.travellers, s.id) } })); setNote(t('dl5.trav.forgot', { name: s.firstName })) }}>{t('dl5.trav.forget')}<span className="visually-hidden"> {s.firstName} {s.lastName}</span></Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {savable.map((g) => (
        <p key={`${g.firstName}-${g.lastName}-${g.dob}`}>
          <Button variant="tertiary" onClick={() => { update((m) => ({ ...m, prepare: { ...m.prepare, travellers: saveTraveller(m.prepare.travellers, g, newMemoryId()) } })); setNote(t('dl5.trav.saved', { name: g.firstName })) }}>{t('dl5.trav.save', { name: g.firstName })}</Button>
        </p>
      ))}
      <p className="muted" role="status">{note}</p>
      <p className="muted">{t('dl5.trav.note')}</p>
    </section>
  )
}

/** D2-8: the recap as an email the guest sends themselves, to whoever they need to check with. */
export function EmailRecap({ subject, body }: { subject: string; body: string }) {
  const [to, setTo] = useState('')
  return (
    <div>
      <Field label={t('dl5.mail.to')} hint={t('dl5.mail.hint')} type="email" inputMode="email" autoComplete="off" value={to} onChange={(e) => setTo(e.target.value)} />
      <a className="btn btn--secondary" href={recapMailto(to, subject, body)}>{th('dl5.mail.open')}</a>
      <p className="muted">{t('dl5.mail.note')}</p>
    </div>
  )
}
