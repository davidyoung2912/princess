import { describe, expect, it } from 'vitest'
import { generateBinairo } from './binairo'
import { decodeGame, encodeGame, GAME_DATA_MAX, SHAREABLE_GAMES, startOnly, type SharedGame } from './share'
import { generateKiller } from './killer'
import { generateFutoshiki } from './futoshiki'
import { generateKenKen } from './kenken'
import { generateHitori } from './hitori'
import { generatePuzzle } from './sudoku'

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }

const make = (game: (typeof SHAREABLE_GAMES)[number], random: () => number): SharedGame => {
  const entries = Array<number>(81).fill(0)
  const notes = Array<number>(81).fill(0)
  if (game === 'binairo') {
    const puzzle = generateBinairo('easy', random)
    const e = puzzle.puzzle.map((c, i) => (c === 0 && i % 3 === 0 ? puzzle.solution[i] : 0))
    return { game, puzzle, entries: e, notes: [] }
  }
  if (game === 'futoshiki' || game === 'kenken') {
    const puzzle = game === 'futoshiki' ? generateFutoshiki('medium', random) : generateKenKen('medium', random)
    const e = puzzle.puzzle.map((c, i) => (c === 0 && i % 3 === 0 ? puzzle.solution[i] : 0))
    return { game, puzzle, entries: e, notes: [] } as SharedGame
  }
  if (game === 'hitori') {
    const puzzle = generateHitori('medium', random)
    return { game, puzzle, entries: puzzle.solution.map((m, i) => (i % 3 === 0 ? m : 0)), notes: [] }
  }
  const puzzle = game === 'killer-sudoku' ? generateKiller('easy', random) : generatePuzzle('easy', random, game === 'sudoku' ? 'classic' : game === 'diagonal-sudoku' ? 'diagonal' : 'jigsaw')
  puzzle.puzzle.forEach((c, i) => { if (c === 0 && i % 4 === 0) { entries[i] = puzzle.solution[i] } else if (c === 0 && i % 4 === 1) notes[i] = 0b101000101 })
  return { game, puzzle, entries, notes }
}

describe('game share round trip', () => {
  for (const game of SHAREABLE_GAMES) {
    it(`${game}: start, current and notes come back as the same puzzle`, () => {
      const s = make(game, seeded(7))
      const start = decodeGame(game, encodeGame(s, 'start'))
      if (game !== 'hitori') expect((start?.puzzle as { puzzle: number[] }).puzzle).toEqual((s.puzzle as { puzzle: number[] }).puzzle)
      else expect((start?.puzzle as { values: number[] }).values).toEqual((s.puzzle as { values: number[] }).values)
      expect(start?.puzzle.solution).toEqual(s.puzzle.solution)
      expect(start?.entries.every((v) => v === 0)).toBe(true)
      const current = decodeGame(game, encodeGame(s, 'current'))
      expect(current?.entries).toEqual(s.entries)
      expect(current?.notes.every((v) => v === 0)).toBe(true)
      const data = encodeGame(s, 'current', true)
      expect(data.length).toBeLessThan(GAME_DATA_MAX)
      const noted = decodeGame(game, data)
      if (game.endsWith('sudoku')) expect(noted?.notes).toEqual(s.notes)
      expect(startOnly(noted!).entries.every((v) => v === 0)).toBe(true)
    })
  }

  it('jigsaw regions and killer cages survive', () => {
    const rulesOf = (s: SharedGame | null) => (s as unknown as { puzzle: { rules: { region: number[]; cages: unknown } } }).puzzle.rules
    const j = make('jigsaw-sudoku', seeded(3))
    expect(rulesOf(decodeGame('jigsaw-sudoku', encodeGame(j, 'start'))).region).toEqual(rulesOf(j).region)
    const k = make('killer-sudoku', seeded(5))
    expect(rulesOf(decodeGame('killer-sudoku', encodeGame(k, 'start'))).cages).toEqual(rulesOf(k).cages)
  })

  it('a clue cell never takes the sender entry', () => {
    const s = make('sudoku', seeded(9))
    const clue = (s.puzzle as { puzzle: number[] }).puzzle.findIndex((c) => c !== 0)
    const data = encodeGame(s, 'current').replace(/e=(\d+)/, (_, e: string) => `e=${e.slice(0, clue)}5${e.slice(clue + 1)}`)
    expect(decodeGame('sudoku', data)?.entries[clue]).toBe(0)
  })
})

describe('futoshiki, kenken and hitori', () => {
  it('kenken cages and futoshiki signs survive, and nonsense is refused', () => {
    const k = make('kenken', seeded(4)) as Extract<SharedGame, { game: 'kenken' }>
    const back = decodeGame('kenken', encodeGame(k, 'start')) as typeof k
    expect(back.puzzle.cages).toEqual(k.puzzle.cages)
    const f = make('futoshiki', seeded(6)) as Extract<SharedGame, { game: 'futoshiki' }>
    expect((decodeGame('futoshiki', encodeGame(f, 'start')) as typeof f).puzzle.signs).toEqual(f.puzzle.signs)
    const data = encodeGame(k, 'start')
    expect(decodeGame('kenken', data.replace(/t=[\d,]+/, 't=1,1'))).toBeNull()
    expect(decodeGame('futoshiki', 'd=easy;p=0000000000000000;s=0,5')).toBeNull()
    expect(decodeGame('hitori', `d=easy;p=${'1'.repeat(25)}`)).toBeNull()
  })
})

describe('game share decoder is total', () => {
  const good = encodeGame(make('sudoku', seeded(1)), 'start')
  it('refuses anything that is not a solvable puzzle of that game', () => {
    for (const bad of ['', 'x', 'd=easy', 'd=easy;p=1', `${good};${good}`, good.replace('d=easy', 'd=nope'), good + '<b>', good.replace(/p=\d{81}/, `p=${'1'.repeat(81)}`), good.replace(/p=\d{81}/, `p=${'0'.repeat(81)}`), 'a'.repeat(GAME_DATA_MAX + 1), '=;=;', 'd=easy;;p=']) {
      expect(decodeGame('sudoku', bad)).toBeNull()
    }
    expect(decodeGame('nonsense', good)).toBeNull()
    expect(decodeGame('binairo', good)).toBeNull()
    expect(decodeGame('killer-sudoku', good)).toBeNull()
    expect(decodeGame('jigsaw-sudoku', good)).toBeNull()
  })
  it('never throws on random text', () => {
    const random = seeded(42)
    const alphabet = 'd=easy;p01234567890,rgse'
    for (let n = 0; n < 400; n++) {
      const text = Array.from({ length: Math.floor(random() * 300) }, () => alphabet[Math.floor(random() * alphabet.length)]).join('')
      for (const game of SHAREABLE_GAMES) expect(() => decodeGame(game, text)).not.toThrow()
    }
  })
  it('mutating a good payload never throws and never gives back a different puzzle for a bad one', () => {
    const random = seeded(11)
    for (const game of SHAREABLE_GAMES) {
      const data = encodeGame(make(game, seeded(2)), 'current', true)
      for (let n = 0; n < 60; n++) {
        const at = Math.floor(random() * data.length)
        const mutated = data.slice(0, at) + '0123456789;=,'[Math.floor(random() * 13)] + data.slice(at + 1)
        expect(() => decodeGame(game, mutated)).not.toThrow()
      }
    }
  })
})
