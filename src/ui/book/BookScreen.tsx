import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { canEnter, emptyDraft, firstIncomplete, isStep, newDraftId, nextStep, prevStep, STEPS, stepIndex, stepProblems, stepStates, type Draft, type Problem, type StepContext, type StepId } from '../../domain/booking'
import { sailingById } from '../../domain/sailings'
import { dateIn } from '../../domain/timezones'
import { api } from '../../runtime'
import { useDraft } from '../../hooks/useDraft'
import { useNow, usePersona } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { ErrorSummary } from '../Field'
import { Stepper } from '../Stepper'
import { Load } from '../account/parts'
import { DiningStep } from './DiningStep'
import { FareStep } from './FareStep'
import { GuestsStep } from './GuestsStep'
import { PayStep } from './PayStep'
import { ResumeLinkDialog, StartOverDialog } from './Dialogs'
import { RoomStep } from './RoomStep'
import { ReviewStep } from './ReviewStep'
import { SailingStep } from './SailingStep'
import { withSailing } from './changes'
import { problemText } from './problems'
import type { StepProps } from './common'

/** Book (BOK-01): a funnel of seven steps with progress, saved answers, and a way back to every step without losing anything. */
export function BookScreen() {
  const persona = usePersona()
  const [epoch, setEpoch] = useState(0)
  const stored = useMine(async () => ({ draft: await api.booking.draft() }))
  return (
    <div className="page">
      <h1>{t('route.book')}</h1>
      {stored.status === 'ready' && stored.data ? (
        <Funnel key={`${persona?.id}-${epoch}-${stored.data.draft?.id ?? 'new'}`} stored={stored.data.draft} onRestart={() => { setEpoch((e) => e + 1); stored.retry() }} />
      ) : (
        <Load state={stored}>{() => null}</Load>
      )}
    </div>
  )
}

const BODIES: Record<Exclude<StepId, 'pay'>, (props: StepProps) => ReactNode> = {
  sailing: SailingStep, room: RoomStep, fare: FareStep, guests: GuestsStep, dining: DiningStep, review: ReviewStep,
}

function Funnel({ stored, onRestart }: { stored: Draft | null; onRestart: () => void }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [initial] = useState(() => stored ?? emptyDraft(newDraftId()))
  const { draft, update, flush, stop, state } = useDraft(initial)
  const today = dateIn(useNow(), 'America/New_York')
  const ctx: StepContext = { departure: sailingById(draft.sailingId)?.departure ?? null, today }
  const [attempt, setAttempt] = useState<{ step: StepId; problems: Problem[] }>({ step: 'sailing', problems: [] })
  const [dialog, setDialog] = useState<'link' | 'restart' | null>(null)
  const heading = useRef<HTMLParagraphElement>(null)

  // A "Book this date" link brings a sailing in the address.
  const wanted = params.get('sailing')
  useEffect(() => { if (wanted && sailingById(wanted)) update(withSailing(wanted)) }, [wanted, update])

  const requested = isStep(id) ? id : null
  const step: StepId = requested && canEnter(draft, requested, ctx) ? requested : firstIncomplete(draft, ctx)
  useEffect(() => { if (id !== step) navigate(`/book/${step}`, { replace: true }) }, [id, step, navigate])

  // Problems shown belong to the step they were found on; moving on clears them.
  const shown = attempt.step === step ? attempt.problems : []
  const go = async (to: StepId) => { await flush(); navigate(`/book/${to}`) }
  const next = () => {
    const problems = stepProblems(draft, step, ctx)
    setAttempt({ step, problems })
    if (problems.length > 0) { heading.current?.focus(); return }
    void go(nextStep(step))
  }
  const error = (path: string) => { const p = shown.find((x) => x.path === path); return p ? problemText(p) : undefined }
  const summary = [...new Set(shown.map(problemText))]
  const steps = stepStates(draft, step, ctx).map((s) => ({ id: s.id, label: t(`book.step.${s.id}` as StringKey), state: s.state }))
  const Body = step === 'pay' ? null : BODIES[step]

  return (
    <>
      <Stepper steps={steps} label={t('book.progress')} />
      <p className="visually-hidden" role="status">{t('book.stepAnnounce', { n: stepIndex(step) + 1, total: STEPS.length, title: t(`book.step.${step}` as StringKey) })}</p>
      <p ref={heading} tabIndex={-1} className="visually-hidden">{summary.length > 0 ? t('book.fixHeading') : ''}</p>
      <ErrorSummary title={t('book.fix')} errors={summary} />
      {state === 'failed' && <Banner kind="warning" title={t('book.save.failed')}><p>{t('book.save.failedBody')}</p></Banner>}

      {Body ? <Body draft={draft} update={update} error={error} ctx={ctx} /> : <PayStep draft={draft} onBooked={(b) => { stop(); navigate(`/book/confirmed/${b.number}`) }} />}

      <div className="button-row book-nav">
        {stepIndex(step) > 0 && <Button variant="secondary" onClick={() => void go(prevStep(step))}>{t('book.back')}</Button>}
        {step !== 'pay' && <Button onClick={next}>{step === 'review' ? t('book.toPayment') : t('book.continue')}</Button>}
      </div>

      <p className="muted" role="status">{state === 'saving' ? t('book.save.saving') : state === 'saved' ? t('book.save.saved') : ''}</p>
      <div className="button-row">
        <Button variant="tertiary" onClick={() => { void flush(); setDialog('link') }}>{t('book.later')}</Button>
        <Button variant="tertiary" onClick={() => setDialog('restart')}>{t('book.restart')}</Button>
      </div>
      {dialog === 'link' && <ResumeLinkDialog draft={draft} onClose={() => setDialog(null)} />}
      {dialog === 'restart' && <StartOverDialog onClose={() => setDialog(null)} onDone={() => { stop(); setDialog(null); navigate('/book', { replace: true }); onRestart() }} />}
    </>
  )
}
