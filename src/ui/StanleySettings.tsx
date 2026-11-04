import { STANLEY_LEVELS, type StanleyLevel } from '../settings/settings'
import { t, th, type StringKey } from '../i18n'
import { useSettings } from '../hooks/useSettings'

/** Quiet Stanley: four levels of how much he speaks up, per device. */
export function StanleySettings() {
  const [settings, update] = useSettings()
  return (
    <section aria-labelledby="stanley-level-h" className="settings-stanley">
      <h2 id="stanley-level-h">{th('stanley.level.title')}</h2>
      <p>{t('stanley.level.intro')}</p>
      <fieldset>
        <legend>{t('stanley.level.label')}</legend>
        {STANLEY_LEVELS.map((l: StanleyLevel) => (
          <label key={l} className="choice">
            <input type="radio" name="stanley-level" checked={settings.stanleyLevel === l} onChange={() => update({ stanleyLevel: l })} />
            <span>{t(`stanley.level.${l}` as StringKey)}</span>
          </label>
        ))}
      </fieldset>
      {(settings.calm || settings.simple) && <p className="muted">{t('stanley.level.calmNote')}</p>}
    </section>
  )
}
