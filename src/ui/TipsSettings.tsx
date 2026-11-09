import { useState, useSyncExternalStore } from 'react'
import { getContext, subscribeContext } from '../account/context'
import { t, th } from '../i18n'
import { resetTips } from '../settings/tips'
import { resetSeen } from '../settings/stanleySeen'
import { resetWelcomes } from '../stageWelcome/store'
import { resetProgress } from '../stageProgress/store'
import { resetTicks } from '../settings/welcomeNeeds'
import { Button } from './Button'

/** Brings back every traveller tip the guest has dismissed on this device, and (separately) the welcome shown on entering each stage of the journey. */
export function TipsSettings() {
  const [done, setDone] = useState(false)
  const [welcomeDone, setWelcomeDone] = useState(false)
  const personId = useSyncExternalStore(subscribeContext, getContext, getContext)?.person.id ?? null
  return (
    <>
      <section aria-labelledby="tips-settings-h" className="settings-tips">
        <h2 id="tips-settings-h">{th('settings.tips.title')}</h2>
        <p>{t('settings.tips.intro')}</p>
        <Button variant="secondary" onClick={() => { resetTips(); resetSeen(); setDone(true) }}>{t('settings.tips.reset')}</Button>
        {done && <p role="status">{t('settings.tips.done')}</p>}
      </section>
      <section aria-labelledby="welcome-settings-h" className="settings-tips">
        <h2 id="welcome-settings-h">{th('settings.welcome.title')}</h2>
        <p>{t('settings.welcome.intro')}</p>
        <Button variant="secondary" onClick={() => { resetWelcomes(personId); resetProgress(personId); resetTicks(); setWelcomeDone(true) }}>{t('settings.welcome.reset')}</Button>
        {welcomeDone && <p role="status">{t('settings.welcome.done')}</p>}
      </section>
    </>
  )
}
