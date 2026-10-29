import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { asBoardingView } from '../../api/guards'
import type { BoardingView } from '../../api/types'
import { cacheGet, cachePut } from '../../domain/offlineCache'
import { normalizeBookingNumber } from '../../domain/trip'
import { demoNow } from '../../demo/store'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Field } from '../Field'
import { PassBody } from './PassScreen'

const local = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

/** Find a pass with just the booking number and a last name, no sign-in (CHK-14). The last pass found is kept on the phone, so it still opens with no signal. */
export function FindPassScreen() {
  const [number, setNumber] = useState('')
  const [lastName, setLastName] = useState('')
  const [found, setFound] = useState<{ pass: BoardingView; copy: boolean; at: number } | null>(null)
  const [problem, setProblem] = useState<'format' | 'noMatch' | null>(null)
  const look = useAction(async (n: string, last: string) => api.boarding.lookup(n, last))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const key = normalizeBookingNumber(number)
    if (!key || !lastName.trim()) { setProblem('format'); return }
    setProblem(null)
    const result = await look.run(number, lastName)
    if (result) {
      setFound({ pass: result, copy: false, at: demoNow() })
      cachePut(local(), 'found', key, result, demoNow())
    }
  }
  const error = look.error
  const offline = !!error && error.retryable && error.code !== 'notFound'
  const copy = offline ? cacheGet(local(), 'found', normalizeBookingNumber(number), asBoardingView) : null
  const shown = found ?? (copy ? { pass: copy.value, copy: true, at: copy.savedAt } : null)
  return (
    <div className="page">
      <h1>{t('route.findPass')}</h1>
      <p>{t('find.intro')}</p>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <Field label={t('find.number')} hint={t('find.numberHint')} value={number} onChange={(e) => setNumber(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
        <Field label={t('find.lastName')} hint={t('find.lastNameHint')} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
        {problem === 'format' && <p role="alert" className="field__error">{t('find.err.format')}</p>}
        {error && error.code === 'notFound' && <p role="alert" className="field__error">{t('find.err.noMatch')} <Link to="/me/contact">{t('account.err.contact')}</Link></p>}
        {offline && !copy && <p role="alert" className="field__error">{t('find.err.offline')}</p>}
        <Button type="submit" disabled={look.busy}>{look.busy ? t('find.looking') : t('find.button')}</Button>
      </form>
      {shown && (
        <section aria-labelledby="found-h">
          <h2 id="found-h">{t('find.found')}</h2>
          {shown.copy && <Banner kind="offline" title={t('pass.offline')}><p>{t('pass.offlineBody')}</p></Banner>}
          <PassBody pass={shown.pass} offline={shown.copy} reload={() => undefined} signedIn={false} />
        </section>
      )}
      <p className="book-nav"><Link to="/home/boarding-pass">{t('route.boardingPass')}</Link></p>
    </div>
  )
}
