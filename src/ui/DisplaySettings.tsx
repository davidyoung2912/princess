import { Link } from 'react-router'
import { t, type StringKey } from '../i18n'
import { TEXT_SIZES } from '../design/textSize'
import { CONSENT_REGIONS } from '../domain/ahead'
import { UNITS } from '../domain/readiness'
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
      <fieldset>
        <legend>{t('settings.units')}</legend>
        {UNITS.map((units) => (
          <label key={units} className="choice">
            <input type="radio" name="units" checked={settings.units === units} onChange={() => update({ units })} />
            {t(`settings.units.${units}` as StringKey)}
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="settings-region">{t('settings.region')}</label>
        <p className="field__hint">{t('settings.regionHint')} <Link to="/me/money">{t('settings.currencyLink')}</Link></p>
        <select id="settings-region" className="field__input" value={settings.region} onChange={(e) => update({ region: e.target.value as typeof settings.region })}>
          {CONSENT_REGIONS.map((r) => <option key={r.id} value={r.id}>{t(`settings.region.${r.id}` as StringKey)}</option>)}
        </select>
      </div>
    </section>
  )
}
