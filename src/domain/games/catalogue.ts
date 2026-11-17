import type { StringKey } from '../../i18n'

/** One game on the Games Explorer. Each game has a page of its own at `path`, and the explorer lists it under single player or multi-player. */
export interface GameEntry {
  id: string
  path: string
  mode: 'single' | 'multi'
  titleKey: StringKey
  bodyKey: StringKey
  /** How many levels the game has (1 when it has none to pick). */
  levels: number
  /** A rough time for one game, in minutes. */
  minutes: readonly [number, number]
  /** How many people play at once. */
  players: number
}

export const GAMES: readonly GameEntry[] = [
  { id: 'cruise-wordle', path: '/games-explorer/cruise-wordle', mode: 'single', titleKey: 'gx.game.wordle.title', bodyKey: 'gx.game.wordle.body', levels: 1, minutes: [1, 3], players: 1 },
  { id: 'sudoku', path: '/games-explorer/sudoku', mode: 'single', titleKey: 'gx.game.sudoku.title', bodyKey: 'gx.game.sudoku.body', levels: 4, minutes: [5, 25], players: 1 },
  { id: 'diagonal-sudoku', path: '/games-explorer/diagonal-sudoku', mode: 'single', titleKey: 'gx.game.diagonal.title', bodyKey: 'gx.game.diagonal.body', levels: 4, minutes: [8, 30], players: 1 },
  { id: 'jigsaw-sudoku', path: '/games-explorer/jigsaw-sudoku', mode: 'single', titleKey: 'gx.game.jigsaw.title', bodyKey: 'gx.game.jigsaw.body', levels: 4, minutes: [8, 30], players: 1 },
  { id: 'killer-sudoku', path: '/games-explorer/killer-sudoku', mode: 'single', titleKey: 'gx.game.killer.title', bodyKey: 'gx.game.killer.body', levels: 4, minutes: [10, 35], players: 1 },
  { id: 'binairo', path: '/games-explorer/binairo', mode: 'single', titleKey: 'gx.game.binairo.title', bodyKey: 'gx.game.binairo.body', levels: 4, minutes: [3, 20], players: 1 },
  { id: 'futoshiki', path: '/games-explorer/futoshiki', mode: 'single', titleKey: 'gx.game.futoshiki.title', bodyKey: 'gx.game.futoshiki.body', levels: 4, minutes: [3, 20], players: 1 },
  { id: 'kakuro', path: '/games-explorer/kakuro', mode: 'single', titleKey: 'gx.game.kakuro.title', bodyKey: 'gx.game.kakuro.body', levels: 4, minutes: [8, 35], players: 1 },
  { id: 'codeword', path: '/games-explorer/codeword', mode: 'single', titleKey: 'gx.game.codeword.title', bodyKey: 'gx.game.codeword.body', levels: 4, minutes: [10, 40], players: 1 },
  { id: 'kenken', path: '/games-explorer/kenken', mode: 'single', titleKey: 'gx.game.kenken.title', bodyKey: 'gx.game.kenken.body', levels: 4, minutes: [3, 25], players: 1 },
]

export const gamesOf = (mode: GameEntry['mode']): GameEntry[] => GAMES.filter((g) => g.mode === mode)
