import type { ReactNode } from 'react'
import type { PoseId } from '../../art/manifest'
import { t } from '../../i18n'
import { Button } from '../Button'
import { StanleyPose } from '../StanleyPose'

/** A friendly empty state: Stanley's face, one or two plain lines and the next step. `children` replaces the default words. */
export function StanleyEmpty({ children, action, pose = 'sleep' }: { children?: ReactNode; action?: ReactNode; pose?: PoseId }) {
  return (
    <div className="stanley-empty">
      <StanleyPose pose={pose} size={96} />
      <div>
        <p>{children ?? t('stanley.empty.default')}</p>
        {action}
      </div>
    </div>
  )
}

/** A friendly error or "could not load" line with a Try again button when `onRetry` is given. It is a status, so a screen reader hears it once. */
export function StanleyOops({ children, onRetry, pose = 'oops' }: { children?: ReactNode; onRetry?: () => void; pose?: PoseId }) {
  return (
    <div className="stanley-empty stanley-empty--oops" role="status">
      <StanleyPose pose={pose} size={96} />
      <div>
        <p>{children ?? t('stanley.oops.default')}</p>
        {onRetry && <Button variant="secondary" onClick={onRetry}>{t('stanley.oops.retry')}</Button>}
      </div>
    </div>
  )
}

/** A success line: Stanley gives a thumbs up beside the words. The live region is always in the page so a screen reader hears the words when they appear; with no `children` it is empty. */
export function SuccessLine({ children, pose = 'thumbs' }: { children?: ReactNode; pose?: PoseId }) {
  return (
    <div role="status" className="success-line">
      {children ? <div className="success-line__body motion-land"><StanleyPose pose={pose} size={48} /><p>{children}</p></div> : null}
    </div>
  )
}
