import { Link } from 'react-router'
import { CircleDot } from 'lucide-react'
import { useStageFacts } from '../../hooks/useStageFacts'
import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { t, th } from '../../i18n'
import { openedFrom } from '../../routes/screens'
import { RecentCard } from './RecentCard'
import { StanleyNext } from '../ai/StanleyNext'
import { StanleyModeCard } from '../ai/StanleyModeCard'
import { SCREEN_ICONS } from '../screenIcons'
import { StageGuide } from './StageGuide'
import { useGuideView } from '../../hooks/useGuideView'
import { urgentTask } from '../../guide/view'
import { stageTiles } from '../../routes/stageHome'
import { useTileLive } from '../../hooks/useTileLive'
import { needsAttention, type TileLine } from '../../domain/tileLive'
import { TileLiveLine } from '../TileLiveLine'

/** Home for every stage with its own plan: the guide (Do this now, Coming up, Done), then six tiles with one line of state each (plan section 8). */
export function StageHome() {
  const { stage, focusSailingId } = useJourneyPosition()
  const { facts, draftId } = useStageFacts()
  const { data: guide } = useGuideView()
  const tiles = stageTiles(stage, { sailingId: focusSailingId, draftId })
  const live = useTileLive(tiles.map((x) => x.screen.path), true)
  const stateOf = (id: string, path: string): TileLine | null => {
    if (id === 'H11') return { text: facts.savedSailings > 0 ? t('stage.tile.saved', { count: facts.savedSailings }) : t('stage.tile.savedNone'), tone: 'neutral' }
    if ((id === 'H17' || id === 'H18') && !facts.draft?.started) return { text: t('stage.tile.noDraft'), tone: 'neutral' }
    return live[path] ?? null
  }
  const attention = urgentTask(guide)?.to ?? null
  return (
    <>
      <StanleyModeCard />
      <StanleyNext />
      <StageGuide />
      <hr className="brass-rule" aria-hidden="true" />
      <nav aria-labelledby="stage-tiles-h" data-tour="home-tiles">
        <h2 id="stage-tiles-h">{th('stage.tiles.title')}</h2>
        <ul className="stage-tiles">
          {tiles.map(({ screen, to }) => {
            const Icon = SCREEN_ICONS[screen.id] ?? CircleDot
            const state = stateOf(screen.id, screen.path)
            const flagged = to === attention || needsAttention(state ?? undefined)
            return (
            <li key={screen.id} className={`stage-tile motion-lift${flagged ? ' stage-tile--attention' : ''}`}>
              <Link to={to} state={openedFrom('blue')} className="stage-tile__link">
                <Icon className="stage-tile__icon" aria-hidden="true" />
                <span className="stage-tile__title">{th(screen.titleKey)}</span>
                <span className="screen-list__subtext">{state ? <TileLiveLine line={state} /> : t(screen.subtextKey)}</span>
                {flagged && <><span className="stage-tile__dot" aria-hidden="true"><CircleDot /></span><span className="visually-hidden">{t('stage.tile.attention')}</span></>}
              </Link>
            </li>
            )
          })}
        </ul>
      </nav>
      <RecentCard />
      <p><Link to="/home/find-pass">{t('route.findPass')}</Link></p>
    </>
  )
}
