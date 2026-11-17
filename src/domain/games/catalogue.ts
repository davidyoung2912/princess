import type { StringKey } from '../../i18n'

/** One game on the Games Explorer. Each game has a page of its own at `path`, and the explorer lists it under single player or multi-player. */
export interface GameEntry {
  id: string
  path: string
  mode: 'single' | 'multi'
  titleKey: StringKey
  bodyKey: StringKey
}

export const GAMES: readonly GameEntry[] = [
  { id: 'cruise-wordle', path: '/games-explorer/cruise-wordle', mode: 'single', titleKey: 'gx.game.wordle.title', bodyKey: 'gx.game.wordle.body' },
  { id: 'sudoku', path: '/games-explorer/sudoku', mode: 'single', titleKey: 'gx.game.sudoku.title', bodyKey: 'gx.game.sudoku.body' },
  { id: 'diagonal-sudoku', path: '/games-explorer/diagonal-sudoku', mode: 'single', titleKey: 'gx.game.diagonal.title', bodyKey: 'gx.game.diagonal.body' },
  { id: 'jigsaw-sudoku', path: '/games-explorer/jigsaw-sudoku', mode: 'single', titleKey: 'gx.game.jigsaw.title', bodyKey: 'gx.game.jigsaw.body' },
  { id: 'killer-sudoku', path: '/games-explorer/killer-sudoku', mode: 'single', titleKey: 'gx.game.killer.title', bodyKey: 'gx.game.killer.body' },
]

export const gamesOf = (mode: GameEntry['mode']): GameEntry[] => GAMES.filter((g) => g.mode === mode)
