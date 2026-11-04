import stanley from '../../assets/stanley-small.png'
import { dailyKind } from '../../ai/stanleyModes'
import { portById } from '../../domain/sailings'
import type { ItineraryDay } from '../../domain/sailings'
import { useSettings } from '../../hooks/useSettings'
import { t, type StringKey } from '../../i18n'
import { stanleyLevelFor } from '../../settings/settings'

/** Stanley's one line for the day, at the top of the briefing: where the ship is and the one time that matters. Rules only, nothing sent. Helpful and Chatty only. */
export function StanleyDaily({ day, of }: { day: ItineraryDay; of: number }) {
  const [settings] = useSettings()
  const level = stanleyLevelFor(settings)
  if (level !== 'helpful' && level !== 'chatty') return null
  const port = day.port === 'sea' ? undefined : portById(day.port)
  const kind = dailyKind({ day: day.day, of, port: day.port, allAboard: day.allAboard, tender: port?.tender })
  return (
    <aside className="stanley-next no-print" aria-label={t('stanley.daily.label')}>
      <img className="stanley-next__face" src={stanley} alt="" width="192" height="192" />
      <p className="tip__text">{t(`stanley.daily.${kind}` as StringKey, { place: port?.name ?? '', time: day.allAboard ?? '' })}</p>
    </aside>
  )
}
