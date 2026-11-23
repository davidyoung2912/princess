import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { gamesOf, type GameEntry } from '../../../games/domain/catalogue'
import { t, headingCase } from '../../../../shared/i18n'
import { BinairoGame, FutoshikiGame, CodewordGame, HitoriGame, WordSearchGame, SlitherlinkGame, CrossmathGame, NonogramGame, MinesweeperGame, HashiGame, NurikabeGame, BattleshipGame, KlondikeGame, SpiderGame, FreeCellGame, PyramidGame, TriPeaksGame, GapsGame, PegGame, LightsGame, SlideGame, ReversiGame, GomokuGame, PenteGame, HexGame, MorrisGame, DotsGame, HuntGame, KalahGame, BackgammonGame, CheckersGame, KakuroGame, KenKenGame, DiagonalSudokuGame, JigsawSudokuGame, KillerSudokuGame, SudokuGame, WordGame } from '../../../../shared/ui/icons'
import { MoreLinks } from '../Parts'

type Filter = 'all' | 'computer' | 'quick'
const FILTERS: readonly { id: Filter; key: 'gx.filter.all' | 'gx.filter.computer' | 'gx.filter.quick' }[] = [{ id: 'all', key: 'gx.filter.all' }, { id: 'computer', key: 'gx.filter.computer' }, { id: 'quick', key: 'gx.filter.quick' }]
const matches = (g: GameEntry, f: Filter) => f === 'all' || (f === 'computer' ? g.vs === true : g.minutes[1] <= 20)

/** What can be chosen before a game, said the same way on every card. */
const facetText = (g: GameEntry): string | null => {
  const f = g.facets
  if (!f) return null
  return [f.variants ? t('gx.meta.variants', { count: f.variants }) : '', f.sizes ? t('gx.meta.sizes', { count: f.sizes }) : '', f.opponents ? t('gx.meta.opponents', { count: f.opponents }) : ''].filter(Boolean).join(' · ')
}

const ICONS: Record<string, typeof WordGame> = { 'cruise-wordle': WordGame, sudoku: SudokuGame, 'diagonal-sudoku': DiagonalSudokuGame, 'jigsaw-sudoku': JigsawSudokuGame, 'killer-sudoku': KillerSudokuGame, binairo: BinairoGame, futoshiki: FutoshikiGame, kenken: KenKenGame, kakuro: KakuroGame, codeword: CodewordGame, hitori: HitoriGame, 'word-search': WordSearchGame, slitherlink: SlitherlinkGame, crossmath: CrossmathGame, nonogram: NonogramGame, minesweeper: MinesweeperGame, hashi: HashiGame, nurikabe: NurikabeGame, battleship: BattleshipGame, klondike: KlondikeGame, spider: SpiderGame, freecell: FreeCellGame, pyramid: PyramidGame, tripeaks: TriPeaksGame, gaps: GapsGame, peg: PegGame, lights: LightsGame, slide: SlideGame, reversi: ReversiGame, gomoku: GomokuGame, pente: PenteGame, hex: HexGame, morris: MorrisGame, dots: DotsGame, hunt: HuntGame, kalah: KalahGame, backgammon: BackgammonGame, checkers: CheckersGame }

/** The Games Explorer: every game has a page of its own, listed here under games for one player and games for a group. */
export function GamesExplorerScreen() {
  const [filter, setFilter] = useState<Filter>('all')
  const navigate = useNavigate()
  const solo = gamesOf('single').filter((g) => matches(g, filter))
  const multi = gamesOf('multi')
  return (
    <div className="page">
      <section aria-labelledby="gx-solo-h">
        <h2 id="gx-solo-h">{headingCase(t('gx.solo.title'))}</h2>
        <p>{t('gx.solo.body')}</p>
        <div className="gx-filters" role="group" aria-label={t('gx.filter.label')}>
          {FILTERS.map((f) => <button key={f.id} type="button" className="gx-chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{t(f.key)}</button>)}
          <button type="button" className="gx-chip" onClick={() => { const pool = solo.length ? solo : gamesOf('single'); navigate(pool[Math.floor(Math.random() * pool.length)].path) }}>{t('gx.surprise')}</button>
        </div>
        {solo.length === 0 && <p className="muted" role="status">{t('gx.filter.none')}</p>}
        <ul className="card-grid">
          {solo.map((g) => (
            <li key={g.id} className="card exp-card gx-card">
              {(() => { const Icon = ICONS[g.id] ?? WordGame; return <Icon className="gx-card__icon" aria-hidden="true" focusable="false" /> })()}
              <div>
                <h3 className="card__title"><Link className="exp-card__link" to={g.path}>{t(g.titleKey)}</Link></h3>
                <p className="muted">{t(g.bodyKey)}</p>
                <ul className="gx-card__meta muted" aria-label={t('gx.meta.label')}>
                  <li>{facetText(g) ?? (g.levelsKey ? t(g.levelsKey) : t('gx.meta.levels', { count: g.levels }))}</li>
                  <li>{t('gx.meta.players', { count: g.players })}</li>
                  <li>{g.minutes[0] === g.minutes[1] ? t('gx.meta.timeOne', { min: g.minutes[0] }) : t('gx.meta.time', { min: g.minutes[0], max: g.minutes[1] })}</li>
                </ul>
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
