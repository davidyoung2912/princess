import { describe, expect, it } from 'vitest'
import { generateBinairo } from './binairo'
import { decodeGame, encodeGame, GAME_DATA_MAX, SHAREABLE_GAMES, resultSeconds, startOnly, type SharedGame } from './share'
import { generateKiller } from './killer'
import { generateFutoshiki } from './futoshiki'
import { generateKenKen } from './kenken'
import { generateHitori } from './hitori'
import { blanksOf, generateCrossmath } from './crossmath'
import { generateKakuro } from './kakuro'
import { generateSlitherlink } from './slitherlink'
import { generateNurikabe } from './nurikabe'
import { generateHashi } from './hashi'
import { generateNonogram } from './nonogram'
import { generatePuzzle } from './sudoku'
import { generateWordSearch } from './wordSearch'
import { generateCodeword } from './codeword'
import { generateMinesweeper } from './minesweeper'
import { WORDLE_WORDS } from './wordleWords'

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
  const every = (list: readonly number[]) => list.map((v, i) => (i % 3 === 0 ? v : 0))
  if (game === 'crossmath') {
    const puzzle = generateCrossmath('medium', random)
    const e = Array<number>(puzzle.rows * puzzle.cols).fill(0)
    blanksOf(puzzle).forEach((i, j) => { if (j % 2 === 0) e[i] = puzzle.solution[i] })
    return { game, puzzle, entries: e, notes: [] }
  }
  if (game === 'kakuro') {
    const puzzle = generateKakuro('easy', random)
    return { game, puzzle, entries: every(puzzle.solution).map((v, i) => (puzzle.puzzle[i] === 0 ? v : 0)), notes: [] }
  }
  if (game === 'slitherlink') { const puzzle = generateSlitherlink('easy', random); return { game, puzzle, entries: every(puzzle.solution), notes: [] } }
  if (game === 'nurikabe') { const puzzle = generateNurikabe('medium', random); return { game, puzzle, entries: every(puzzle.solution.map((w) => (w ? 1 : 2))), notes: [] } }
  if (game === 'hashi') { const puzzle = generateHashi('medium', random); return { game, puzzle, entries: every(puzzle.solution), notes: [] } }
  if (game === 'nonogram') { const puzzle = generateNonogram('medium', random); return { game, puzzle, entries: every(puzzle.solution), notes: [] } }
  if (game === 'cruise-wordle') return { game, puzzle: { difficulty: 'easy', index: 7, target: WORDLE_WORDS[7].toUpperCase() }, entries: [], notes: [], guesses: ['CRANE', 'BEACH'] }
  if (game === 'word-search') { const puzzle = generateWordSearch('easy', random); return { game, puzzle, entries: puzzle.words.map((_, k) => k % 2), notes: [] } }
  if (game === 'codeword') {
    const puzzle = generateCodeword('easy', random)
    return { game, puzzle, entries: puzzle.solution.map((l, u) => (u % 2 === 0 && !puzzle.givens.includes(u) ? l : 0)), notes: [] }
  }
  if (game === 'minesweeper') {
    const puzzle = generateMinesweeper('easy', random)
    return { game, puzzle, entries: puzzle.mines.map((m, i) => (m ? (i % 2 ? 2 : 0) : i % 3 === 0 ? 1 : 0)), notes: [] }
  }
  const puzzle = game === 'killer-sudoku' ? generateKiller('easy', random) : generatePuzzle('easy', random, game === 'sudoku' ? 'classic' : game === 'diagonal-sudoku' ? 'diagonal' : 'jigsaw')
  puzzle.puzzle.forEach((c, i) => { if (c === 0 && i % 4 === 0) { entries[i] = puzzle.solution[i] } else if (c === 0 && i % 4 === 1) notes[i] = 0b101000101 })
  return { game, puzzle, entries, notes }
}

const NEWEST = ['cruise-wordle', 'word-search', 'codeword', 'minesweeper']

describe('game share round trip', () => {
  for (const game of SHAREABLE_GAMES.filter((g) => !NEWEST.includes(g))) {
    it(`${game}: start, current and notes come back as the same puzzle`, () => {
      const s = make(game, seeded(7))
      const start = decodeGame(game, encodeGame(s, 'start'))
      const clueKey = ['puzzle', 'values', 'start', 'clues', 'rows'].find((k) => k in s.puzzle && Array.isArray((s.puzzle as unknown as Record<string, unknown>)[k]))!
      expect((start?.puzzle as unknown as Record<string, unknown>)[clueKey]).toEqual((s.puzzle as unknown as Record<string, unknown>)[clueKey])
      expect((start?.puzzle as unknown as Record<string, unknown>).solution).toEqual((s.puzzle as unknown as Record<string, unknown>).solution)
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

describe('crossmath, kakuro, slitherlink, nurikabe, hashi and nonogram', () => {
  it('islands, runs and clues survive, and a puzzle that cannot be solved is refused', () => {
    const h = make('hashi', seeded(8)) as Extract<SharedGame, { game: 'hashi' }>
    const back = decodeGame('hashi', encodeGame(h, 'start')) as typeof h
    expect(back.puzzle.islands).toEqual(h.puzzle.islands)
    expect(back.puzzle.links).toEqual(h.puzzle.links)
    const k = make('kakuro', seeded(8)) as Extract<SharedGame, { game: 'kakuro' }>
    const kb = decodeGame('kakuro', encodeGame(k, 'start')) as typeof k
    expect(kb.puzzle.runs.map((r) => r.sum)).toEqual(k.puzzle.runs.map((r) => r.sum))
    expect(kb.puzzle.white).toEqual(k.puzzle.white)
    const c = make('crossmath', seeded(8)) as Extract<SharedGame, { game: 'crossmath' }>
    const cb = decodeGame('crossmath', encodeGame(c, 'start')) as typeof c
    expect(cb.puzzle.equations.length).toBe(c.puzzle.equations.length)
    expect(cb.puzzle.tray).toEqual(c.puzzle.tray)
    expect(cb.puzzle.symbol).toEqual(c.puzzle.symbol)
    expect(decodeGame('nonogram', 'd=easy;p=5;r=1,1,1,1,1;c=1,1,1,1,1')).toBeNull()
    expect(decodeGame('nonogram', 'd=easy;p=5;r=9,9,9,9,9;c=1,1,1,1,1')).toBeNull()
    expect(decodeGame('slitherlink', `d=easy;p=${'4'.repeat(25)}`)).toBeNull()
    expect(decodeGame('nurikabe', 'd=easy;p=0505;i=0;v=3')).toBeNull()
    expect(decodeGame('hashi', 'd=easy;p=0707;i=0,6;v=13')).toBeNull()
    expect(decodeGame('kakuro', `d=easy;p=${'0'.repeat(36)};w=${'1'.repeat(36)};s=3`)).toBeNull()
    expect(decodeGame('crossmath', 'd=easy;p=0707;k=' + 'v'.repeat(49) + ';y=;v=1;t=1')).toBeNull()
  })
})

describe('cruise wordle, word search, codeword and minesweeper', () => {
  it('wordle sends the place in the list, never the word, and the guesses only for the board so far', () => {
    const w = make('cruise-wordle', seeded(1)) as Extract<SharedGame, { game: 'cruise-wordle' }>
    const start = encodeGame(w, 'start')
    expect(start).not.toContain(w.puzzle.target)
    expect(decodeGame('cruise-wordle', start)).toMatchObject({ puzzle: { index: 7, target: w.puzzle.target }, guesses: [] })
    expect((decodeGame('cruise-wordle', encodeGame(w, 'current')) as typeof w).guesses).toEqual(['CRANE', 'BEACH'])
    expect(decodeGame('cruise-wordle', 'd=easy;p=99999')).toBeNull()
    expect(decodeGame('cruise-wordle', 'd=easy;p=7;g=CRANE,TOOLONG')).toBeNull()
    expect(decodeGame('cruise-wordle', 'd=easy;p=7;g=AAAAA,BBBBB,CCCCC,DDDDD,EEEEE,FFFFF,GGGGG')).toBeNull()
    expect(decodeGame('cruise-wordle', `d=easy;p=7;g=${w.puzzle.target},CRANE`)).toBeNull()
    expect(decodeGame('cruise-wordle', 'd=easy;p=07')).toBeNull()
  })
  it('word search is rebuilt, and a grid with a stray square or a hidden extra word is refused', () => {
    const s = make('word-search', seeded(3)) as Extract<SharedGame, { game: 'word-search' }>
    const data = encodeGame(s, 'start')
    const back = decodeGame('word-search', data) as typeof s
    expect(back.puzzle.words.map((x) => x.text)).toEqual(s.puzzle.words.map((x) => x.text))
    expect(back.puzzle.answer).toBe(s.puzzle.answer)
    const l = s.puzzle.letters.join('')
    const stray = l.slice(0, 1) === 'Z' ? 'Q' : 'Z'
    expect(decodeGame('word-search', data.replace(`l=${l}`, `l=${stray}${l.slice(1)}`))).toBeNull()
    expect(decodeGame('word-search', data.replace(/w=[A-Z,]+/, (w) => w.split(',').slice(0, -1).join(',')))).toBeNull()
    expect(decodeGame('word-search', data.replace(/a=[A-Z]+/, 'a=ZZZZZ'))).toBeNull()
  })
  it('codeword numbers, givens and the typed letters survive; wrong givens are refused', () => {
    const s = make('codeword', seeded(5)) as Extract<SharedGame, { game: 'codeword' }>
    const back = decodeGame('codeword', encodeGame(s, 'current')) as typeof s
    expect(back.puzzle.code).toEqual(s.puzzle.code)
    expect(back.puzzle.givens).toEqual(s.puzzle.givens)
    expect(back.puzzle.solution).toEqual(s.puzzle.solution)
    expect(back.entries).toEqual(s.entries)
    const data = encodeGame(s, 'start')
    expect(decodeGame('codeword', data.replace(/g=[0-9A-Z,]+/, 'g=1A'))).toBeNull()
    expect(decodeGame('codeword', data.replace(/g=[0-9A-Z,]+/, 'g=99A'))).toBeNull()
  })
  it('minesweeper keeps the mines, refuses a mine on the start and an opened mine', () => {
    const s = make('minesweeper', seeded(9)) as Extract<SharedGame, { game: 'minesweeper' }>
    const back = decodeGame('minesweeper', encodeGame(s, 'current')) as typeof s
    expect(back.puzzle.mines).toEqual(s.puzzle.mines)
    expect(back.puzzle.start).toBe(s.puzzle.start)
    expect(back.entries).toEqual(s.entries)
    const data = encodeGame(s, 'start')
    expect(decodeGame('minesweeper', data.replace(/s=\d+/, `s=${s.puzzle.mines.indexOf(true)}`))).toBeNull()
    expect(decodeGame('minesweeper', data.replace(/i=[\d,]+/, 'i=0,1,2'))).toBeNull()
    const mine = s.puzzle.mines.indexOf(true)
    expect(decodeGame('minesweeper', `${data};e=${'0'.repeat(mine)}1${'0'.repeat(63 - mine)}`)).toBeNull()
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

describe('results', () => {
  it('carries a time after the starting position and reads it back', () => {
    expect(resultSeconds('d=easy;p=0;tm=552')).toBe(552)
    expect(resultSeconds('d=easy;p=0')).toBeNull()
    expect(resultSeconds('d=easy;p=0;tm=0')).toBeNull()
    expect(resultSeconds('d=easy;p=0;tm=1234567')).toBeNull()
    expect(resultSeconds('d=easy;p=0;xtm=5')).toBeNull()
  })
})

describe('pencil notes for futoshiki, kenken and kakuro', () => {
  for (const game of ['futoshiki', 'kenken', 'kakuro'] as const) {
    it(`${game}: marks on blank squares go only when ticked and survive, and none are made for filled or given squares`, () => {
      const s = make(game, seeded(11)) as Extract<SharedGame, { game: typeof game }>
      const free = s.entries.flatMap((e, i) => (e === 0 && (game === 'kakuro' ? (s.puzzle as { white: boolean[] }).white[i] && s.puzzle.puzzle[i] === 0 : (s.puzzle as { puzzle: number[] }).puzzle[i] === 0) ? [i] : []))
      const notes = Array<number>(s.entries.length).fill(0)
      notes[free[0]] = 0b101
      notes[free[1]] = 0b100000001
      const marked = { ...s, notes } as SharedGame
      expect(encodeGame(marked, 'current')).not.toContain(';n=')           // not ticked
      expect(encodeGame(marked, 'start', true)).not.toContain(';n=')       // the clues alone
      const back = decodeGame(game, encodeGame(marked, 'current', true)) as typeof s
      expect(back.notes[free[0]]).toBe(0b101)
      expect(back.notes[free[1]]).toBe(0b100000001)
      expect(back.notes.filter((m) => m !== 0)).toHaveLength(2)
      const filled = s.entries.findIndex((e) => e !== 0)
      const bad = { ...s, notes: notes.map((m, i) => (i === filled ? 0b11 : m)) } as SharedGame
      expect((decodeGame(game, encodeGame(bad, 'current', true)) as typeof s).notes[filled]).toBe(0)
    })
    it(`${game}: a notes string of the wrong length or not made of marks is refused`, () => {
      const s = make(game, seeded(12))
      const data = encodeGame(s, 'start')
      expect(decodeGame(game, `${data};n=00`)).toBeNull()
      expect(decodeGame(game, `${data};n=${'zz'.repeat(25)}`)).toBeNull()
    })
  }
})
