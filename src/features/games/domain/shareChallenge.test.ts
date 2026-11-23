import { describe, expect, it } from 'vitest'
import { SKILL_LIST } from './search'
import { SETTINGS, CHALLENGE_GAMES, challengePrefs, currentChallenge, type ChallengeGame, type Setting } from './shareChallenge'
import { decodeGame, encodeGame, startOnly, type SharedGame } from './share'

const pick = (at: number) => (_name: string, values: readonly string[], fallback: string) => values[at] ?? fallback
const share = (game: ChallengeGame, at: number): SharedGame => ({ game, puzzle: currentChallenge(game, pick(at)), entries: [], notes: [] })

describe('challenges for games against the computer', () => {
  it('covers the seventeen games with a setup page', () => { expect(CHALLENGE_GAMES).toHaveLength(17) })
  it('round-trips every game with every choice', () => {
    for (const game of CHALLENGE_GAMES) for (let at = 0; at < 3; at++) {
      const s = share(game, at)
      const text = encodeGame(s, 'start')
      expect(text, game).toMatch(/^d=(easy|medium|hard);p=1\d*$/)
      expect(decodeGame(game, text), game).toEqual(s)
    }
  })
  it('names the opponent by place in the list', () => {
    expect(encodeGame(share('connect4', 2), 'start')).toBe('d=hard;p=12')
    expect(currentChallenge('nim', pick(1)).skill).toBe(SKILL_LIST[1])
  })
  it('turns into the choices the setup page remembers', () => {
    const prefs = challengePrefs(currentChallenge('breakthrough', pick(1)))
    expect(prefs).toEqual([['skill', 'captain'], ['size', 'medium'], ['handicap', 'small']])
    expect(challengePrefs(currentChallenge('backgammon', pick(2)))).toEqual([['skill', 'admiral']])
  })
  it('refuses a wrong version, length, number or opponent', () => {
    expect(decodeGame('connect4', 'd=easy;p=2' + '0')).toBeNull()
    expect(decodeGame('connect4', 'd=easy;p=1')).toBeNull()
    expect(decodeGame('connect4', 'd=easy;p=100')).toBeNull()
    expect(decodeGame('connect4', 'd=easy;p=13')).toBeNull()
    expect(decodeGame('connect4', 'd=expert;p=10')).toBeNull()
    expect(decodeGame('konane', 'd=easy;p=12')).toBeNull()
    expect(decodeGame('backgammon', 'd=easy;p=1')).not.toBeNull()
    expect(decodeGame('backgammon', 'd=easy;p=10')).toBeNull()
  })
  it('is not for a game with no setup choices to name', () => {
    expect(decodeGame('battleship', 'd=easy;p=1')).toBeNull()
  })
  it('keeps a choice list that matches what the games remember (no empty or repeated values)', () => {
    for (const game of CHALLENGE_GAMES) for (const s of SETTINGS[game] as readonly Setting[]) {
      expect(new Set(s.values).size, `${game}.${s.name}`).toBe(s.values.length)
      expect(s.values, `${game}.${s.name}`).toContain(s.fallback)
    }
  })
  it('sends the same text for the start', () => { const s = share('reversi', 1); expect(startOnly(s)).toEqual(s) })
  it('never throws on nonsense', () => {
    const alphabet = 'd=easymdiumhr;p012345,x'
    let seed = 3
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (let n = 0; n < 300; n++) {
      const text = Array.from({ length: Math.floor(random() * 30) }, () => alphabet[Math.floor(random() * alphabet.length)]).join('')
      for (const game of CHALLENGE_GAMES) expect(() => decodeGame(game, text)).not.toThrow()
    }
  })
})
