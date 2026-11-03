import { Link } from 'react-router'
import { api } from '../../runtime'
import { useMine } from '../../hooks/useMine'
import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { t, th, type StringKey } from '../../i18n'
import { openedFrom } from '../../routes/screens'
import { nextSteps, stageTiles, type HomeFacts } from '../../routes/stageHome'

/** Home for Dream, Discover and Book: three Next steps, then six tiles with one line of state each (plan section 8). */
export function StageHome() {
  const { stage, focusSailingId } = useJourneyPosition()
  const favourites = useMine(() => api.discover.favourites())
  const draft = useMine(() => api.booking.draft())
  const d = draft.data
  const facts: HomeFacts = {
    savedSailings: (favourites.data ?? []).filter((k) => k.startsWith('sailing:')).length,
    draft: d ? { id: d.id, categoryChosen: d.category !== '', started: d.category !== '' || d.people.some((p) => p.firstName !== '' || p.lastName !== '') } : null,
  }
  const steps = nextSteps(stage, facts)
  const tiles = stageTiles(stage, { sailingId: focusSailingId, draftId: d?.id ?? null })
  const stateOf = (id: string): string | null => {
    if (id === 'H11') return facts.savedSailings > 0 ? t('stage.tile.saved', { count: facts.savedSailings }) : t('stage.tile.savedNone')
    if ((id === 'H17' || id === 'H18') && !facts.draft?.started) return t('stage.tile.noDraft')
    return null
  }
  if (steps.length === 0) return null
  return (
    <>
      <section aria-labelledby="stage-next-h">
        <h2 id="stage-next-h">{th('stage.next.title')}</h2>
        <ol className="stage-steps">
          {steps.map((s) => (
            <li key={s.key} className={s.done ? 'stage-steps__done' : undefined}>
              <Link to={s.to} state={openedFrom('blue')}>{t(s.key as StringKey)}</Link>
              {s.done && <span className="muted"> · {t('stage.next.done')}</span>}
            </li>
          ))}
        </ol>
      </section>
      <nav aria-labelledby="stage-tiles-h">
        <h2 id="stage-tiles-h">{th('stage.tiles.title')}</h2>
        <ul className="stage-tiles">
          {tiles.map(({ screen, to }) => (
            <li key={screen.id} className="stage-tile">
              <Link to={to} state={openedFrom('blue')}>{th(screen.titleKey)}</Link>
              <span className="screen-list__subtext">{stateOf(screen.id) ?? t(screen.subtextKey)}</span>
            </li>
          ))}
        </ul>
      </nav>
      <p><Link to="/home/find-pass">{t('route.findPass')}</Link></p>
    </>
  )
}
