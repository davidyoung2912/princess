import { Link } from 'react-router'
import type { ApiError } from '../../api/errors'
import { t, type StringKey } from '../../i18n'

const keyed = (key: string, text: string): string | null => (text === key ? null : text)

/** Why a check-in change was refused, in plain words that say how to put it right (CHK-03). A dropped connection says the answers are still on screen. */
export function CheckinError({ error }: { error: ApiError | null }) {
  if (!error) return null
  const [kind, rest = ''] = error.message.split(/:(.*)/s)
  let text: string | null = null
  if (error.code === 'invalid' || error.code === 'conflict') {
    if (kind === 'photo') text = rest.split(',').map((p) => keyed(`checkin.err.photo.${p}`, t(`checkin.err.photo.${p}` as StringKey))).filter(Boolean).join(' ') || null
    else if (rest) text = keyed(`checkin.err.${kind}.${rest}`, t(`checkin.err.${kind}.${rest}` as StringKey))
    else text = keyed(`checkin.err.${kind}`, t(`checkin.err.${kind}` as StringKey))
  } else if (error.code === 'declined') {
    text = t('checkin.err.declined', { card: error.message })
  } else if (error.code === 'forbidden') {
    text = t('checkin.err.forbidden')
  } else if (error.retryable) {
    text = t('checkin.err.notSaved')
  }
  return (
    <div role="alert" className="field__error">
      <span>{text ?? t('checkin.err.generic')} <Link to="/home/check-in/terminal">{t('checkin.err.terminal')}</Link></span>
    </div>
  )
}
