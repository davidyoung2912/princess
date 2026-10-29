import { useState } from 'react'
import { Link } from 'react-router'
import { asHealthView } from '../../api/guards'
import type { HealthView } from '../../api/types'
import { EMERGENCY_NUMBER } from '../../domain/contacts'
import { formatTime } from '../../domain/cruise'
import { GASTRO, ISOLATE_HOURS, REQUEST_KINDS, RESPONSE_MINUTES, SYMPTOMS, VISIT_FEE, type RequestKind, type Symptom } from '../../domain/health'
import { formatMoney } from '../../domain/pricing'
import type { PersonaId } from '../../domain/personas'
import { isEmergencyCard, MEDICAL_HOURS, MEDICAL_NUMBER } from '../../domain/safety'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { Phone, Siren } from '../icons'
import { BackLink, Saved } from '../onboard/common'
import { duration, useShipTime } from '../onboard/shipTime'
import { ExtraError } from './common'

/** Health on board (SAF-03): hours, fees, early illness reports, and requests for seasickness help, medicine and device power. */
export function HealthScreen() {
  const me = usePersona()
  const copy = useSavedCopy('health', me?.id ?? 'none', () => api.health.view(), asHealthView, [me?.id])
  return (
    <div className="page">
      <h1>{t('route.health')}</h1>
      <p>{t('hlth.intro')}</p>
      <LinkButton to="/ship/help-now" variant="danger" block>{t('hlth.needNow')}</LinkButton>
      <Saved copy={copy}>{(v) => <Health v={v} reload={copy.retry} offline={copy.fromCopy} canAct={!me?.child} />}</Saved>
      <BackLink to="/ship" label={t('route.ship')} />
    </div>
  )
}

function Health({ v, reload, offline, canAct }: { v: HealthView; reload: () => void; offline: boolean; canAct: boolean }) {
  return (
    <>
      {v.notice && <Banner kind="warning" title={t('hlth.notice')}><p>{t('hlth.noticeBody')}</p></Banner>}
      <Hours v={v} />
      <Card labelledBy="fee-h">
        <h2 id="fee-h" className="card__title">{t('hlth.fees')}</h2>
        <ul className="plain-bullets">
          <li>{t('hlth.feeVisit', { amount: formatMoney(VISIT_FEE.visit) })}</li>
          <li>{t('hlth.feeAfter', { amount: formatMoney(VISIT_FEE.afterHours) })}</li>
          <li>{t('hlth.feeFree')}</li>
        </ul>
        <p>{t('hlth.insurance')}</p>
      </Card>
      {v.isolating && <Isolation />}
      {canAct && !offline ? <Report v={v} reload={reload} /> : <p className="muted">{canAct ? t('hlth.needsSignal') : t('plan.readOnly.body')}</p>}
      {canAct && !offline && <Request reload={reload} />}
      <Records v={v} />
    </>
  )
}

function Hours({ v }: { v: HealthView }) {
  return (
    <Card hero labelledBy="hours-h">
      <h2 id="hours-h" className="card__title">{t('hlth.hours')}</h2>
      <p className="muted">{t(v.day === 'sea' ? 'hlth.seaDay' : 'hlth.portDay')}</p>
      <p role="status"><strong>{v.open ? t('hlth.openNow') : v.nextOpen ? t('hlth.closedUntil', { time: formatTime(v.nextOpen) }) : t('hlth.closedToday')}</strong></p>
      <ul className="plain-bullets">{MEDICAL_HOURS[v.day].map(([a, b]) => <li key={a}>{formatTime(a)} {t('hlth.to')} {formatTime(b)}</li>)}</ul>
      <p>{t('hlth.afterHours')}</p>
      <a className="btn btn--secondary" href={`tel:${MEDICAL_NUMBER}`}><Phone aria-hidden="true" /> {t('hlth.callMedical', { number: MEDICAL_NUMBER })}</a>
    </Card>
  )
}

function Isolation() {
  return (
    <Banner kind="warning" title={t('hlth.isolating')}>
      <ul className="plain-bullets">
        <li>{t('hlth.iso.stay', { hours: ISOLATE_HOURS })}</li>
        <li>{t('hlth.iso.fluids')}</li>
        <li>{t('hlth.iso.meals')} <Link to="/ship/order">{t('route.order')}</Link></li>
        <li>{t('hlth.iso.worse', { number: MEDICAL_NUMBER })}</li>
        <li>{t('hlth.iso.hands')}</li>
      </ul>
    </Banner>
  )
}

function Report({ v, reload }: { v: HealthView; reload: () => void }) {
  const [guests, setGuests] = useState<PersonaId[]>([])
  const [symptoms, setSymptoms] = useState<Symptom[]>([])
  const [ago, setAgo] = useState(0)
  const [sent, setSent] = useState(false)
  const send = useAction(async () => { await api.health.report({ guests, symptoms, startedHoursAgo: ago }); setSent(true); setGuests([]); setSymptoms([]); reload() })
  const gastro = symptoms.some((s) => GASTRO.includes(s))
  return (
    <section aria-labelledby="rep-h">
      <h2 id="rep-h">{t('hlth.report')}</h2>
      <p>{t('hlth.reportBody')}</p>
      <form onSubmit={(e) => { e.preventDefault(); setSent(false); void send.run() }}>
        <fieldset className="plain-fieldset">
          <legend>{t('hlth.who')}</legend>
          {v.guests.map((g) => <label key={g.id} className="choice"><input type="checkbox" checked={guests.includes(g.id)} onChange={() => setGuests(guests.includes(g.id) ? guests.filter((x) => x !== g.id) : [...guests, g.id])} /><span>{g.name}</span></label>)}
        </fieldset>
        <fieldset className="plain-fieldset">
          <legend>{t('hlth.symptoms')}</legend>
          {SYMPTOMS.map((s) => <label key={s} className="choice"><input type="checkbox" checked={symptoms.includes(s)} onChange={() => setSymptoms(symptoms.includes(s) ? symptoms.filter((x) => x !== s) : [...symptoms, s])} /><span>{t(`hlth.sym.${s}` as StringKey)}</span></label>)}
        </fieldset>
        <div className="field">
          <label htmlFor="rep-ago">{t('hlth.started')}</label>
          <select id="rep-ago" className="field__input" value={ago} onChange={(e) => setAgo(Number(e.target.value))}>
            {[0, 2, 6, 12, 24, 48, 72].map((h) => <option key={h} value={h}>{h === 0 ? t('hlth.justNow') : t('hlth.hoursAgo', { count: h })}</option>)}
          </select>
        </div>
        {gastro && <Banner kind="warning" title={t('hlth.gastroTitle')}><p>{t('hlth.gastroBody', { hours: ISOLATE_HOURS })}</p></Banner>}
        <ExtraError error={send.error} />
        <Button type="submit" disabled={send.busy || guests.length === 0 || symptoms.length === 0}>{send.busy ? t('account.saving') : t('hlth.send')}</Button>
        {(guests.length === 0 || symptoms.length === 0) && <p className="muted">{t('hlth.pick')}</p>}
        {sent && <Banner kind="success" title={t('hlth.sent')}><p>{t('hlth.sentBody', { time: duration(RESPONSE_MINUTES.illness) })}</p></Banner>}
      </form>
      <p className="muted">{t('hlth.private')}</p>
    </section>
  )
}

function Request({ reload }: { reload: () => void }) {
  const [kind, setKind] = useState<RequestKind>('seasick')
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)
  const send = useAction(async () => { await api.health.request(kind, note); setNote(''); setSent(true); reload() })
  return (
    <section aria-labelledby="req-h">
      <h2 id="req-h">{t('hlth.request')}</h2>
      <form onSubmit={(e) => { e.preventDefault(); setSent(false); void send.run() }}>
        <div className="field">
          <label htmlFor="req-kind">{t('hlth.kind')}</label>
          <select id="req-kind" className="field__input" value={kind} onChange={(e) => setKind(e.target.value as RequestKind)}>{REQUEST_KINDS.map((k) => <option key={k} value={k}>{t(`hlth.kind.${k}` as StringKey)}</option>)}</select>
          <p className="field__hint">{t(`hlth.kindHelp.${kind}` as StringKey, { time: duration(RESPONSE_MINUTES[kind]) })}</p>
        </div>
        <div className="field">
          <label htmlFor="req-note">{t('hlth.note')}</label>
          <input id="req-note" className="field__input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </div>
        <ExtraError error={send.error} />
        <Button type="submit" variant="secondary" disabled={send.busy}>{t('hlth.sendRequest')}</Button>
        {sent && <p role="status">{t('hlth.requestSent')}</p>}
      </form>
    </section>
  )
}

function Records({ v }: { v: HealthView }) {
  const shipTime = useShipTime()
  if (v.reports.length === 0 && v.requests.length === 0) return null
  return (
    <section aria-labelledby="rec-h">
      <h2 id="rec-h">{t('hlth.records')}</h2>
      <p className="muted">{t('hlth.recordsNote')}</p>
      <ul className="plain-bullets">
        {v.reports.map((r) => <li key={r.id}>{shipTime(r.at)}: {t('hlth.recReport', { symptoms: r.symptoms.map((s) => t(`hlth.sym.${s}` as StringKey)).join(', '), count: r.guests.length })}</li>)}
        {v.requests.map((r) => <li key={r.id}>{shipTime(r.at)}: {t(`hlth.kind.${r.kind}` as StringKey)}{r.note && ` (${r.note})`}</li>)}
      </ul>
    </section>
  )
}

type Need = 'heart' | 'fall'

/** "I need medical help now" (SAF-08): very large buttons and as few words as possible; the number to call and the words to say, with the stateroom ready to read aloud. */
export function HelpNowScreen() {
  const me = usePersona()
  const [need, setNeed] = useState<Need | null>(null)
  const copy = useSavedCopy('emergency', me?.id ?? 'none', () => api.onboard.emergency(), (raw) => (isEmergencyCard(raw) ? raw : null), [me?.id])
  const card = copy.data
  return (
    <div className="page help-now">
      <h1>{t('route.helpNow')}</h1>
      <a className="btn btn--danger btn--block help-now__call" href={`tel:${MEDICAL_NUMBER}`}><Phone aria-hidden="true" /> {t('help.callMedical', { number: MEDICAL_NUMBER })}</a>
      <a className="btn btn--danger btn--block help-now__call" href={`tel:${EMERGENCY_NUMBER}`}><Siren aria-hidden="true" /> {t('help.callEmergency', { number: EMERGENCY_NUMBER })}</a>

      <Card hero labelledBy="say-now-h">
        <h2 id="say-now-h" className="card__title">{t('help.say')}</h2>
        {card ? (
          <>
            <p className="help-now__big">{card.script}</p>
            <p className="help-now__big">{t('help.cabin', { cabin: card.stateroom, deck: card.deck })}</p>
          </>
        ) : <p>{copy.status === 'error' ? t('help.noCard') : t('account.loading')}</p>}
      </Card>

      <fieldset className="plain-fieldset">
        <legend className="help-now__legend">{t('help.what')}</legend>
        <div className="help-now__choices">
          <Button variant="secondary" block aria-pressed={need === 'heart'} onClick={() => setNeed('heart')}>{t('help.heart')}</Button>
          <Button variant="secondary" block aria-pressed={need === 'fall'} onClick={() => setNeed('fall')}>{t('help.fall')}</Button>
        </div>
      </fieldset>
      {need && (
        <Card labelledBy="steps-h">
          <h2 id="steps-h" className="card__title">{t('help.then')}</h2>
          <ol className="help-now__steps">
            {(need === 'heart' ? (['sayHeart', 'unlock', 'someone', 'still'] as const) : (['sayFall', 'unlock', 'someone', 'still'] as const)).map((k) => <li key={k}>{t(`help.step.${k}` as StringKey)}</li>)}
          </ol>
        </Card>
      )}
      {copy.fromCopy && <Banner kind="offline" title={t('onb.offline')}><p>{t('emerg.copy')}</p></Banner>}
      <p><Link to="/ship/emergency">{t('route.emergency')}</Link> · <Link to="/ship/health">{t('route.health')}</Link></p>
    </div>
  )
}
