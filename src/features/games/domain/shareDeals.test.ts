import { describe, expect, it } from 'vitest'
import { DEAL_COUNT, UNSOLVABLE_DEAL } from './freecell'
import { PUZZLE_GAMES, SHAREABLE_GAMES, decodeGame, encodeGame, resultData, resultSeconds, startOnly } from './share'
import { CHALLENGE_GAMES } from './shareChallenge'
import { SEEDED_GAMES, SEED_MAX, seededPuzzle, type SeededGame } from './shareDeals'

const sample = (game: SeededGame, level: string, seed: number) => ({ game, puzzle: seededPuzzle(game, level, seed), entries: [], notes: [] })

describe('numbered deals in a chat', () => {
  it('lists every game once', () => {
    expect(new Set(SHAREABLE_GAMES).size).toBe(SHAREABLE_GAMES.length)
    expect(SHAREABLE_GAMES.length).toBe(PUZZLE_GAMES.length + SEEDED_GAMES.length + CHALLENGE_GAMES.length)
  })
  it('round-trips a deal for each game and level', () => {
    const levels: Record<SeededGame, string[]> = { freecell: ['classic', 'hard', 'expert'], klondike: ['draw1', 'draw3'], spider: ['one', 'two', 'four'], pyramid: ['easy', 'classic', 'hard'], tripeaks: ['easy', 'classic'], gaps: ['classic'], peg: ['english', 'french', 'triangle'], lights: ['easy', 'medium', 'hard'], slide: ['easy', 'classic', 'hard'], mastermind: ['easy', 'classic', 'hard'] }
    for (const game of SEEDED_GAMES) for (const level of levels[game]) {
      const seed = game === 'peg' ? 0 : 4242
      const text = encodeGame(sample(game, level, seed), 'start')
      expect(text).toMatch(/^d=(easy|medium|hard);p=\d+$/)
      expect(decodeGame(game, text)).toEqual(sample(game, level, seed))
    }
  })
  it('sends only the start, even when the board so far is asked for', () => {
    const s = sample('klondike', 'draw3', 77)
    expect(encodeGame(s, 'current', true)).toBe(encodeGame(s, 'start'))
    expect(startOnly(s)).toEqual(s)
  })
  it('refuses a level the game does not have, or a number out of range', () => {
    expect(decodeGame('klondike', 'd=hard;p=5')).toBeNull()
    expect(decodeGame('gaps', 'd=medium;p=5')).toBeNull()
    expect(decodeGame('tripeaks', 'd=expert;p=5')).toBeNull()
    expect(decodeGame('spider', 'd=easy;p=0')).toBeNull()
    expect(decodeGame('spider', `d=easy;p=${SEED_MAX + 1}`)).toBeNull()
    expect(decodeGame('spider', 'd=easy;p=12a')).toBeNull()
    expect(decodeGame('freecell', `d=easy;p=${DEAL_COUNT + 1}`)).toBeNull()
    expect(decodeGame('freecell', `d=easy;p=${UNSOLVABLE_DEAL}`)).toBeNull()
    expect(decodeGame('freecell', `d=easy;p=${UNSOLVABLE_DEAL + 1}`)).not.toBeNull()
    expect(decodeGame('peg', 'd=easy;p=3')).toBeNull()
    expect(decodeGame('lights', 'p=3')).toBeNull()
    expect(decodeGame('lights', 'd=easy')).toBeNull()
  })
  it('carries a result time after the deal', () => {
    const s = sample('pyramid', 'classic', 31337)
    expect(resultSeconds(resultData(s, 95))).toBe(95)
    expect(decodeGame('pyramid', resultData(s, 95))).toEqual(s)
  })
  it('never throws on nonsense', () => {
    const alphabet = 'd=easy;p0123456789,x'
    let seed = 7
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (let n = 0; n < 300; n++) {
      const text = Array.from({ length: Math.floor(random() * 40) }, () => alphabet[Math.floor(random() * alphabet.length)]).join('')
      for (const game of SEEDED_GAMES) expect(() => decodeGame(game, text)).not.toThrow()
    }
  })
})
