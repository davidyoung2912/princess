import { STANLEY_LEVELS } from '../settings/settings'
import { levelOfProactivity, PROACTIVITY, proactivityOfLevel } from '../ai/stanleyMemory'
import { t, th, type StringKey } from '../i18n'
import { useSettings } from '../hooks/useSettings'

/** Quiet Stanley: three plain choices over the four levels (decision 5 of the Stanley plan), which stay the mechanism, plus Off. Per device. */
export function StanleySettings() {
  const [settings, update] = useSettings()
  const current = proactivityOfLevel(settings.stanleyLevel)
  return (
    <section aria-labelledby="stanley-level-h" className="settings-stanley">
      <h2 id="stanley-level-h">{th('stanley.level.title')}</h2>
      <p>{t('stanley.level.intro')}</p>
      <fieldset>
        <legend>{t('stanley.level.label')}</legend>
        {PROACTIVITY.map((p) => (
          <label key={p} className="choice">
            <input type="radio" name="stanley-level" checked={current === p} onChange={() => update({ stanleyLevel: levelOfProactivity(p) })} />
            <span>{t(`stanley.proactive.${p}` as StringKey)}</span>
          </label>
        ))}
        <label className="choice">
          <input type="radio" name="stanley-level" checked={current === null} onChange={() => update({ stanleyLevel: STANLEY_LEVELS[3] })} />
          <span>{t('stanley.level.off')}</span>
        </label>
      </fieldset>
      {(settings.calm || settings.simple) && <p className="muted">{t('stanley.level.calmNote')}</p>}
    </section>
  )
}
