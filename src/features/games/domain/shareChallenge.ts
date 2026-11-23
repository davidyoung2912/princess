/**
 * Games in a chat, phase B13: a challenge for the games played against the computer. There is no puzzle to send, only the settings: the opponent and each choice the game's setup page offers.
 * The text is `d=<easy|medium|hard>;p=1<digits>`: `d` is the opponent (Cadet, Captain, Admiral), `p` is a version digit (1) and then one digit a setting, the place of the choice in the game's own list,
 * in the order of `SETTINGS`. Accepting writes them as the receiver's remembered choices (the same ones the setup page reads), so no screen needs to know about challenges. Framework-free; `decode` is total.
 * Who moves first is left to the receiver. Dice and the computer's moves are not seeded, so a challenge is "the same settings", never "the same game".
 */
import { HANDICAPS } from './handicap'
import { SKILL_LIST } from './search'
import { SIZE_IDS as HEX } from './hex'
import { SIZE_IDS as DOTS } from './dots'
import { SIZE_IDS as KALAH } from './kalah'
import { TARGET_IDS as PIG } from './pig'
import { SIZE_IDS as BOX } from './shutbox'
import { SIZE_IDS as BREAK } from './breakthrough'
import { SIZE_IDS as KONANE } from './konane'
import { SIZE_IDS as NIM, RULES as NIM_RULES } from './nim'

export interface Setting { name: string; values: readonly string[]; fallback: string }

const handicap: Setting = { name: 'handicap', values: HANDICAPS, fallback: 'none' }
const length: Setting = { name: 'length', values: ['full', 'quick'], fallback: 'full' }

/** The choices after the opponent, by game (the catalogue id, which is also the key the setup page remembers them under). */
export const SETTINGS = {
  reversi: [handicap],
  gomoku: [handicap, length],
  pente: [handicap, length],
  hex: [{ name: 'size', values: HEX, fallback: 'small' }, handicap],
  morris: [length],
  dots: [{ name: 'size', values: DOTS, fallback: 'small' }],
  hunt: [{ name: 'mode', values: ['fox', 'brandubh'], fallback: 'fox' }],
  kalah: [{ name: 'size', values: KALAH, fallback: 'classic' }],
  backgammon: [],
  checkers: [handicap, length],
  pig: [{ name: 'target', values: PIG, fallback: 'classic' }],
  yacht: [length],
  shutbox: [{ name: 'size', values: BOX, fallback: 'nine' }],
  connect4: [handicap],
  breakthrough: [{ name: 'size', values: BREAK, fallback: 'small' }, handicap],
  konane: [{ name: 'size', values: KONANE, fallback: 'six' }],
  nim: [{ name: 'size', values: NIM, fallback: 'four' }, { name: 'rule', values: NIM_RULES, fallback: 'normal' }],
} as const satisfies Record<string, readonly Setting[]>

export const CHALLENGE_GAMES = Object.keys(SETTINGS) as ChallengeGame[]
export type ChallengeGame = keyof typeof SETTINGS
export const isChallengeGame = (id: string): id is ChallengeGame => Object.hasOwn(SETTINGS, id)

const WORDS = ['easy', 'medium', 'hard'] as const

/** An opponent and the other choices by name (every one the game has). */
export interface Challenge { difficulty: (typeof WORDS)[number]; skill: string; settings: Record<string, string> }

/** The challenge a setup page now shows; `read` gives the remembered value of a choice (or its fallback). */
export function currentChallenge(game: ChallengeGame, read: (name: string, values: readonly string[], fallback: string) => string): Challenge {
  const skill = read('skill', SKILL_LIST, 'captain')
  const settings: Record<string, string> = {}
  for (const s of SETTINGS[game] as readonly Setting[]) settings[s.name] = read(s.name, s.values, s.fallback)
  return { difficulty: WORDS[Math.max(0, SKILL_LIST.indexOf(skill as never))], skill, settings }
}

export function encodeChallenge(game: ChallengeGame, c: Challenge): string {
  const digits = (SETTINGS[game] as readonly Setting[]).map((s) => Math.max(0, s.values.indexOf(c.settings[s.name]))).join('')
  return `d=${c.difficulty};p=1${digits}`
}

/** The challenge in some pairs, or null when the opponent, the version or any choice is not one the game has. */
export function decodeChallenge(game: ChallengeGame, m: Map<string, string>): Challenge | null {
  const at = WORDS.indexOf(m.get('d') as (typeof WORDS)[number])
  const p = m.get('p')
  const list = SETTINGS[game] as readonly Setting[]
  if (at < 0 || p === undefined || p.length !== list.length + 1 || p[0] !== '1' || !/^\d+$/.test(p)) return null
  const settings: Record<string, string> = {}
  for (let i = 0; i < list.length; i++) {
    const v = list[i].values[Number(p[i + 1])]
    if (v === undefined) return null
    settings[list[i].name] = v
  }
  return { difficulty: WORDS[at], skill: SKILL_LIST[at], settings }
}

/** The remembered choices a challenge sets, as `[name, value]` pairs for `writePref`: the opponent first. */
export const challengePrefs = (c: Challenge): [string, string][] => [['skill', c.skill], ...Object.entries(c.settings)]
