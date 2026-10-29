import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { ApiError } from '../../api/errors'
import type { Mine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { LoadError } from '../discover/parts'

/** Shows the loading note or the "couldn't load" banner until a person's data is there, then the content. */
export function Load<T>({ state, children }: { state: Mine<T>; children: (data: T) => ReactNode }) {
  if (state.data) return <>{children(state.data)}</>
  if (state.status === 'error') return <LoadError retry={state.retry} />
  return <p role="status" className="muted">{t('account.loading')}</p>
}

/** Why a change failed, in words that say what to do next. Offline and passing failures offer a retry; the rest need a change or a person. */
export function ActionError({ error, forbidden }: { error: ApiError | null; forbidden?: StringKey }) {
  if (!error) return null
  const key: StringKey = error.code === 'offline' ? 'account.err.offline' : error.code === 'forbidden' ? (forbidden ?? 'account.err.forbidden') : error.retryable ? 'account.err.retry' : 'account.err.generic'
  return <p role="alert" className="field__error">{t(key)} <Link to="/me/contact">{t('account.err.contact')}</Link></p>
}

/** A page-top note for supervised (child) accounts, which can read but not change things. */
export function SupervisedNote({ booker }: { booker: string }) {
  return <Banner kind="info" title={t('account.supervised.title')}><p>{t('account.supervised.body', { name: booker })}</p></Banner>
}
