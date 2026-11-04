import type { ReactNode } from 'react'
import stanley from '../../assets/stanley-small.png'
import { t } from '../../i18n'
import { Button } from '../Button'

/** A friendly empty state: Stanley's face, one or two plain lines and the next step. `children` replaces the default words. */
export function StanleyEmpty({ children, action }: { children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="stanley-empty">
      <img src={stanley} alt="" width="192" height="192" />
      <div>
        <p>{children ?? t('stanley.empty.default')}</p>
        {action}
      </div>
    </div>
  )
}

/** A friendly error or "could not load" line with a Try again button when `onRetry` is given. It is a status, so a screen reader hears it once. */
export function StanleyOops({ children, onRetry }: { children?: ReactNode; onRetry?: () => void }) {
  return (
    <div className="stanley-empty stanley-empty--oops" role="status">
      <img src={stanley} alt="" width="192" height="192" />
      <div>
        <p>{children ?? t('stanley.oops.default')}</p>
        {onRetry && <Button variant="secondary" onClick={onRetry}>{t('stanley.oops.retry')}</Button>}
      </div>
    </div>
  )
}
