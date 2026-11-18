import { Link, useLocation } from 'react-router'
import { STANLEY_LEVELS } from '../../settings/settings'
import { levelOfProactivity, PROACTIVITY, proactivityOfLevel } from '../../ai/stanleyMemory'
import { t, th, type StringKey, headingCase } from '../../i18n'
import { useSettings } from '../../hooks/useSettings'
import { requestStanley } from '../../ai/stanleyOpen'
import { tryExample } from '../../ai/stanleyCapabilities'
import { useStanleyCapabilities } from '../../hooks/useStanleyCapabilities'
import { Card } from '../Card'
import { Button, LinkButton } from '../Button'
import { StanleyPose } from '../StanleyPose'
import { StanleyAuthority } from '../StanleyAuthority'

/** What Stanley can do, in the order shown: answers, does, watches, helps. The words are `stanleyIntro.card.<n>` and `stanleyIntro.can.<n>`; the Try-it sentence for each comes from the server's catalogue group of the same position. */
const CAN = [{ n: 1, group: 'answer' }, { n: 2, group: 'do' }, { n: 3, group: 'watch' }, { n: 4, group: 'value' }] as const

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
  const { catalogue } = useStanleyCapabilities()
  return (
    <div className="page welcome stanley-intro">
      <div className="stanley-intro__hero">
        <StanleyPose pose="wave" size={220} />
      </div>
      <header className="welcome__head">
        <p className="welcome__eyebrow">{t('stanleyIntro.eyebrow')}</p>
        <h2 className="welcome__title">{headingCase(t('stanleyIntro.title'))}</h2>
      </header>
      <Card labelledBy="stanley-intro-who-h">
        <h2 id="stanley-intro-who-h">{th('stanleyIntro.h.who')}</h2>
        <p>{t('stanleyIntro.who')}</p>
      </Card>
      <section aria-labelledby="stanley-intro-can-h" className="stanley-intro__cards">
        <h2 id="stanley-intro-can-h">{th('stanleyIntro.h.can')}</h2>
        {CAN.map(({ n, group }) => {
          const example = tryExample(catalogue, group)
          return (
            <Card key={n} labelledBy={`stanley-intro-card-${n}`}>
              <h3 id={`stanley-intro-card-${n}`}>{t(`stanleyIntro.card.${n}` as StringKey)}</h3>
              <p>{t(`stanleyIntro.can.${n}` as StringKey)}</p>
              {example ? <div className="button-row"><Button variant="secondary" onClick={() => requestStanley(example)} aria-label={t('stanleyIntro.tryFor', { example })}>{t('stanleyIntro.try')}</Button></div> : null}
            </Card>
          )
        })}
        <p><Link to="/me/stanley-can">{t('stanleyIntro.more')}</Link></p>
      </section>
      <Card info labelledBy="stanley-intro-never-h">
        <h2 id="stanley-intro-never-h">{th('stanleyIntro.never.title')}</h2>
        <p>{t('stanleyIntro.never.body')}</p>
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
        <p className="muted">{t('stanleyIntro.control.body')}</p>
        <p className="muted">{t('stanleyIntro.level.later')} <Link to="/me/settings">{t('stanleyIntro.level.settings')}</Link></p>
      </Card>
      <StanleyAuthority source="welcome" />
      <div className="button-row"><LinkButton to={back((state as { from?: unknown } | null)?.from)} replace>{t('stanleyIntro.go')}</LinkButton></div>
    </div>
  )
}
