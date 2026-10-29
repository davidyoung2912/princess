import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { CheckinSave, CheckinView } from '../../api/types'
import { BRAND_NAMES, validateCard } from '../../domain/account'
import { CONTRACT, HEALTH_QUESTIONS, judgePhoto, measurePhoto, SAMPLE_PHOTOS, type DocumentKind, type PhotoMetrics } from '../../domain/checkin'
import { WAIT_MINUTES } from '../../domain/boarding'
import { formatDate, formatTime } from '../../domain/cruise'
import { dateIn } from '../../domain/timezones'
import type { PersonaId } from '../../domain/personas'
import { demoNow } from '../../demo/store'
import { useAction } from '../../hooks/useAction'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Field } from '../Field'
import { CheckinError } from './CheckinError'
import { pending, useChosenGuest } from './guests'
import { ApplyTo, GuestChooser } from './parts'

export interface StepProps {
  view: CheckinView
  /** Saves, then moves on to whatever is left. */
  save: (input: CheckinSave) => Promise<unknown>
  busy: boolean
  error: ReturnType<typeof useAction>['error']
}

const Form = ({ onSubmit, children, error, busy, label }: { onSubmit: () => void; children: ReactNode; error: StepProps['error']; busy: boolean; label: string }) => (
  <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit() }} noValidate>
    {children}
    <CheckinError error={error} />
    <Button type="submit" disabled={busy}>{busy ? t('checkin.saving') : label}</Button>
  </form>
)

export function ConfirmStep({ view, save, busy, error }: StepProps) {
  const [who, setWho] = useState<PersonaId[]>(pending(view, 'confirm'))
  return (
    <>
      <p>{t('checkin.confirm.intro')}</p>
      <ul className="plain-list">
        {view.guests.map((g) => (
          <li key={g.id}>
            <span><strong>{g.name}</strong><br /><span className="muted">{t(g.citizenship === 'us' ? 'checkin.confirm.us' : 'checkin.confirm.other')} · {t('plan.age', { age: g.age })}</span></span>
            <Link to={`/me/profile/${g.id}`}>{t('checkin.confirm.fix')}<span className="visually-hidden"> {g.name}</span></Link>
          </li>
        ))}
      </ul>
      <Form onSubmit={() => void save({ step: 'confirm', guests: who })} error={error} busy={busy || who.length === 0} label={t('checkin.confirm.button')}>
        <ApplyTo view={view} step="confirm" value={who} onChange={setWho} />
      </Form>
    </>
  )
}

export function DocumentStep({ view, save, busy, error }: StepProps) {
  const [guest, choose] = useChosenGuest(view, 'document')
  return <DocumentForm key={guest.id} view={view} guestId={guest.id} choose={choose} save={save} busy={busy} error={error} />
}

function DocumentForm({ view, guestId, choose, save, busy, error }: StepProps & { guestId: PersonaId; choose: (id: PersonaId) => void }) {
  const guest = view.guests.find((g) => g.id === guestId)!
  const saved = guest.record.document
  const [kind, setKind] = useState<DocumentKind>(saved?.kind ?? guest.defaults.documentKind)
  const [country, setCountry] = useState(saved?.country ?? (guest.citizenship === 'us' ? 'United States' : ''))
  const [number, setNumber] = useState('')
  const [expires, setExpires] = useState(saved?.expires ?? guest.defaults.passportExpires)
  return (
    <>
      <GuestChooser view={view} step="document" value={guestId} onChange={choose} />
      <p>{t('checkin.document.intro', { name: guest.first })}</p>
      <Banner kind="info" title={t('checkin.document.noScan')}><p>{t('checkin.document.noScanBody')}</p></Banner>
      {saved && <p role="status">{saved.kind === 'passport' ? t('checkin.document.saved', { last4: saved.last4 }) : t('checkin.document.savedBirth')}</p>}
      <Form onSubmit={() => void save({ step: 'document', guest: guestId, kind, country, number, expires })} error={error} busy={busy} label={t('checkin.document.button', { name: guest.first })}>
        <fieldset>
          <legend>{t('checkin.document.kind')}</legend>
          <label className="choice"><input type="radio" name="kind" checked={kind === 'passport'} onChange={() => setKind('passport')} /><span>{t('checkin.document.passport')}</span></label>
          {guest.citizenship === 'us' && (
            <label className="choice"><input type="radio" name="kind" checked={kind === 'birthCertificate'} onChange={() => setKind('birthCertificate')} /><span>{t('checkin.document.birth')}<small>{t('checkin.document.birthHint')}</small></span></label>
          )}
        </fieldset>
        {kind === 'passport' ? (
          <>
            <Field label={t('checkin.document.country')} value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="country-name" />
            <Field label={t('checkin.document.number')} hint={t('checkin.document.numberHint')} value={number} onChange={(e) => setNumber(e.target.value)} autoComplete="off" spellCheck={false} />
            <Field label={t('checkin.document.expires')} hint={t('checkin.document.expiresHint', { date: formatDate(view.returnDate) })} type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </>
        ) : <p>{t('checkin.document.birthBody')}</p>}
      </Form>
    </>
  )
}

/** Loads a picked picture, shrinks it, and measures it on this device; the picture itself never leaves the phone. */
async function measureFile(file: File): Promise<PhotoMetrics> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 96 / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.drawImage(bitmap, 0, 0, w, h)
  const m = measurePhoto(w, h, ctx.getImageData(0, 0, w, h).data, bitmap.width, bitmap.height)
  bitmap.close()
  return m
}

export function PhotoStep({ view, save, busy, error }: StepProps) {
  const [guest, choose] = useChosenGuest(view, 'photo')
  const [local, setLocal] = useState<string[]>([])
  const [reading, setReading] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const submit = async (m: PhotoMetrics) => {
    const problems = judgePhoto(m)
    setLocal(problems)
    if (problems.length === 0) await save({ step: 'photo', guest: guest.id, metrics: m })
  }
  const onFile = async (file: File | undefined) => {
    if (!file) return
    setReading(true)
    try { await submit(await measureFile(file)) } catch { setLocal(['unreadable']) } finally { setReading(false) }
  }
  return (
    <>
      <GuestChooser view={view} step="photo" value={guest.id} onChange={(id) => { setLocal([]); choose(id) }} />
      <p>{t('checkin.photo.intro', { name: guest.first })}</p>
      <ul className="plain-bullets">{(['light', 'face', 'still', 'plain'] as const).map((k) => <li key={k}>{t(`checkin.photo.tip.${k}` as StringKey)}</li>)}</ul>
      {guest.record.photo && <p role="status">{t('checkin.photo.saved')}</p>}
      <div className="field">
        <label htmlFor="photo-file">{t('checkin.photo.pick', { name: guest.first })}</label>
        <p className="field__hint">{t('checkin.photo.privacy')}</p>
        <input id="photo-file" ref={input} type="file" accept="image/*" capture="user" className="field__input" disabled={busy || reading} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {local.length > 0 && (
        <div role="alert" className="field__error"><span>{local.map((p) => t(`checkin.err.photo.${p}` as StringKey)).join(' ')}</span></div>
      )}
      <CheckinError error={error} />
      <p role="status">{reading ? t('checkin.photo.checking') : busy ? t('checkin.saving') : ''}</p>
      <details className="demo-box">
        <summary>{t('checkin.photo.demo')}</summary>
        <p className="muted">{t('checkin.photo.demoBody')}</p>
        <div className="button-row">
          {(['good', 'dark', 'blurry'] as const).map((k) => <Button key={k} variant="secondary" disabled={busy} onClick={() => void submit(SAMPLE_PHOTOS[k])}>{t(`checkin.photo.sample.${k}` as StringKey)}</Button>)}
        </div>
      </details>
    </>
  )
}

export function EmergencyStep({ view, save, busy, error }: StepProps) {
  const first = view.guests.find((g) => !g.record.emergency) ?? view.guests[0]
  const base = first.record.emergency ?? first.defaults.emergency
  const [who, setWho] = useState<PersonaId[]>(pending(view, 'emergency'))
  const [name, setName] = useState(base.name)
  const [phone, setPhone] = useState(base.phone)
  const [relationship, setRelationship] = useState(base.relationship)
  return (
    <>
      <p>{t('checkin.emergency.intro')}</p>
      <Form onSubmit={() => void save({ step: 'emergency', guests: who, name, phone, relationship })} error={error} busy={busy || who.length === 0} label={t('checkin.emergency.button')}>
        <Field label={t('checkin.emergency.name')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        <Field label={t('checkin.emergency.phone')} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" />
        <Field label={t('checkin.emergency.relationship')} value={relationship} onChange={(e) => setRelationship(e.target.value)} autoComplete="off" />
        {view.guests.length > 1 && <ApplyTo view={view} step="emergency" value={who} onChange={setWho} />}
      </Form>
    </>
  )
}

export function PaymentStep({ view, save, busy, error }: StepProps) {
  const today = dateIn(demoNow(), 'America/New_York')
  const usable = view.cards.filter((c) => !validateCard(c.last4, c.expiry, today))
  const [cardId, setCardId] = useState(view.payment?.cardId && usable.some((c) => c.id === view.payment!.cardId) ? view.payment.cardId : (usable[0]?.id ?? ''))
  return (
    <>
      <p>{t('checkin.payment.intro')}</p>
      {view.payment && <p role="status">{t('checkin.payment.saved', { card: view.payment.label })}</p>}
      {usable.length === 0 ? (
        <Banner kind="warning" title={t('checkin.payment.none')} action={<Link className="btn btn--secondary" to="/me/payments">{t('route.payments')}</Link>}><p>{t('checkin.payment.noneBody')}</p></Banner>
      ) : (
        <Form onSubmit={() => void save({ step: 'payment', cardId })} error={error} busy={busy || !cardId} label={t('checkin.payment.button')}>
          <fieldset>
            <legend>{t('checkin.payment.choose')}</legend>
            {usable.map((c) => (
              <label key={c.id} className="choice"><input type="radio" name="card" checked={c.id === cardId} onChange={() => setCardId(c.id)} /><span>{BRAND_NAMES[c.brand]} {t('checkin.payment.ending', { last4: c.last4 })}<small>{t('checkin.payment.expires', { expiry: c.expiry })}</small></span></label>
            ))}
          </fieldset>
          <p className="muted">{t('checkin.payment.note')} <Link to="/me/payments">{t('checkin.payment.add')}</Link></p>
        </Form>
      )}
    </>
  )
}

export function ContractStep({ view, save, busy, error }: StepProps) {
  const [who, setWho] = useState<PersonaId[]>(pending(view, 'contract'))
  const [agreed, setAgreed] = useState(false)
  const kids = view.guests.some((g) => g.child)
  return (
    <>
      <p>{t('checkin.contract.intro')}</p>
      <section className="card" aria-labelledby="contract-h">
        <h2 id="contract-h" className="card__title">{CONTRACT.title}</h2>
        <p className="muted">{t('checkin.contract.version', { version: CONTRACT.version })}</p>
        {CONTRACT.body.map((p) => <p key={p}>{p}</p>)}
      </section>
      <Form onSubmit={() => void save({ step: 'contract', guests: who })} error={error} busy={busy || !agreed || who.length === 0} label={t('checkin.contract.button')}>
        {view.guests.length > 1 && <ApplyTo view={view} step="contract" value={who} onChange={setWho} />}
        {kids && <p className="muted">{t('checkin.contract.kids')}</p>}
        <label className="choice choice--top"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /><span>{CONTRACT.statement}</span></label>
      </Form>
    </>
  )
}

export function HealthStep({ view, save, busy, error }: StepProps) {
  const [guest, choose] = useChosenGuest(view, 'health')
  return <HealthForm key={guest.id} view={view} guestId={guest.id} choose={choose} save={save} busy={busy} error={error} />
}

function HealthForm({ view, guestId, choose, save, busy, error }: StepProps & { guestId: PersonaId; choose: (id: PersonaId) => void }) {
  const guest = view.guests.find((g) => g.id === guestId)!
  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>(guest.record.health?.answers ?? {})
  const complete = HEALTH_QUESTIONS.every((q) => typeof answers[q] === 'boolean')
  const flagged = HEALTH_QUESTIONS.some((q) => answers[q] === true)
  return (
    <>
      <GuestChooser view={view} step="health" value={guestId} onChange={choose} />
      <p>{t('checkin.health.intro', { name: guest.first })}</p>
      <Form onSubmit={() => void save({ step: 'health', guest: guestId, answers: answers as Record<string, boolean> })} error={error} busy={busy || !complete} label={t('checkin.health.button', { name: guest.first })}>
        {HEALTH_QUESTIONS.map((q) => (
          <fieldset key={q}>
            <legend>{t(`checkin.health.q.${q}` as StringKey)}</legend>
            <label className="choice"><input type="radio" name={`h-${q}`} checked={answers[q] === false} onChange={() => setAnswers({ ...answers, [q]: false })} /><span>{t('common.no')}</span></label>
            <label className="choice"><input type="radio" name={`h-${q}`} checked={answers[q] === true} onChange={() => setAnswers({ ...answers, [q]: true })} /><span>{t('common.yes')}</span></label>
          </fieldset>
        ))}
        {flagged && <Banner kind="info" title={t('checkin.health.flagged')}><p>{t('checkin.health.flaggedBody')}</p></Banner>}
      </Form>
    </>
  )
}

export function ArrivalStep({ view, save, busy, error }: StepProps) {
  const [window, setWindow] = useState(view.arrival ?? view.suggested)
  return (
    <>
      <p>{t('checkin.arrival.intro')}</p>
      {view.priority && <Banner kind="info" title={t('travel.priority')}><p>{t('travel.priorityBody')}</p></Banner>}
      <Form onSubmit={() => void save({ step: 'arrival', window })} error={error} busy={busy} label={t('checkin.arrival.button')}>
        <fieldset>
          <legend>{t('checkin.arrival.choose')}</legend>
          {view.windows.map((w) => (
            <label key={w.start} className="choice"><input type="radio" name="window" checked={w.start === window} onChange={() => setWindow(w.start)} /><span>{formatTime(w.start)} – {formatTime(w.end)}<small>{t(`travel.crowd.${w.crowd}` as StringKey)} · {t('checkin.arrival.wait', { minutes: WAIT_MINUTES[w.crowd] })}</small></span></label>
          ))}
        </fieldset>
        <p className="muted">{t('checkin.arrival.shared')}</p>
      </Form>
    </>
  )
}
