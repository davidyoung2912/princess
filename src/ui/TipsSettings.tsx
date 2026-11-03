import { useState } from 'react'
import { t, th } from '../i18n'
import { resetTips } from '../settings/tips'
import { Button } from './Button'

/** Brings back every traveller tip the guest has dismissed on this device. */
export function TipsSettings() {
  const [done, setDone] = useState(false)
  return (
    <section aria-labelledby="tips-settings-h" className="settings-tips">
      <h2 id="tips-settings-h">{th('settings.tips.title')}</h2>
      <p>{t('settings.tips.intro')}</p>
      <Button variant="secondary" onClick={() => { resetTips(); setDone(true) }}>{t('settings.tips.reset')}</Button>
      {done && <p role="status">{t('settings.tips.done')}</p>}
    </section>
  )
}
