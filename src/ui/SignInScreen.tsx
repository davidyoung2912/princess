import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { AuthError } from '../auth/provider'
import { PERSONAS } from '../domain/personas'
import { t } from '../i18n'
import { auth, usesRealAuth } from '../runtime'
import { Button } from './Button'
import { Card } from './Card'
import { ConceptNotice } from './ConceptNotice'
import { ErrorSummary, Field } from './Field'
import { CodeFlow, SignUpForm } from './SignInFlows'

type Mode = 'signin' | 'signup' | 'forgot' | 'magic'

/** The sign-in page: email or 10-digit account number plus password, with sign-up, a forgotten-password reset and an emailed code (ACT-01). */
export function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signin')
  if (mode === 'signup') return <main className="page signin" id="main"><SignUpForm onBack={() => setMode('signin')} /><ConceptNotice /></main>
  if (mode === 'forgot' || mode === 'magic') return <main className="page signin" id="main"><CodeFlow purpose={mode === 'forgot' ? 'reset' : 'magic'} onBack={() => setMode('signin')} /><ConceptNotice /></main>
  return <PasswordSignIn go={setMode} />
}

function PasswordSignIn({ go }: { go: (m: Mode) => void }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [missing, setMissing] = useState<{ id?: string; pw?: string }>({})

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next = { id: identifier.trim() ? undefined : t('signin.identifier.required'), pw: password ? undefined : t('signin.password.required') }
    setMissing(next)
    if (next.id || next.pw) { setError(''); return }
    setBusy(true)
    setError('')
    try {
      await auth.signIn({ method: 'password', identifier, password })
      setPassword('')
    } catch (err) {
      setError(t(err instanceof AuthError && err.code === 'offline' ? 'signin.error.offline' : err instanceof AuthError && err.code === 'unavailable' ? 'signin.error.unavailable' : 'signin.error.bad'))
    } finally {
      setBusy(false)
    }
  }

  const problems = [missing.id, missing.pw, error].filter((x): x is string => !!x)
  return (
    <main className="page signin" id="main">
      <h1>{t('signin.title')}</h1>
      <p>{t('signin.intro')}</p>
      <ErrorSummary title={t('signin.problems')} errors={problems} />
      <Card>
        <form onSubmit={(e) => void submit(e)} noValidate>
          <Field label={t('signin.identifier')} hint={t('signin.identifier.hint')} value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} error={missing.id} />
          <Field label={t('signin.password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" error={missing.pw} />
          <Button type="submit" block disabled={busy}>{busy ? t('signin.busy') : t('signin.submit')}</Button>
        </form>
      </Card>
      <ul className="plain-list">
        <li><Button variant="secondary" onClick={() => go('forgot')}>{t('signin.mode.forgot')}</Button></li>
        <li><Button variant="secondary" onClick={() => go('magic')}>{t('signin.mode.magic')}</Button></li>
        <li><Button variant="secondary" onClick={() => go('signup')}>{t('signin.mode.signup')}</Button></li>
      </ul>
      {!import.meta.env.PROD && <TestAccounts />}
      <ConceptNotice />
    </main>
  )
}

/** Non-production help only: the seeded accounts and the shared demo password. Never shown in a production build. */
function TestAccounts() {
  return (
    <Card>
      <h2>{t('signin.test.title')}</h2>
      <p>{t('signin.test.body')}</p>
      <ul>
        {PERSONAS.map((p) => <li key={p.id}>{p.name}: <code>{p.id}@demo.princess.example</code></li>)}
      </ul>
    </Card>
  )
}

/** Shows the sign-in page instead of the app while there is no session. The mock's demo picker needs no gate. */
export function SignInGate({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(auth.subscribe, auth.current, auth.current)
  if (usesRealAuth && !session) return <SignInScreen />
  return <>{children}</>
}

