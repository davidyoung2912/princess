import type { ReactNode } from 'react'
import type { ApiError } from '../../api/errors'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { ActionError } from '../account/parts'

/** Why a change was refused, in words that say what to do; anything not recognised falls back to the general wording. */
export function ExtraError({ error }: { error: ApiError | null }) {
  if (!error) return null
  if (error.code === 'conflict' || error.code === 'invalid') {
    const text = t(`x.err.${error.message}` as StringKey)
    if (text !== `x.err.${error.message}`) return <p role="alert" className="field__error">{text}</p>
  }
  return <ActionError error={error} />
}

/** Said at the top of a screen whose actions open when the guest boards. */
export function NotAboard({ open, children }: { open: boolean; children?: ReactNode }) {
  if (open) return null
  return <Banner kind="info" title={t('x.notAboard.title')}><p>{t('x.notAboard.body')}</p>{children}</Banner>
}
