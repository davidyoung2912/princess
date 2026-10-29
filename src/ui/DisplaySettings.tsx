import { t, type StringKey } from '../i18n'
import { TEXT_SIZES } from '../design/textSize'
import { useSettings } from '../hooks/useSettings'
import type { ContrastChoice, ThemeChoice } from '../settings/settings'

const THEMES: readonly ThemeChoice[] = ['auto', 'light', 'dark']
const CONTRASTS: readonly ContrastChoice[] = ['standard', 'high']

/** Text size, colour theme, contrast and reduce-motion controls; applied at once and saved on the device. */
export function DisplaySettings() {
  const [settings, update] = useSettings()
  return (
    <section aria-labelledby="display-settings-h">
      <h2 id="display-settings-h">{t('settings.title')}</h2>
      <fieldset>
        <legend>{t('settings.textSize')}</legend>
        {TEXT_SIZES.map((size) => (
          <label key={size} className="choice">
            <input type="radio" name="text-size" checked={settings.textSize === size} onChange={() => update({ textSize: size })} />
            {t(`settings.textSize.${size}` as StringKey)}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{t('settings.theme')}</legend>
        {THEMES.map((theme) => (
          <label key={theme} className="choice">
            <input type="radio" name="theme" checked={settings.theme === theme} onChange={() => update({ theme })} />
            {t(`settings.theme.${theme}` as StringKey)}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{t('settings.contrast')}</legend>
        {CONTRASTS.map((contrast) => (
          <label key={contrast} className="choice">
            <input type="radio" name="contrast" checked={settings.contrast === contrast} onChange={() => update({ contrast })} />
            {t(`settings.contrast.${contrast}` as StringKey)}
          </label>
        ))}
      </fieldset>
      <label className="choice">
        <input type="checkbox" checked={settings.reduceMotion} onChange={(e) => update({ reduceMotion: e.target.checked })} />
        <span>
          {t('settings.reduceMotion')}
          <small>{t('settings.reduceMotionHint')}</small>
        </span>
      </label>
      <label className="choice">
        <input type="checkbox" checked={settings.simple} onChange={(e) => update({ simple: e.target.checked })} />
        <span>
          {t('settings.simple')}
          <small>{t('settings.simpleHint')}</small>
        </span>
      </label>
      <label className="choice">
        <input type="checkbox" checked={settings.captions} onChange={(e) => update({ captions: e.target.checked })} />
        <span>
          {t('settings.captions')}
          <small>{t('settings.captionsHint')}</small>
        </span>
      </label>
      <label className="choice">
        <input type="checkbox" checked={settings.dataLight} onChange={(e) => update({ dataLight: e.target.checked })} />
        <span>
          {t('settings.dataLight')}
          <small>{t('settings.dataLightHint')}</small>
        </span>
      </label>
    </section>
  )
}
