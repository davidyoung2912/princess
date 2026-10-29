import { useSyncExternalStore } from 'react'
import { applyUpdate, subscribeUpdate, updateReady } from '../runtime/update'
import { t } from '../i18n'
import { Banner } from './Banner'
import { Button } from './Button'

/** "A new version is ready": the guest chooses when to switch, so nothing they are typing is lost (PERF-02). */
export function UpdateBanner() {
  const ready = useSyncExternalStore(subscribeUpdate, updateReady, () => false)
  if (!ready) return null
  return (
    <div className="update-banner no-print">
      <Banner kind="info" title={t('upd.title')} action={<Button variant="secondary" onClick={applyUpdate}>{t('upd.now')}</Button>}>
        <p>{t('upd.body')}</p>
      </Banner>
    </div>
  )
}
