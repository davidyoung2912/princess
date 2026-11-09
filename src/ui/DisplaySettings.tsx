import { Link } from 'react-router'
import { HelpTip } from './HelpTip'
import { t, th, type StringKey } from '../i18n'
import { TEXT_SIZES } from '../design/textSize'
import { CONSENT_REGIONS } from '../domain/ahead'
import { UNITS } from '../domain/readiness'
import { useSettings } from '../hooks/useSettings'
import { LanguageSwitch } from './LanguageSwitch'
import { FUN_LEVELS, TRIP_COLOURS, type ContrastChoice, type ThemeChoice } from '../settings/settings'

const THEMES: readonly ThemeChoice[] = ['auto', 'light', 'dark', 'night']
const CONTRASTS: readonly ContrastChoice[] = ['standard', 'high']

/** Text size, colour theme, contrast and reduce-motion controls; applied at once and saved on the device. */
export function DisplaySettings() {
  const [settings, update] = useSettings()
  return (
    <section aria-labelledby="display-settings-h">
      <h2 id="display-settings-h">{th('settings.title')}</h2>
      <LanguageSwitch />
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
        <HelpTip about={t('settings.theme')}>{t('helptip.theme')}</HelpTip>
        {THEMES.map((theme) => (
          <label key={theme} className="choice">
            <input type="radio" name="theme" checked={settings.theme === theme} onChange={() => update({ theme })} />
            {t(`settings.theme.${theme}` as StringKey)}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{t('settings.contrast')}</legend>
        <HelpTip about={t('settings.contrast')}>{t('helptip.contrast')}</HelpTip>
        {CONTRASTS.map((contrast) => (
          <label key={contrast} className="choice">
            <input type="radio" name="contrast" checked={settings.contrast === contrast} onChange={() => update({ contrast })} />
            {t(`settings.contrast.${contrast}` as StringKey)}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{t('settings.tripColour')}</legend>
        <p className="field__hint">{t('settings.tripColourHint')}</p>
        {TRIP_COLOURS.map((colour) => (
          <label key={colour} className="choice">
            <input type="radio" name="trip-colour" checked={settings.tripColour === colour} onChange={() => update({ tripColour: colour })} />
            <span className="trip-swatch" data-trip={colour} aria-hidden="true" />
            {t(`settings.tripColour.${colour}` as StringKey)}
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
        <input type="checkbox" checked={settings.calm} onChange={(e) => update({ calm: e.target.checked })} />
        <span>
          {t('settings.calm')}
          <small>{t('settings.calmHint')}</small>
        </span>
      </label>
      <fieldset>
        <legend>{t('settings.fun')}</legend>
        <p className="field__hint">{t('settings.funHint')}</p>
        {FUN_LEVELS.map((fun) => (
          <label key={fun} className="choice">
            <input type="radio" name="fun-level" checked={settings.fun === fun} onChange={() => update({ fun })} />
            <span>{t(`settings.fun.${fun}` as StringKey)}<small>{t(`settings.fun.${fun}.hint` as StringKey)}</small></span>
          </label>
        ))}
      </fieldset>
      <label className="choice">
        <input type="checkbox" checked={settings.sounds} onChange={(e) => update({ sounds: e.target.checked })} />
        <span>
          {t('settings.sounds')}
          <small>{t('settings.soundsHint')}</small>
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
      <label className="choice">
        <input type="checkbox" checked={settings.essentials} onChange={(e) => update({ essentials: e.target.checked })} />
        <span>
          {t('settings.essentials')}
          <small>{t('settings.essentialsHint')}</small>
        </span>
      </label>
      <fieldset>
        <legend>{t('settings.units')}</legend>
        <HelpTip about={t('settings.units')}>{t('helptip.units')}</HelpTip>
        {UNITS.map((units) => (
          <label key={units} className="choice">
            <input type="radio" name="units" checked={settings.units === units} onChange={() => update({ units, unitsChosen: true })} />
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
