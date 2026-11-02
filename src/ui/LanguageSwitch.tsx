import { useId } from 'react'
import { LOCALES, t } from '../i18n'
import { useSettings } from '../hooks/useSettings'

/** Chooses the language of the app's text (N5.5). Each language is named in itself, and the control sits where a guest can find it before signing in. */
export function LanguageSwitch() {
  const [settings, update] = useSettings()
  const id = useId()
  return (
    <div className="field language-switch">
      <label htmlFor={id}>{t('lang.label')}</label>
      <select id={id} className="field__input" value={settings.language} onChange={(e) => update({ language: e.target.value })}>
        {LOCALES.map((l) => <option key={l.code} value={l.code} lang={l.code}>{l.name}</option>)}
      </select>
      {settings.language !== 'en' && <p className="field__hint">{t('lang.partial')}</p>}
    </div>
  )
}
