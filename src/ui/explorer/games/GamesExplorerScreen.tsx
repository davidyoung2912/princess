import { Link } from 'react-router'
import { gamesOf } from '../../../domain/games/catalogue'
import { t, headingCase } from '../../../i18n'
import { DiagonalSudokuGame, JigsawSudokuGame, SudokuGame, WordGame } from '../../icons'
import { MoreLinks } from '../Parts'

const ICONS: Record<string, typeof WordGame> = { 'cruise-wordle': WordGame, sudoku: SudokuGame, 'diagonal-sudoku': DiagonalSudokuGame, 'jigsaw-sudoku': JigsawSudokuGame }

/** The Games Explorer: every game has a page of its own, listed here under games for one player and games for a group. */
export function GamesExplorerScreen() {
  const solo = gamesOf('single')
  const multi = gamesOf('multi')
  return (
    <div className="page">
      <section aria-labelledby="gx-solo-h">
        <h2 id="gx-solo-h">{headingCase(t('gx.solo.title'))}</h2>
        <p>{t('gx.solo.body')}</p>
        <ul className="card-grid">
          {solo.map((g) => (
            <li key={g.id} className="card exp-card gx-card">
              {(() => { const Icon = ICONS[g.id] ?? WordGame; return <Icon className="gx-card__icon" aria-hidden="true" focusable="false" /> })()}
              <div>
                <h3 className="card__title"><Link className="exp-card__link" to={g.path}>{t(g.titleKey)}</Link></h3>
                <p className="muted">{t(g.bodyKey)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="gx-multi-h">
        <h2 id="gx-multi-h">{headingCase(t('gx.multi.title'))}</h2>
        <p>{t('gx.multi.body')}</p>
        {multi.length === 0 && <p className="muted">{t('gx.multi.soon')}</p>}
      </section>
      <MoreLinks links={[{ to: '/ship/games', label: t('route.games') }, { to: '/activities-explorer', label: t('route.activitiesExplorer') }]} />
    </div>
  )
}
