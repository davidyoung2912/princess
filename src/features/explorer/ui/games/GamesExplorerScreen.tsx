import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { GAME_GROUPS, gamesOf, type GameEntry, type GameGroup } from '../../../games/domain/catalogue'
import { t, headingCase, type StringKey } from '../../../../shared/i18n'
import { BinairoGame, FutoshikiGame, CodewordGame, HitoriGame, WordSearchGame, SlitherlinkGame, CrossmathGame, NonogramGame, MinesweeperGame, HashiGame, NurikabeGame, BattleshipGame, KlondikeGame, SpiderGame, FreeCellGame, PyramidGame, TriPeaksGame, GapsGame, LogicGroup, QuickGroup, DeductionGroup, PegGame, LightsGame, SlideGame, ReversiGame, GomokuGame, PenteGame, HexGame, MorrisGame, DotsGame, HuntGame, KalahGame, BackgammonGame, CheckersGame, PigGame, YachtGame, ShutboxGame, MastermindGame, Connect4Game, BreakthroughGame, KonaneGame, NimGame, KakuroGame, KenKenGame, DiagonalSudokuGame, JigsawSudokuGame, KillerSudokuGame, SudokuGame, WordGame } from '../../../../shared/ui/icons'
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

const ICONS: Record<string, typeof WordGame> = { 'cruise-wordle': WordGame, sudoku: SudokuGame, 'diagonal-sudoku': DiagonalSudokuGame, 'jigsaw-sudoku': JigsawSudokuGame, 'killer-sudoku': KillerSudokuGame, binairo: BinairoGame, futoshiki: FutoshikiGame, kenken: KenKenGame, kakuro: KakuroGame, codeword: CodewordGame, hitori: HitoriGame, 'word-search': WordSearchGame, slitherlink: SlitherlinkGame, crossmath: CrossmathGame, nonogram: NonogramGame, minesweeper: MinesweeperGame, hashi: HashiGame, nurikabe: NurikabeGame, battleship: BattleshipGame, klondike: KlondikeGame, spider: SpiderGame, freecell: FreeCellGame, pyramid: PyramidGame, tripeaks: TriPeaksGame, gaps: GapsGame, peg: PegGame, lights: LightsGame, slide: SlideGame, reversi: ReversiGame, gomoku: GomokuGame, pente: PenteGame, hex: HexGame, morris: MorrisGame, dots: DotsGame, hunt: HuntGame, kalah: KalahGame, backgammon: BackgammonGame, checkers: CheckersGame, pig: PigGame, yacht: YachtGame, shutbox: ShutboxGame, mastermind: MastermindGame, connect4: Connect4Game, breakthrough: BreakthroughGame, konane: KonaneGame, nim: NimGame }

/** The Games Explorer: every game has a page of its own, listed here under games for one player and games for a group. */
const GROUP_KEYS: Record<GameGroup, { title: StringKey; body: StringKey }> = {
  words: { title: 'gx.group.words.title', body: 'gx.group.words.body' },
  numbers: { title: 'gx.group.numbers.title', body: 'gx.group.numbers.body' },
  logic: { title: 'gx.group.logic.title', body: 'gx.group.logic.body' },
  cards: { title: 'gx.group.cards.title', body: 'gx.group.cards.body' },
  strategy: { title: 'gx.group.strategy.title', body: 'gx.group.strategy.body' },
  abstract: { title: 'gx.group.abstract.title', body: 'gx.group.abstract.body' },
  dice: { title: 'gx.group.dice.title', body: 'gx.group.dice.body' },
  deduction: { title: 'gx.group.deduction.title', body: 'gx.group.deduction.body' },
}

/** The page of a game picked at random from `pool`. */
const surprise = (pool: readonly GameEntry[]): string => pool[Math.floor(Math.random() * pool.length)].path

const GROUP_ICONS: Record<GameGroup, typeof WordGame> = { words: WordGame, numbers: SudokuGame, logic: LogicGroup, cards: KlondikeGame, strategy: BreakthroughGame, abstract: QuickGroup, dice: BackgammonGame, deduction: DeductionGroup }

/** Moves to a section: scrolls it into view (without animation when the guest prefers reduced motion) and puts focus on its heading so the keyboard and screen readers follow. */
function goTo(group: GameGroup) {
  const el = document.getElementById(`gx-group-${group}`)
  if (!el) return
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  el.focus({ preventScroll: true })
}

/** The Games Explorer: games for one player in sections (words, numbers, logic, cards, board strategy, quick duels, dice, deduction), with a row of buttons at the top that jump to each, and games for a group below. */
export function GamesExplorerScreen() {
  const [filter, setFilter] = useState<Filter>('all')
  const navigate = useNavigate()
  const solo = gamesOf('single').filter((g) => matches(g, filter))
  const multi = gamesOf('multi')
  const sections = GAME_GROUPS.map((group) => ({ group, games: solo.filter((g) => g.group === group) })).filter((x) => x.games.length > 0)
  return (
    <div className="page">
      <section aria-labelledby="gx-solo-h">
        <h2 id="gx-solo-h">{headingCase(t('gx.solo.title'))}</h2>
        <p>{t('gx.solo.body')}</p>
        <div className="gx-filters" data-tour="gx-filters" role="group" aria-label={t('gx.filter.label')}>
          {FILTERS.map((f) => <button key={f.id} type="button" className="gx-chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{t(f.key)}</button>)}
          <button type="button" className="gx-chip" onClick={() => navigate(surprise(solo.length ? solo : gamesOf('single')))}>{t('gx.surprise')}</button>
        </div>
        {sections.length > 0 && (
          <nav className="gx-nav" data-tour="gx-nav" aria-label={t('gx.nav.label')}>
            {sections.map(({ group, games }) => <button key={group} type="button" className="gx-chip gx-chip--nav" onClick={() => goTo(group)}>{t(GROUP_KEYS[group].title)} <span className="gx-chip__n">{games.length}</span></button>)}
          </nav>
        )}
        {solo.length === 0 && <p className="muted" role="status">{t('gx.filter.none')}</p>}
      </section>
      {sections.map(({ group, games }) => (
        <section key={group} aria-labelledby={`gx-group-${group}`} className="gx-group">
          <header className="gx-group__head">
            <h2 id={`gx-group-${group}`} tabIndex={-1} className="gx-group__h">{(() => { const Icon = GROUP_ICONS[group]; return <Icon className="gx-group__icon" aria-hidden="true" focusable="false" /> })()}{headingCase(t(GROUP_KEYS[group].title))}</h2>
            <p className="gx-group__body">{t(GROUP_KEYS[group].body)}</p>
          </header>
          <ul className="card-grid">
            {games.map((g) => (
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
      ))}
      <section aria-labelledby="gx-multi-h" data-tour="gx-multi">
        <h2 id="gx-multi-h">{headingCase(t('gx.multi.title'))}</h2>
        <p>{t('gx.multi.body')}</p>
        {multi.length === 0 && <p className="muted">{t('gx.multi.soon')}</p>}
      </section>
      <MoreLinks links={[{ to: '/ship/games', label: t('route.games') }, { to: '/activities-explorer', label: t('route.activitiesExplorer') }]} />
    </div>
  )
}
