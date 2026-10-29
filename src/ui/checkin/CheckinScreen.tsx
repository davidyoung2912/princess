import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { CheckinSave, CheckinView } from '../../api/types'
import { GUEST_STEPS, isStepId, STEP_ORDER, stepDone, type StepId } from '../../domain/checkin'
import { formatDate } from '../../domain/cruise'
import { dateIn } from '../../domain/timezones'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { Stepper, type StepDef } from '../Stepper'
import { StatusBadge } from '../StatusBadge'
import { Load, SupervisedNote } from '../account/parts'
import { formatDateTime } from '../account/format'
import { usePersona } from '../../hooks/useDemo'
import { personaById } from '../../domain/personas'
import { CheckinError } from './CheckinError'
import { ArrivalStep, ConfirmStep, ContractStep, DocumentStep, EmergencyStep, HealthStep, PaymentStep, PhotoStep } from './steps'

const REVIEW = 'review'
const stepLabel = (step: StepId | typeof REVIEW) => t(`checkin.step.${step}` as StringKey)
const stepPath = (step: StepId | typeof REVIEW, guest?: string | null) => `/home/check-in/${step}${guest ? `?guest=${guest}` : ''}`

/** Online check-in (CHK-01, CHK-02, CHK-03): eight short steps, saved as you go, for everyone on the booking. `/home/check-in` is the overview; `/home/check-in/:id` is one step. */
export function CheckinScreen() {
  const { id } = useParams()
  const view = useMine(() => api.checkin.view())
  const step: StepId | typeof REVIEW | null = isStepId(id) ? id : id === REVIEW ? REVIEW : null
  return (
    <div className="page">
      <h1>{step ? stepLabel(step) : t('route.checkin')}</h1>
      <Load state={view}>{(v) => (step ? <StepPage view={v} step={step} reload={view.retry} /> : <Overview view={v} />)}</Load>
    </div>
  )
}

function Gate({ view, children }: { view: CheckinView; children: React.ReactNode }) {
  const me = usePersona()
  const { state, opensAt } = view.status
  if (state === 'notOpen') return <Banner kind="info" title={t('checkin.notOpen', { date: formatDate(dateIn(opensAt, 'America/New_York')) })}><p>{t('checkin.notOpenBody')}</p></Banner>
  if (state === 'closed') return <Banner kind="warning" title={t('checkin.closed')} action={<LinkButton to="/home/check-in/terminal" variant="secondary">{t('route.terminalCheckin')}</LinkButton>}><p>{t('checkin.closedBody')}</p></Banner>
  return (
    <>
      {!view.canEdit && me && <SupervisedNote booker={personaById(me.booker)!.firstName} />}
      {children}
    </>
  )
}

function Overview({ view }: { view: CheckinView }) {
  const { progress, status } = view
  const steps: StepDef[] = STEP_ORDER.map((s) => ({
    id: s, label: stepLabel(s),
    state: stepDone(s, view.guests, progress.bookingLeft) ? 'done' : progress.next?.step === s ? 'current' : 'todo',
  }))
  const done = status.state === 'done'
  return (
    <>
      <p>{t('checkin.intro')}</p>
      {done && (
        <Banner kind="success" title={t('checkin.finished')} action={<LinkButton to="/home/boarding-pass">{t('checkin.showPass')}</LinkButton>}>
          <p>{view.finishedAt ? t('checkin.finishedAt', { when: formatDateTime(view.finishedAt) }) : ''} <Link to="/home/check-in/receipt">{t('checkin.seeReceipt')}</Link></p>
        </Banner>
      )}
      <Gate view={view}>
        <Card labelledBy="progress-h">
          <h2 id="progress-h" className="card__title">{t('checkin.progress')}</h2>
          <p className="progress-line" role="status">{t('checkin.progressLine', { done: progress.done, total: progress.total })}</p>
          <progress className="meter" max={progress.total} value={progress.done} aria-label={t('checkin.progressLine', { done: progress.done, total: progress.total })} />
          {!done && progress.next && (
            <LinkButton to={stepPath(progress.next.step, progress.next.guest)} block>
              {progress.done === 0 ? t('checkin.start') : t('checkin.continue', { step: stepLabel(progress.next.step) })}
            </LinkButton>
          )}
          {!done && progress.complete && <LinkButton to={stepPath(REVIEW)} block>{t('checkin.review')}</LinkButton>}
        </Card>

        <section aria-labelledby="steps-h">
          <h2 id="steps-h">{t('checkin.steps')}</h2>
          <Stepper steps={steps} label={t('checkin.steps')} />
          <ul className="link-list">
            {STEP_ORDER.map((s) => <li key={s}><Link to={stepPath(s)}>{stepLabel(s)}</Link></li>)}
          </ul>
        </section>

        <section aria-labelledby="left-h">
          <h2 id="left-h">{t('checkin.whatsLeft')}</h2>
          <ul className="card-grid">
            {view.guests.map((g) => (
              <li key={g.id} className="card">
                <h3>{g.name}</h3>
                <p>{g.progress.complete ? <StatusBadge kind="booked" label={t('checkin.guestDone')} /> : t('checkin.guestLeft', { done: g.progress.done.length, total: GUEST_STEPS.length })}</p>
                {g.progress.left.length > 0 && (
                  <ul className="plain-bullets">
                    {g.progress.left.map((s) => <li key={s}><Link to={stepPath(s, g.id)}>{stepLabel(s)}<span className="visually-hidden"> {g.name}</span></Link></li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          {progress.bookingLeft.length > 0 && (
            <p>{t('checkin.bookingLeft')} {progress.bookingLeft.map((s, i) => <span key={s}>{i > 0 && ', '}<Link to={stepPath(s)}>{stepLabel(s)}</Link></span>)}</p>
          )}
        </section>
      </Gate>

      <Card info>
        <h2 className="card__title">{t('checkin.anyDevice')}</h2>
        <p>{t('checkin.anyDeviceBody')}</p>
        <p><Link to="/home/check-in/receipt">{t('route.receipt')}</Link> · <Link to="/home/check-in/terminal">{t('route.terminalCheckin')}</Link></p>
      </Card>
    </>
  )
}

function StepPage({ view, step, reload }: { view: CheckinView; step: StepId | typeof REVIEW; reload: () => void }) {
  const navigate = useNavigate()
  const saver = useAction(async (input: CheckinSave) => {
    const next = await api.checkin.save(input)
    reload()
    return next
  })
  const save = async (input: CheckinSave) => {
    const next = await saver.run(input)
    if (!next) return
    const n = next.progress.next
    navigate(n ? stepPath(n.step, n.guest) : stepPath(REVIEW))
  }
  const props = { view, save, busy: saver.busy, error: saver.error }
  const position = step === REVIEW ? STEP_ORDER.length + 1 : STEP_ORDER.indexOf(step) + 1
  return (
    <>
      <p className="eyebrow">{t('checkin.stepOf', { n: position, total: STEP_ORDER.length + 1 })}</p>
      <Gate view={view}>
        {view.status.state === 'done' && step !== REVIEW && <Banner kind="info" title={t('checkin.editDone')} />}
        {step === 'confirm' && <ConfirmStep {...props} />}
        {step === 'document' && <DocumentStep {...props} />}
        {step === 'photo' && <PhotoStep {...props} />}
        {step === 'emergency' && <EmergencyStep {...props} />}
        {step === 'payment' && <PaymentStep {...props} />}
        {step === 'contract' && <ContractStep {...props} />}
        {step === 'health' && <HealthStep {...props} />}
        {step === 'arrival' && <ArrivalStep {...props} />}
        {step === REVIEW && <ReviewStep view={view} />}
      </Gate>
      <p className="book-nav"><Link to="/home/check-in">{t('checkin.backToOverview')}</Link></p>
    </>
  )
}

function ReviewStep({ view }: { view: CheckinView }) {
  const navigate = useNavigate()
  const [done, setDone] = useState(view.status.state === 'done')
  const finish = useAction(async () => { await api.checkin.submit(); setDone(true); navigate('/home/boarding-pass') })
  const { progress } = view
  return (
    <>
      <p>{t('checkin.review.intro')}</p>
      {!progress.complete && (
        <Banner kind="warning" title={t('checkin.review.notYet')} action={progress.next ? <LinkButton to={stepPath(progress.next.step, progress.next.guest)} variant="secondary">{t('checkin.continue', { step: stepLabel(progress.next.step) })}</LinkButton> : undefined}>
          <p>{t('checkin.review.notYetBody', { left: progress.total - progress.done })}</p>
        </Banner>
      )}
      <ul className="plain-list">
        {view.guests.map((g) => (
          <li key={g.id}><span><strong>{g.name}</strong></span>{g.progress.complete ? <StatusBadge kind="booked" label={t('checkin.guestDone')} /> : <StatusBadge kind="changed" label={t('checkin.guestLeft', { done: g.progress.done.length, total: GUEST_STEPS.length })} />}</li>
        ))}
        <li><span><strong>{t('checkin.review.booking')}</strong></span>{progress.bookingLeft.length === 0 ? <StatusBadge kind="booked" label={t('checkin.done')} /> : <StatusBadge kind="changed" label={t('checkin.review.bookingLeft', { count: progress.bookingLeft.length })} />}</li>
      </ul>
      <p className="muted">{t('checkin.review.fix')} <Link to="/home/check-in/receipt">{t('route.receipt')}</Link></p>
      <CheckinError error={finish.error} />
      {done ? <LinkButton to="/home/boarding-pass">{t('checkin.showPass')}</LinkButton> : <Button disabled={!progress.complete || finish.busy} onClick={() => void finish.run()}>{finish.busy ? t('checkin.saving') : t('checkin.finish')}</Button>}
    </>
  )
}
