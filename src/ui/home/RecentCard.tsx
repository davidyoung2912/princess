import { useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { Clock } from 'lucide-react'
import { getContext, subscribeContext } from '../../account/context'
import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { useSettings } from '../../hooks/useSettings'
import { useNow } from '../../hooks/useDemo'
import { getRecent, subscribeRecent, updateRecent } from '../../recent/store'
import { EMPTY_RECENT, relativeTime, visibleRecent, type RelativeTime } from '../../routes/recent'
import { openedFrom } from '../../routes/screens'
import { t, th, type StringKey } from '../../i18n'
import { LinkButton } from '../Button'
import { Card } from '../Card'
import { SCREEN_ICONS } from '../screenIcons'

function timeText(r: RelativeTime): string {
  return r.kind === 'days' ? t('recent.days', { n: r.n }) : t(`recent.${r.kind}` as StringKey)
}

/** "Pick up where you left off": the last three screens the guest visited, kept on the server so any device shows them (docs/returning-home-plan.md). */
export function RecentCard() {
  const [settings] = useSettings()
  const personId = useSyncExternalStore(subscribeContext, getContext, getContext)?.person.id ?? null
  const state = useSyncExternalStore(subscribeRecent, () => getRecent(personId), () => getRecent(personId))
  const { stage } = useJourneyPosition()
  const now = useNow()
  const rows = visibleRecent(state, stage)
  if (settings.essentials || rows.length === 0) return null
  return (
    <Card hero labelledBy="recent-h">
      <h2 id="recent-h" className="card__title">{th('recent.title')}</h2>
      <ul className="recent-list">
        {rows.map((r, i) => {
          const Icon = SCREEN_ICONS[r.screen.id] ?? Clock
          const title = th(r.screen.titleKey)
          return (
            <li key={r.path} className="recent-row">
              <Icon className="recent-row__icon" aria-hidden="true" />
              <span className="recent-row__text">
                {i === 0 ? <strong>{title}</strong> : <Link to={r.path} state={openedFrom('blue')}>{title}</Link>}
                <span className="muted"> · {timeText(relativeTime(r.at, now))}</span>
              </span>
              {i === 0 && <LinkButton to={r.path} state={openedFrom('blue')} aria-label={t('recent.continueTo', { title: t(r.screen.titleKey) })}>{t('recent.continue')}</LinkButton>}
            </li>
          )
        })}
      </ul>
      <p className="recent-foot muted">
        {t('recent.private')} · <button type="button" className="link-button" aria-label={t('recent.clearLabel')} onClick={() => updateRecent(personId, () => EMPTY_RECENT)}>{t('recent.clear')}</button>
      </p>
    </Card>
  )
}
