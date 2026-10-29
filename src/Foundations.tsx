import { t, type StringKey } from './i18n'
import { TEXT_SIZES } from './design/textSize'
import { useSettings } from './hooks/useSettings'
import type { ContrastChoice, ThemeChoice } from './settings/settings'
import { ConceptNotice } from './ui/ConceptNotice'

const THEMES: readonly ThemeChoice[] = ['auto', 'light', 'dark']
const CONTRASTS: readonly ContrastChoice[] = ['standard', 'high']

/**
 * A throwaway page for judging the design language during setup (step 0b): sample type, the colour tokens and the
 * display settings. It is replaced by the real shell and a component kit page in step 0c.
 */
export function Foundations() {
  const [settings, update] = useSettings()
  return (
    <>
      <a className="skip-link" href="#main">{t('app.name')}</a>
      <main id="main" className="page">
        <h1>{t('foundations.title')}</h1>
        <p>{t('foundations.intro')}</p>

        <section className="card card--hero fade-in" aria-labelledby="sample-h">
          <h2 id="sample-h">{t('foundations.sample.heading')}</h2>
          <p>{t('foundations.sample.body')}</p>
          <p>{t('foundations.sample.numbers')}</p>
        </section>

        <section aria-labelledby="settings-h">
          <h2 id="settings-h">{t('settings.title')}</h2>
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
        </section>

        <section aria-labelledby="palette-h">
          <h2 id="palette-h">{t('palette.title')}</h2>
          <ul className="swatches">
            <li className="swatch swatch--primary">{t('palette.primary')}</li>
            <li className="swatch swatch--warm">{t('palette.surfaceWarm')}</li>
            <li className="swatch swatch--info">{t('palette.surfaceInfo')}</li>
            <li className="swatch swatch--success">{t('palette.success')}</li>
            <li className="swatch swatch--warning">{t('palette.warning')}</li>
            <li className="swatch swatch--danger">{t('palette.danger')}</li>
            <li className="swatch swatch--gold">{t('palette.gold')}</li>
          </ul>
        </section>

        <ConceptNotice />
      </main>
    </>
  )
}
