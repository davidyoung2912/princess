import type { StringKey } from '../../../shared/i18n'

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
  /** Words for the levels when they are not Easy to Expert (a game with board sizes, say). */
  levelsKey?: StringKey
  /** True for a game with no puzzle to send to a chat (a match against the computer, say), so it has no bundle adapter. */
  noShare?: boolean
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
  { id: 'hitori', path: '/games-explorer/hitori', mode: 'single', titleKey: 'gx.game.hitori.title', bodyKey: 'gx.game.hitori.body', levels: 4, minutes: [3, 25], players: 1 },
  { id: 'word-search', path: '/games-explorer/word-search', mode: 'single', titleKey: 'gx.game.wordsearch.title', bodyKey: 'gx.game.wordsearch.body', levels: 4, minutes: [4, 20], players: 1 },
  { id: 'slitherlink', path: '/games-explorer/slitherlink', mode: 'single', titleKey: 'gx.game.slitherlink.title', bodyKey: 'gx.game.slitherlink.body', levels: 4, minutes: [5, 30], players: 1 },
  { id: 'crossmath', path: '/games-explorer/crossmath', mode: 'single', titleKey: 'gx.game.crossmath.title', bodyKey: 'gx.game.crossmath.body', levels: 4, minutes: [3, 20], players: 1 },
  { id: 'nonogram', path: '/games-explorer/nonogram', mode: 'single', titleKey: 'gx.game.nonogram.title', bodyKey: 'gx.game.nonogram.body', levels: 4, minutes: [2, 25], players: 1 },
  { id: 'minesweeper', path: '/games-explorer/minesweeper', mode: 'single', titleKey: 'gx.game.minesweeper.title', bodyKey: 'gx.game.minesweeper.body', levels: 4, minutes: [2, 20], players: 1 },
  { id: 'hashi', path: '/games-explorer/hashi', mode: 'single', titleKey: 'gx.game.hashi.title', bodyKey: 'gx.game.hashi.body', levels: 4, minutes: [3, 25], players: 1 },
  { id: 'nurikabe', path: '/games-explorer/nurikabe', mode: 'single', titleKey: 'gx.game.nurikabe.title', bodyKey: 'gx.game.nurikabe.body', levels: 4, minutes: [3, 25], players: 1 },
  { id: 'battleship', path: '/games-explorer/battleship', mode: 'single', titleKey: 'gx.game.battleship.title', bodyKey: 'gx.game.battleship.body', levels: 3, minutes: [5, 20], players: 1, levelsKey: 'gx.meta.battleship', noShare: true },
  { id: 'klondike', path: '/games-explorer/klondike', mode: 'single', titleKey: 'gx.game.klondike.title', bodyKey: 'gx.game.klondike.body', levels: 2, minutes: [5, 30], players: 1, levelsKey: 'gx.meta.klondike', noShare: true },
  { id: 'spider', path: '/games-explorer/spider', mode: 'single', titleKey: 'gx.game.spider.title', bodyKey: 'gx.game.spider.body', levels: 3, minutes: [10, 45], players: 1, levelsKey: 'gx.meta.spider', noShare: true },
  { id: 'freecell', path: '/games-explorer/freecell', mode: 'single', titleKey: 'gx.game.freecell.title', bodyKey: 'gx.game.freecell.body', levels: 3, minutes: [5, 25], players: 1, levelsKey: 'gx.meta.freecell', noShare: true },
  { id: 'pyramid', path: '/games-explorer/pyramid', mode: 'single', titleKey: 'gx.game.pyramid.title', bodyKey: 'gx.game.pyramid.body', levels: 3, minutes: [3, 15], players: 1, levelsKey: 'gx.meta.pyramid', noShare: true },
]

export const gamesOf = (mode: GameEntry['mode']): GameEntry[] => GAMES.filter((g) => g.mode === mode)
