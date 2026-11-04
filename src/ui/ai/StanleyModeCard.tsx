import stanley from '../../assets/stanley-small.png'
import { goodNowKey, modeAutoShows, titleKey } from '../../ai/stanleyModes'
import { useSettings } from '../../hooks/useSettings'
import { useStanleyMode } from '../../hooks/useStanleyMode'
import { t, type StringKey } from '../../i18n'
import { openedFrom } from '../../routes/screens'
import { stanleyLevelFor } from '../../settings/settings'
import { timeIn } from '../../domain/timezones'
import { LinkButton } from '../Button'

/** The top of Home on a day Stanley leads (boarding day, the first hours aboard, a port day, the last evening and morning): the one next step and a way into the full view. Helpful and Chatty only. */
export function StanleyModeCard() {
  const [settings] = useSettings()
  const { mode, view, goodNow, zone } = useStanleyMode()
  if (!mode || !modeAutoShows(stanleyLevelFor(settings)) || view.steps.length === 0) return null
  const next = view.current
  const text = next ? t('stanley.mode.next', { step: next.label ?? t(titleKey(mode, next) as StringKey) }) : t('stanley.mode.finished')
  return (
    <aside className="stanley-next no-print" aria-label={t(`stanley.mode.${mode}.name` as StringKey)}>
      <img className="stanley-next__face" src={stanley} alt="" width="192" height="192" />
      <p className="tip__text"><strong>{t(`stanley.mode.${mode}.name` as StringKey)}.</strong> {text}</p>
      {mode === 'seaDay' && next?.where && <p className="muted">{next.where}{next.at !== null ? `, ${timeIn(next.at, zone)}` : ''}</p>}
      {mode === 'seaDay' && goodNow && <p className="muted">{t(goodNowKey(goodNow) as StringKey, { time: timeIn(goodNow.at, zone) })}</p>}
      <LinkButton to="/home/mode" state={openedFrom('blue')} aria-label={`${t('stanley.mode.card')}: ${t(`stanley.mode.${mode}.name` as StringKey)}`}>{t('stanley.mode.card')}</LinkButton>
    </aside>
  )
}
