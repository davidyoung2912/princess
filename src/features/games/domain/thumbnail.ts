/** A tiny picture of a shared puzzle for its chat card (docs/chat-bundles-plan.md, B11): the board's shape and where the clues are, never an answer. Pure, so it is tested in node. */
import type { SharedGame } from './share'

export interface Thumbnail { rows: number; cols: number; /** One flag per square, row by row: a clue, a given number or an island is filled; an empty square or a dark one is not. */ filled: boolean[] }

/** The most squares a thumbnail ever draws (a safety cap; the biggest board here is well below it). */
export const THUMBNAIL_MAX = 400

const grid = (rows: number, cols: number, filled: boolean[]): Thumbnail | null =>
  rows > 0 && cols > 0 && rows * cols <= THUMBNAIL_MAX && filled.length === rows * cols ? { rows, cols, filled } : null

/** The shape of the board and its clues, or null when a game has no board to draw (Cruise Wordle) or the shape is not sensible. Entries the sender made are not drawn: only the puzzle itself. */
export function gameThumbnail(s: SharedGame): Thumbnail | null {
  switch (s.game) {
    case 'sudoku': case 'diagonal-sudoku': case 'jigsaw-sudoku': case 'killer-sudoku':
      return grid(9, 9, s.puzzle.puzzle.map((c) => c !== 0))
    case 'binairo': case 'futoshiki': case 'kenken':
      return grid(s.puzzle.size, s.puzzle.size, s.puzzle.puzzle.map((c) => c !== 0))
    case 'hitori': return grid(s.puzzle.size, s.puzzle.size, s.puzzle.values.map(() => true))
    case 'crossmath': return grid(s.puzzle.rows, s.puzzle.cols, s.puzzle.kind.map((k, i) => k !== 'void' && (k !== 'num' || s.puzzle.start[i] !== 0)))
    case 'kakuro': return grid(s.puzzle.size, s.puzzle.size, s.puzzle.white.map((w) => !w))
    case 'slitherlink': return grid(s.puzzle.size, s.puzzle.size, s.puzzle.clues.map((c) => c >= 0 && c <= 3))
    case 'nurikabe': return grid(s.puzzle.rows, s.puzzle.cols, s.puzzle.clues.map((c) => c > 0))
    case 'hashi': {
      const at = new Set(s.puzzle.islands.map((i) => i.r * s.puzzle.cols + i.c))
      return grid(s.puzzle.rows, s.puzzle.cols, Array.from({ length: s.puzzle.rows * s.puzzle.cols }, (_, i) => at.has(i)))
    }
    case 'nonogram': return grid(s.puzzle.size, s.puzzle.size, Array.from({ length: s.puzzle.size ** 2 }, () => false))
    case 'word-search': return grid(s.puzzle.size, s.puzzle.size, Array.from({ length: s.puzzle.size ** 2 }, () => true))
    case 'codeword': return grid(s.puzzle.size, s.puzzle.size, s.puzzle.white.map((w) => !w))
    case 'minesweeper': return grid(s.puzzle.rows, s.puzzle.cols, Array.from({ length: s.puzzle.rows * s.puzzle.cols }, () => false))
    default: return null
  }
}
