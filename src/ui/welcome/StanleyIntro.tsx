import { Link, useLocation } from 'react-router'
import { STANLEY_LEVELS } from '../../settings/settings'
import { levelOfProactivity, PROACTIVITY, proactivityOfLevel } from '../../ai/stanleyMemory'
import { t, th, type StringKey } from '../../i18n'
import { useSettings } from '../../hooks/useSettings'
import { Card } from '../Card'
import { LinkButton } from '../Button'
import { StanleyPose } from '../StanleyPose'
import { AvatarPicker } from '../AvatarPicker'

/** What Stanley can do, in the order shown. The words are `stanleyIntro.can.<n>`. */
const CAN = [1, 2, 3, 4] as const

/** Where "Continue" goes: the screen the guest was opening (the stage welcome, if due, takes over from there), otherwise Home. */
const back = (from: unknown): string => (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/welcome') ? from : '/')

/**
 * The one-time introduction a new guest sees first: Stanley waves, says who he is and what he can do, and offers the same how-much-to-say choice as Settings.
 * The choice is saved as it is made (and follows the guest between devices), so leaving the page any way at all keeps it.
 */
export function StanleyIntro() {
  const { state } = useLocation()
  const [settings, update] = useSettings()
  const current = proactivityOfLevel(settings.stanleyLevel)
  return (
    <div className="page welcome stanley-intro">
      <div className="stanley-intro__hero">
        <StanleyPose pose="wave" size={220} />
      </div>
      <header className="welcome__head">
        <p className="welcome__eyebrow">{t('stanleyIntro.eyebrow')}</p>
        <h2 className="welcome__title">{t('stanleyIntro.title')}</h2>
      </header>
      <Card labelledBy="stanley-intro-who-h">
        <h2 id="stanley-intro-who-h">{th('stanleyIntro.h.who')}</h2>
        <p>{t('stanleyIntro.who')}</p>
      </Card>
      <Card labelledBy="stanley-intro-can-h">
        <h2 id="stanley-intro-can-h">{th('stanleyIntro.h.can')}</h2>
        <ul className="stanley-intro__can">
          {CAN.map((n) => <li key={n}>{t(`stanleyIntro.can.${n}` as StringKey)}</li>)}
        </ul>
      </Card>
      <Card labelledBy="stanley-intro-avatar-h">
        <h2 id="stanley-intro-avatar-h">{th('avatar.title')}</h2>
        <p>{t('avatar.intro')}</p>
        <AvatarPicker />
        <p className="muted">{t('avatar.skip')}</p>
      </Card>
      <Card hero labelledBy="stanley-intro-level-h">
        <h2 id="stanley-intro-level-h">{th('stanleyIntro.h.level')}</h2>
        <p>{t('stanleyIntro.level.intro')}</p>
        <fieldset>
          <legend>{t('stanley.level.label')}</legend>
          {PROACTIVITY.map((p) => (
            <label key={p} className="choice">
              <input type="radio" name="stanley-intro-level" checked={current === p} onChange={() => update({ stanleyLevel: levelOfProactivity(p) })} />
              <span>{t(`stanley.proactive.${p}` as StringKey)}</span>
            </label>
          ))}
          <label className="choice">
            <input type="radio" name="stanley-intro-level" checked={current === null} onChange={() => update({ stanleyLevel: STANLEY_LEVELS[3] })} />
            <span>{t('stanley.level.off')}</span>
          </label>
        </fieldset>
        <p className="muted">{t('stanleyIntro.level.later')} <Link to="/me/settings">{t('stanleyIntro.level.settings')}</Link></p>
        <div className="button-row"><LinkButton to={back((state as { from?: unknown } | null)?.from)} replace>{t('stanleyIntro.go')}</LinkButton></div>
      </Card>
    </div>
  )
}
