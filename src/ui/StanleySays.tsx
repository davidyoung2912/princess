import { useState } from 'react'
import { artUrl } from '../art/urls'
import { t } from '../i18n'
import { useSettings } from '../hooks/useSettings'
import { dismissJoke, jokeDismissed, pickJoke } from '../settings/jokeOfTheDay'
import { stanleyLevelFor } from '../settings/settings'
import stanley from '../assets/stanley-small.png'
import { Button } from './Button'

/**
 * Stanley's joke of the day, under the tip card on Home. A new one is picked at random each time Home opens. Dismiss hides it for the rest of the day; it comes back the next day,
 * or when the guest signs in again. Hidden when Stanley is switched off.
 */
export function StanleySays() {
  const [settings] = useSettings()
  const [joke] = useState(() => pickJoke())
  const [gone, setGone] = useState(() => jokeDismissed())
  const level = stanleyLevelFor(settings)
  if (gone || !joke || level === 'asked' || level === 'off') return null
  return (
    <div className="page page--tip no-print">
      <aside className="says" aria-label={t('stanleySays.label')}>
        <img className="says__icon" src={artUrl({ kind: 'head', id: 'laughing' }) ?? stanley} alt="" width="192" height="192" />
        <div className="says__body">
          <p className="says__title">{t('stanleySays.title')}</p>
          <p className="says__text">“{joke}”</p>
        </div>
        <Button variant="secondary" className="says__dismiss" onClick={() => { dismissJoke(); setGone(true) }}>{t('stanleySays.dismiss')}</Button>
      </aside>
    </div>
  )
}
