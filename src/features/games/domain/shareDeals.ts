/**
 * Games in a chat, phase B12: the games whose puzzle is a numbered deal (the card games, Lights Out, Slide, Mastermind) or a fixed board (Peg).
 * The text is two pairs, `d=<easy|medium|hard>;p=<number>`: `d` is the place of the level in the game's own list (so the server's words read the same as for every game) and `p` is the deal number
 * the game's own generator turns into a puzzle with `seededRng`. The answer is never in it. Only the start can be sent (and a result), not the board so far. Framework-free; `decode` is total.
 * A deal number replays the same puzzle only while the generator is unchanged; the screens and the decoder share one generator, so a sender and receiver on one version agree.
 */
import type { Difficulty } from './sudoku'
import { DEAL_COUNT, FREECELL_LEVELS, UNSOLVABLE_DEAL } from './freecell'
import { KLONDIKE_LEVELS } from './klondike'
import { SPIDER_LEVELS } from './spider'
import { PYRAMID_LEVELS } from './pyramid'
import { TRI_LEVELS } from './tripeaks'
import { PEG_BOARDS } from './peg'
import { LIGHTS_LEVELS } from './lights'
import { SLIDE_LEVELS } from './slide'
import { SIZE_IDS } from './mastermind'

export const SEEDED_GAMES = ['freecell', 'klondike', 'spider', 'pyramid', 'tripeaks', 'gaps', 'peg', 'lights', 'slide', 'mastermind'] as const
export type SeededGame = (typeof SEEDED_GAMES)[number]
export const isSeededGame = (id: string): id is SeededGame => (SEEDED_GAMES as readonly string[]).includes(id)

/** The most a deal number may be (mirrors the card games' own range). */
export const SEED_MAX = 999_999

/** A level or board id a game offers, in its own order: the first three become easy, medium and hard. */
const LEVELS: Record<SeededGame, readonly string[]> = {
  freecell: FREECELL_LEVELS, klondike: KLONDIKE_LEVELS, spider: SPIDER_LEVELS, pyramid: PYRAMID_LEVELS, tripeaks: TRI_LEVELS,
  gaps: ['classic'], peg: PEG_BOARDS, lights: LIGHTS_LEVELS, slide: SLIDE_LEVELS, mastermind: SIZE_IDS,
}
const WORDS: readonly Difficulty[] = ['easy', 'medium', 'hard']

/** A numbered deal: the level id in the game's own words, and the deal number (0 for Peg, whose board is fixed). */
export interface SeededPuzzle { difficulty: Difficulty; level: string; seed: number }

export const seededPuzzle = (game: SeededGame, level: string, seed: number): SeededPuzzle => ({ difficulty: WORDS[Math.max(0, LEVELS[game].indexOf(level))], level, seed })

const seedOk = (game: SeededGame, n: number): boolean =>
  game === 'peg' ? n === 0 : game === 'freecell' ? n >= 1 && n <= DEAL_COUNT && n !== UNSOLVABLE_DEAL : n >= 1 && n <= SEED_MAX

/** The text for a deal. */
export const encodeSeeded = (p: SeededPuzzle): string => `d=${p.difficulty};p=${p.seed}`

/** The deal in some pairs, or null when the level or the number is not one the game has. */
export function decodeSeeded(game: SeededGame, m: Map<string, string>): SeededPuzzle | null {
  const d = m.get('d')
  const p = m.get('p')
  const at = WORDS.indexOf(d as Difficulty)
  if (at < 0 || at >= LEVELS[game].length || p === undefined || !/^\d{1,6}$/.test(p)) return null
  const seed = Number(p)
  return seedOk(game, seed) ? seededPuzzle(game, LEVELS[game][at], seed) : null
}
