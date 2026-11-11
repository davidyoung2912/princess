import { useState, type FormEvent } from 'react'
import { AuthError, type AccountActions, type CodePurpose } from '../auth/provider'
import { cleanCode, isCode, isEmail, signupProblems, type SignupProblem } from '../domain/signup'
import { t, th, headingCase, type StringKey } from '../i18n'
import { auth } from '../runtime'
import { Button } from './Button'
import { Card } from './Card'
import { KeyRound, Mail, UserPlus } from './icons'
import { PageHeader } from './PageHeader'
import { ErrorSummary, Field } from './Field'

const actions = (): AccountActions | undefined => auth.account

const failText = (err: unknown, taken: StringKey = 'signin.error.invalid'): string => {
  if (!(err instanceof AuthError)) return t('signin.error.invalid')
  if (err.code === 'offline') return t('signin.error.offline')
  if (err.code === 'unavailable') return t('signin.error.unavailable')
  if (err.code === 'emailTaken') return t('signin.signup.error.emailTaken')
  if (err.code === 'possibleDuplicate') return t('signin.signup.twin.body')
  if (err.code === 'tooYoung') return t('signin.signup.problem.tooYoung')
  if (err.code === 'badCode') return t('signin.code.bad')
  return t(taken)
}

const today = () => new Date().toISOString().slice(0, 10)

/** Sign-up (ACT-01). On success the provider signs the person in and the gate swaps this page for the app. */
export function SignUpForm({ onBack }: { onBack: () => void }) {
  const [v, setV] = useState({ email: '', password: '', confirm: '', firstName: '', lastName: '', dob: '' })
  const [problems, setProblems] = useState<SignupProblem[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [twin, setTwin] = useState(false)
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })
  const msg = (p: SignupProblem) => t(`signin.signup.problem.${p}` as StringKey)

  const submit = async (e: FormEvent, confirmedDifferent = false) => {
    e.preventDefault()
    const { confirm, ...form } = v
    const found = signupProblems(form, today(), confirm)
    setProblems(found)
    setError('')
    if (found.length) return
    setBusy(true)
    try {
      await actions()?.register({ ...form, email: form.email.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim(), ...(confirmedDifferent ? { confirmedDifferent: true } : {}) })
    } catch (err) {
      if (err instanceof AuthError && err.code === 'possibleDuplicate') setTwin(true)
      else setError(failText(err))
    } finally { setBusy(false) }
  }

  const err = (p: SignupProblem) => (problems.includes(p) ? msg(p) : undefined)
  const summary = [...problems.map(msg), error].filter(Boolean)
  if (twin) {
    return (
      <>
        <PageHeader title={th('signin.signup.twin.title')} subtext={t('signin.signup.twin.body')} icon={UserPlus} />
        <div className="page">
        <Card>
          <p role="alert">{t('signin.signup.twin.body')}</p>
          <p>{t('signin.signup.twin.ifYou')}</p>
          <p>{t('signin.signup.twin.ifNot')}</p>
          <Button block disabled={busy} onClick={(e) => void submit(e, true)}>{t('signin.signup.twin.continue')}</Button>
        </Card>
        <p><Button variant="secondary" onClick={onBack}>{t('signin.signup.twin.signIn')}</Button></p>
        <p><Button variant="secondary" onClick={() => setTwin(false)}>{t('signin.signup.twin.edit')}</Button></p>
        </div>
      </>
    )
  }
  return (
    <>
      <PageHeader title={th('signin.signup.title')} subtext={t('signin.signup.intro')} icon={UserPlus} />
      <div className="page">
      <ErrorSummary title={t('signin.problems')} errors={summary} />
      <Card>
        <form onSubmit={(e) => void submit(e)} noValidate>
          <Field label={t('signin.signup.first')} help={t('helptip.passportName')} value={v.firstName} onChange={set('firstName')} autoComplete="given-name" error={err('firstName')} />
          <Field label={t('signin.signup.last')} help={t('helptip.passportName')} value={v.lastName} onChange={set('lastName')} autoComplete="family-name" error={err('lastName')} />
          <Field label={t('signin.signup.email')} help={t('helptip.signupEmail')} value={v.email} onChange={set('email')} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} error={err('email')} />
          <Field label={t('signin.signup.dob')} hint={t('signin.signup.dob.hint')} type="date" min="1900-01-01" max={today()} value={v.dob} onChange={set('dob')} autoComplete="bday" error={err('dob') ?? err('tooYoung')} />
          <Field label={t('signin.signup.password')} hint={t('signin.signup.password.hint')} type="password" value={v.password} onChange={set('password')} autoComplete="new-password" error={err('password')} />
          <Field label={t('signin.signup.confirm')} type="password" value={v.confirm} onChange={set('confirm')} autoComplete="new-password" error={err('confirm')} />
          <Button type="submit" block disabled={busy}>{busy ? t('signin.signup.busy') : t('signin.signup.submit')}</Button>
        </form>
      </Card>
      <p><Button variant="secondary" onClick={onBack}>{t('signin.mode.back')}</Button></p>
      </div>
    </>
  )
}

/**
 * The two code flows. `forgot`: ask for a code, then enter it with a new password. `magic`: ask for a code, then enter it to sign in.
 * The first step says the same thing whether or not the address has an account.
 */
export function CodeFlow({ purpose, onBack }: { purpose: CodePurpose; onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const ask = async (e: FormEvent) => {
    e.preventDefault()
    if (!isEmail(email)) { setErrors([t('signin.signup.problem.email')]); return }
    setBusy(true)
    setErrors([])
    try { await actions()?.requestCode(purpose, email); setSent(true) } catch (err) { setErrors([failText(err)]) } finally { setBusy(false) }
  }

  const finish = async (e: FormEvent) => {
    e.preventDefault()
    const found: string[] = []
    if (!isCode(code)) found.push(t('signin.code.problem'))
    if (purpose === 'reset' && password.length < 10) found.push(t('signin.signup.problem.password'))
    setErrors(found)
    if (found.length) return
    setBusy(true)
    try {
      if (purpose === 'reset') { await actions()?.resetPassword(email, cleanCode(code), password); setDone(true); setPassword(''); setCode('') }
      else await auth.signIn({ method: 'code', email, code: cleanCode(code) })
    } catch (err) { setErrors([failText(err)]) } finally { setBusy(false) }
  }

  if (done) {
    return (
      <>
        <PageHeader title={th('signin.code.title.forgot')} icon={KeyRound} />
        <div className="page">
          <p role="status">{t('signin.code.done')}</p>
          <Button block onClick={onBack}>{t('signin.mode.back')}</Button>
        </div>
      </>
    )
  }
  const title = t(purpose === 'reset' ? 'signin.code.title.forgot' : 'signin.code.title.magic')
  return (
    <>
      <PageHeader title={headingCase(title)} subtext={t('signin.code.intro')} icon={purpose === 'reset' ? KeyRound : Mail} />
      <div className="page">
      <ErrorSummary title={t('signin.problems')} errors={errors} />
      <Card>
        <form onSubmit={(e) => void (sent ? finish(e) : ask(e))} noValidate>
          <Field label={t('signin.signup.email')} help={t('helptip.signupEmail')} value={email} onChange={(e) => setEmail(e.target.value)} readOnly={sent} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} />
          {sent && (
            <>
              <p role="status">{t('signin.code.sent')}</p>
              <Field label={t('signin.code.field')} help={t('helptip.code')} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" inputMode="numeric" />
              {purpose === 'reset' && <Field label={t('signin.code.newPassword')} hint={t('signin.signup.password.hint')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />}
            </>
          )}
          <Button type="submit" block disabled={busy}>
            {sent ? t(purpose === 'reset' ? 'signin.code.reset' : 'signin.code.signin') : busy ? t('signin.code.sending') : t('signin.code.send')}
          </Button>
        </form>
        {sent && <p><Button variant="secondary" onClick={() => { setSent(false); setCode(''); setErrors([]) }}>{t('signin.code.again')}</Button></p>}
      </Card>
      <p><Button variant="secondary" onClick={onBack}>{t('signin.mode.back')}</Button></p>
      </div>
    </>
  )
}
