import { useSyncExternalStore } from 'react'
import { t } from '../i18n'
import type { StringKey } from '../i18n'
import { dismissTip, hasTip, loadTipProgress, subscribeTips, tipCount } from '../settings/tips'
import { Button } from './Button'
import { Lightbulb } from './icons'

/**
 * A one or two line traveller tip under the page header, with a Got It! button. A page can have several tips: Got It! remembers the dismissal on this device
 * and shows the page's next tip, until none are left. "Reset tips" in Me → Settings brings every tip back.
 */
export function TipCard({ id }: { id: string | null }) {
  const progress = useSyncExternalStore(subscribeTips, loadTipProgress, loadTipProgress)
  if (!id) return null
  const n = (progress[id] ?? 0) + 1
  if (!hasTip(id, n)) return null
  const total = tipCount(id)
  return (
    <div className="page page--tip no-print">
      <aside className="tip" aria-label={t('tip.label')}>
        <Lightbulb className="tip__icon" aria-hidden="true" />
        <p className="tip__text">
          {t(`tip.${n === 1 ? id : `${id}.${n}`}` as StringKey)}
          {total > 1 && <small className="tip__count"> {t('tip.count', { n, total })}</small>}
        </p>
        <Button variant="secondary" className="tip__got" onClick={() => dismissTip(id)}>{t('tip.gotIt')}</Button>
      </aside>
    </div>
  )
}
