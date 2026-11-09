import { Link } from 'react-router'
import { Check, CircleDot } from 'lucide-react'
import type { OnboardToday, TripView } from '../../api/types'
import { useStageFacts } from '../../hooks/useStageFacts'
import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { t, th, type StringKey } from '../../i18n'
import { openedFrom } from '../../routes/screens'
import { RecentCard } from './RecentCard'
import { StanleyNext } from '../ai/StanleyNext'
import { StanleyModeCard } from '../ai/StanleyModeCard'
import { LinkButton } from '../Button'
import { SCREEN_ICONS } from '../screenIcons'
import { useEffect } from 'react'
import { dotReason, publishDot } from '../../ai/stanleyDot'
import { stanleyLevelFor } from '../../settings/settings'
import { useSettings } from '../../hooks/useSettings'
import { nextSteps, stageTiles, urgentStep } from '../../routes/stageHome'

/** Home for Dream, Discover and Book: three Next steps, then six tiles with one line of state each (plan section 8). */
export function StageHome({ trip = null, today = null }: { trip?: TripView | null; today?: OnboardToday | null }) {
  const { stage, focusSailingId } = useJourneyPosition()
  const { facts, draftId } = useStageFacts(trip, today)
  const [settings] = useSettings()
  const reason = dotReason(stage, facts, stanleyLevelFor(settings))
  useEffect(() => { publishDot(reason); return () => publishDot(null) }, [reason])
  const steps = nextSteps(stage, facts)
  const tiles = stageTiles(stage, { sailingId: focusSailingId, draftId })
  const stateOf = (id: string): string | null => {
    if (id === 'H11') return facts.savedSailings > 0 ? t('stage.tile.saved', { count: facts.savedSailings }) : t('stage.tile.savedNone')
    if ((id === 'H17' || id === 'H18') && !facts.draft?.started) return t('stage.tile.noDraft')
    return null
  }
  const urgent = urgentStep(stage, facts) !== null
  const firstUndone = steps.find((x) => !x.done)
  const attention = urgent ? firstUndone?.to ?? null : null
  if (steps.length === 0) return <RecentCard />
  return (
    <>
      <StanleyModeCard />
      <StanleyNext stage={stage} facts={facts} />
      {!urgent && <RecentCard />}
      <section aria-labelledby="stage-next-h" className="stage-next">
        <h2 id="stage-next-h">{th('stage.next.title')}</h2>
        <p className="stage-next__progress muted">{t('stage.next.progress', { done: steps.filter((s) => s.done).length, total: steps.length })}</p>
        <ol className="stage-steps">
          {steps.map((s, i) => {
            const first = s === firstUndone
            return (
              <li key={s.key} className={`stage-step${s.done ? ' stage-steps__done' : ''}${first ? ' stage-step--first' : ''}`}>
                <span className="stage-step__num" aria-hidden="true">{s.done ? <Check size={16} /> : i + 1}</span>
                <span className="stage-step__body">
                  <Link to={s.to} state={openedFrom('blue')}>{t(s.key as StringKey)}</Link>
                  {s.done && <span className="stage-step__done"> · {t('stage.next.done')}</span>}
                </span>
                {first && urgent && <LinkButton to={s.to} state={openedFrom('blue')} aria-label={t(s.key as StringKey)}>{t('stage.next.go')}</LinkButton>}
              </li>
            )
          })}
        </ol>
      </section>
      {urgent && <RecentCard />}
      <nav aria-labelledby="stage-tiles-h">
        <h2 id="stage-tiles-h">{th('stage.tiles.title')}</h2>
        <ul className="stage-tiles">
          {tiles.map(({ screen, to }) => {
            const Icon = SCREEN_ICONS[screen.id] ?? CircleDot
            return (
            <li key={screen.id} className={`stage-tile motion-lift${to === attention ? ' stage-tile--attention' : ''}`}>
              <Link to={to} state={openedFrom('blue')} className="stage-tile__link">
                <Icon className="stage-tile__icon" aria-hidden="true" />
                <span className="stage-tile__title">{th(screen.titleKey)}</span>
                <span className="screen-list__subtext">{stateOf(screen.id) ?? t(screen.subtextKey)}</span>
                {to === attention && <span className="stage-tile__badge"><CircleDot size={14} aria-hidden="true" /> {t('stage.tile.attention')}</span>}
              </Link>
            </li>
            )
          })}
        </ul>
      </nav>
      <p><Link to="/home/find-pass">{t('route.findPass')}</Link></p>
    </>
  )
}
