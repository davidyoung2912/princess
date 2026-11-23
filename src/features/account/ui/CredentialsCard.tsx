import { useState, useSyncExternalStore, type FormEvent } from 'react'
import { AuthError } from '../../../shared/auth/provider'
import { isUsername, MIN_PASSWORD } from '../../../domain/signup'
import { t, th, type StringKey } from '../../../shared/i18n'
import { auth, changeCredentialsSaving } from '../../../app/runtime'
import { Banner } from '../../../shared/ui/Banner'
import { Button } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'
import { Field } from '../../../shared/ui/Field'

const problemText = (err: unknown): StringKey => {
  if (!(err instanceof AuthError)) return 'credentials.error.other'
  if (err.code === 'badPassword') return 'credentials.error.badPassword'
  if (err.code === 'usernameTaken') return 'signin.signup.error.usernameTaken'
  if (err.code === 'offline') return 'signin.error.offline'
  if (err.code === 'unavailable') return 'signin.error.unavailable'
  return 'credentials.error.other'
}

/**
 * My Details: change the username and/or password. The current password is always needed, and a change signs the guest out everywhere (this device too),
 * so they sign in again with the new details. Only the person themselves, never a booker viewing as a child, and not the demo accounts.
 */
export function CredentialsCard() {
  const user = useSyncExternalStore(auth.subscribe, auth.current, auth.current)?.user
  const [username, setUsername] = useState(user?.username ?? '')
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [problems, setProblems] = useState<{ username?: boolean; password?: boolean; current?: boolean; nothing?: boolean }>({})
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<StringKey | null>(null)
  if (!user || user.isDemo || !auth.account) return null

  const renamed = username.trim() !== user.username
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFailed(null)
    const found = { username: renamed && !isUsername(username), password: password !== '' && password.length < MIN_PASSWORD, current: current === '', nothing: !renamed && password === '' }
    setProblems(found)
    if (Object.values(found).some(Boolean)) return
    setBusy(true)
    try {
      await changeCredentialsSaving({ currentPassword: current, ...(renamed ? { newUsername: username.trim() } : {}), ...(password ? { newPassword: password } : {}) })
      // Signed out: the gate shows the sign-in page.
    } catch (err) {
      setFailed(problemText(err))
      setBusy(false)
    }
  }

  return (
    <Card labelledBy="credentials-h">
      <h2 id="credentials-h">{th('credentials.title')}</h2>
      <p>{t('credentials.intro')}</p>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <Field label={t('signin.signup.username')} hint={t('signin.signup.username.hint')} value={username} onChange={(e) => { setUsername(e.target.value); setProblems({}) }} autoComplete="username" autoCapitalize="none" spellCheck={false} error={problems.username ? t('signin.signup.problem.username') : undefined} />
        <Field label={t('credentials.newPassword')} hint={t('credentials.newPassword.hint')} type="password" reveal value={password} onChange={(e) => { setPassword(e.target.value); setProblems({}) }} autoComplete="new-password" error={problems.password ? t('signin.signup.problem.password') : undefined} />
        <Field label={t('credentials.current')} hint={t('credentials.current.hint')} type="password" reveal value={current} onChange={(e) => { setCurrent(e.target.value); setProblems({}) }} autoComplete="current-password" error={problems.current ? t('credentials.error.current') : undefined} />
        {problems.nothing && <p role="alert" className="field__error">{t('credentials.error.nothing')}</p>}
        {failed && <p role="alert" className="field__error">{t(failed)}</p>}
        <Banner kind="warning" title={t('credentials.warn.title')}><p>{t('credentials.warn.body')}</p></Banner>
        <div className="button-row"><Button type="submit" disabled={busy}>{busy ? t('account.saving') : t('credentials.save')}</Button></div>
      </form>
    </Card>
  )
}
