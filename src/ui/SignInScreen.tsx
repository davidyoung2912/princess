import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import logo from '../assets/princess.png'
import { AuthError } from '../auth/provider'
import { t } from '../i18n'
import { auth, retryReference } from '../runtime'
import { referenceState, subscribeReference } from '../domain/referenceStatus'
import { fetchDemoAccounts, type DemoAccount } from '../auth/demoAccounts'
import { LanguageSwitch } from './LanguageSwitch'
import { Button } from './Button'
import { Card } from './Card'
import { ErrorSummary, Field } from './Field'
import { CodeFlow, SignUpForm } from './SignInFlows'

type Mode = 'signin' | 'signup' | 'forgot' | 'magic'

/** The sign-in page: email or 10-digit account number plus password, with sign-up, a forgotten-password reset and an emailed code (ACT-01). */
export function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signin')
  if (mode === 'signup') return <main className="page signin" id="main"><SignUpForm onBack={() => setMode('signin')} /></main>
  if (mode === 'forgot' || mode === 'magic') return <main className="page signin" id="main"><CodeFlow purpose={mode === 'forgot' ? 'reset' : 'magic'} onBack={() => setMode('signin')} /></main>
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
      <img className="signin__logo" src={logo} alt="Princess Voyages" width="1024" height="1024" />
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
      <LanguageSwitch />
      <ul className="plain-list">
        <li><Button variant="secondary" onClick={() => go('forgot')}>{t('signin.mode.forgot')}</Button></li>
        <li><Button variant="secondary" onClick={() => go('magic')}>{t('signin.mode.magic')}</Button></li>
        <li><Button variant="secondary" onClick={() => go('signup')}>{t('signin.mode.signup')}</Button></li>
      </ul>
      {!import.meta.env.PROD && <TestAccounts />}
    </main>
  )
}

/** Non-production help only: the seeded accounts, listed by the server (which refuses in production), and the shared demo password. */
function TestAccounts() {
  const [accounts, setAccounts] = useState<readonly DemoAccount[]>([])
  useEffect(() => {
    let live = true
    void fetchDemoAccounts(auth.http).then((list) => { if (live) setAccounts(list) }).catch(() => {})
    return () => { live = false }
  }, [])
  if (accounts.length === 0) return null
  return (
    <Card>
      <h2>{t('signin.test.title')}</h2>
      <p>{t('signin.test.body')}</p>
      <ul>
        {accounts.map((a) => <li key={a.email}>{a.name}: <code>{a.email}</code></li>)}
      </ul>
    </Card>
  )
}

/** Shows the sign-in page instead of the app while there is no session. */
export function SignInGate({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(auth.subscribe, auth.current, auth.current)
  const navigate = useNavigate()
  const signedIn = !!session
  const was = useRef(signedIn)
  useEffect(() => {
    // Just signed in: whatever address was open, start on the landing page.
    if (signedIn && !was.current) void navigate('/', { replace: true })
    was.current = signedIn
  }, [signedIn, navigate])
  if (!session) return <SignInScreen />
  return <ReferenceGate>{children}</ReferenceGate>
}

/** Waits for the sailings, ports and catalogue before the app draws, so no screen reads an empty table. Offline with a kept copy, it goes straight through. */
function ReferenceGate({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribeReference, referenceState, referenceState)
  if (state === 'ready') return <>{children}</>
  return (
    <main className="page" id="main">
      {state === 'failed' ? (
        <>
          <p role="alert">{t('ref.failed')}</p>
          <Button onClick={retryReference}>{t('ref.retry')}</Button>
        </>
      ) : <p role="status">{t('ref.loading')}</p>}
    </main>
  )
}

