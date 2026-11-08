import stanley from '../../assets/stanley-small.png'
import { Check } from 'lucide-react'
import { goodNowKey, lineKey, modeCanOpen, timingOf, titleKey, type ModeStep } from '../../ai/stanleyModes'
import { useSettings } from '../../hooks/useSettings'
import { useWakeLock } from '../../hooks/useWakeLock'
import { useStanleyMode } from '../../hooks/useStanleyMode'
import { t, type StringKey } from '../../i18n'
import { openedFrom } from '../../routes/screens'
import { stanleyLevelFor } from '../../settings/settings'
import { BUZZ, buzz } from '../../settings/haptics'
import { timeIn } from '../../domain/timezones'
import { Button, LinkButton } from '../Button'
import { BackLink } from '../onboard/common'


/**
 * Stanley leads the day (N-G1, N-E1, N-O1, N-L1): one big next step, the time, a way to the right screen and a "Done" button, with the rest of the day as a thin strip
 * above it. Boarding Day, First Four Hours, Port Day and Last Morning are the same screen with different steps. Rules only; no model is called.
 */
export function StanleyModeScreen() {
  const [settings] = useSettings()
  const { mode, view, zone, tick, goodNow } = useStanleyMode()
  const level = stanleyLevelFor(settings)
  // The two modes with a countdown keep the screen on while a timed step is showing (4.5.4).
  useWakeLock((mode === 'boardingDay' || mode === 'portDay') && view.current?.at != null)
  const back = <BackLink to="/" label={t('route.home')} />
  if (!modeCanOpen(level)) return <div className="page">{back}<p>{t('stanley.mode.off')}</p></div>
  if (!mode || view.steps.length === 0) return <div className="page">{back}<p>{t('stanley.mode.none')}</p></div>
  const cur = view.current
  const timing = timingOf(view.minutesTo)
  const at = (s: ModeStep) => (s.at === null ? '' : timeIn(s.at, zone))
  const title = (s: ModeStep) => s.label ?? t(titleKey(mode, s) as StringKey)
  const onTick = (s: ModeStep) => {
    tick(s.id)
    // A small buzz on the very last step, only where the guest has not asked for calm or less motion (Android only; iOS Safari has no vibrate).
    if (view.later.length === 0) buzz(settings, BUZZ.last)
  }
  return (
    <div className="page stanley-mode">
      {back}
      <h2 className="stanley-mode__name">{t(`stanley.mode.${mode}.name` as StringKey)}</h2>
      <ol className="stanley-mode__strip" aria-label={t('stanley.mode.strip')}>
        {view.steps.map((s) => {
          const done = view.finished.includes(s)
          return (
            <li key={s.id} className={`stanley-mode__pip${done ? ' stanley-mode__pip--done' : ''}${s === cur ? ' stanley-mode__pip--now' : ''}`} aria-current={s === cur ? 'step' : undefined}>
              {done && <Check size={14} aria-hidden="true" />}
              <span>{title(s)}</span>
              {s.at !== null && <span className="muted"> {at(s)}</span>}
              {done && <span className="visually-hidden"> {t('stanley.mode.done')}</span>}
            </li>
          )
        })}
      </ol>
      {cur ? (
        <section className="stanley-mode__now" aria-labelledby="stanley-mode-h" data-timing={timing}>
          <img className="stanley-next__face" src={stanley} alt="" width="192" height="192" />
          <h3 id="stanley-mode-h">{t('stanley.mode.next', { step: title(cur) })}</h3>
          <p className="stanley-mode__line">{t(lineKey(mode, cur, timing) as StringKey, { time: at(cur), minutes: Math.max(0, view.minutesTo ?? 0), place: cur.where ?? '' })}</p>
          {cur.walk !== undefined && <p className="muted">{t('stanley.mode.seaDay.walk', { minutes: cur.walk })}</p>}
          {cur.at !== null && <p className="stanley-mode__time" role="timer" aria-live="off">{timing === 'past' ? t('stanley.mode.past', { time: at(cur) }) : t('stanley.mode.in', { time: at(cur), minutes: view.minutesTo ?? 0 })}</p>}
          <div className="button-row">
            <LinkButton to={cur.to} state={openedFrom('blue')}>{t('stanley.mode.open')}</LinkButton>
            {!cur.done && <Button variant="secondary" onClick={() => onTick(cur)}>{t('stanley.mode.tick')}</Button>}
          </div>
        </section>
      ) : (
        <section className="stanley-mode__now" aria-labelledby="stanley-mode-h">
          <img className="stanley-next__face" src={stanley} alt="" width="192" height="192" />
          <h3 id="stanley-mode-h">{t('stanley.mode.finished')}</h3>
          <p className="stanley-mode__line">{t(`stanley.mode.${mode}.finished` as StringKey)}</p>
        </section>
      )}
      {mode === 'seaDay' && goodNow && <p className="stanley-mode__good">{t(goodNowKey(goodNow) as StringKey, { time: timeIn(goodNow.at, zone) })} <LinkButton to="/ship/pulse" variant="tertiary" state={openedFrom('blue')}>{t('stanley.mode.seaDay.pulse')}</LinkButton></p>}
      {mode === 'portDay' && <p><LinkButton to="/ship/safe-ashore" variant="tertiary" state={openedFrom('blue')}>{t('stanley.mode.portHelp')}</LinkButton></p>}
      <p className="muted">{t('stanley.mode.hint')}</p>
    </div>
  )
}
