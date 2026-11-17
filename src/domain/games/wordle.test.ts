import { describe, expect, it } from 'vitest'
import { MAX_GUESSES, backspace, keyStates, newGame, pickTarget, scoreGuess, shareText, submitGuess, typeLetter, type WordleGame } from './wordle'
import { WORDLE_WORDS } from './wordleWords'

const type = (g: WordleGame, word: string) => [...word].reduce(typeLetter, g)
const play = (g: WordleGame, word: string) => submitGuess(type(g, word)).game

describe('word list', () => {
  it('has well over a hundred upper case five-letter words with no repeats', () => {
    expect(WORDLE_WORDS.length).toBeGreaterThanOrEqual(150)
    expect(WORDLE_WORDS.every((w) => /^[A-Z]{5}$/.test(w))).toBe(true)
    expect(new Set(WORDLE_WORDS).size).toBe(WORDLE_WORDS.length)
  })
})

describe('scoreGuess', () => {
  it('marks right place, wrong place and missing', () => {
    expect(scoreGuess('SHORE', 'SHORE')).toEqual(['correct', 'correct', 'correct', 'correct', 'correct'])
    expect(scoreGuess('CABIN', 'DECKS')).toEqual(['present', 'absent', 'absent', 'absent', 'absent'])
    expect(scoreGuess('OCEAN', 'CABIN')).toEqual(['absent', 'present', 'absent', 'present', 'correct'])
  })
  it('counts repeated letters only as often as the target has them', () => {
    // One E in the target: the guess has two, so only one is marked.
    expect(scoreGuess('EERIE', 'OCEAN')).toEqual(['present', 'absent', 'absent', 'absent', 'absent'])
    // A correct letter uses up the only copy, so the misplaced one is absent.
    expect(scoreGuess('SALAD', 'SHORE').slice(0, 2)).toEqual(['correct', 'absent'])
    expect(scoreGuess('LLAMA', 'SALAD')).toEqual(['present', 'absent', 'present', 'absent', 'present'])
  })
})

describe('keyStates', () => {
  it('keeps the best result for each letter', () => {
    const s = keyStates(['SALAD', 'LLAMA'], 'SALAD')
    expect(s.S).toBe('correct')
    expect(s.A).toBe('correct')
    expect(s.M).toBe('absent')
    expect(keyStates(['EERIE'], 'OCEAN').E).toBe('present')
  })
})

describe('pickTarget', () => {
  it('uses the random number to choose and never repeats the word to avoid', () => {
    expect(pickTarget(() => 0, undefined, ['A', 'B', 'C'])).toBe('A')
    expect(pickTarget(() => 0.999, undefined, ['A', 'B', 'C'])).toBe('C')
    expect(pickTarget(() => 0, 'A', ['A', 'B', 'C'])).toBe('B')
    expect(WORDLE_WORDS).toContain(pickTarget())
  })
})

describe('the game', () => {
  it('types, deletes and ignores anything that is not a letter or a sixth letter', () => {
    let g = newGame('shore')
    g = type(g, 'sh1 o')
    expect(g.current).toBe('SHO')
    expect(backspace(g).current).toBe('SH')
    expect(type(newGame('SHORE'), 'oceans').current).toBe('OCEAN')
    expect(backspace(newGame('SHORE')).current).toBe('')
  })
  it('refuses a short row without using a guess', () => {
    const r = submitGuess(type(newGame('SHORE'), 'OCE'))
    expect(r.problem).toBe('short')
    expect(r.game.guesses).toHaveLength(0)
    expect(r.game.current).toBe('OCE')
  })
  it('wins on the right word', () => {
    const g = play(play(newGame('SHORE'), 'OCEAN'), 'SHORE')
    expect(g.status).toBe('won')
    expect(g.guesses).toEqual(['OCEAN', 'SHORE'])
    expect(typeLetter(g, 'A')).toBe(g)
    expect(submitGuess(g).problem).toBe('over')
  })
  it('loses after six wrong guesses', () => {
    let g = newGame('SHORE')
    for (let i = 0; i < MAX_GUESSES; i++) g = play(g, 'OCEAN')
    expect(g.status).toBe('lost')
  })
})

describe('shareText', () => {
  it('shows the score and the squares but not the word', () => {
    const g = play(play(newGame('SHORE'), 'OCEAN'), 'SHORE')
    const text = shareText(g, 'Cruise Wordle')
    expect(text.split('\n')[0]).toBe('Cruise Wordle 2/6')
    expect(text).toContain('🟩🟩🟩🟩🟩')
    expect(text).not.toContain('SHORE')
    let lost = newGame('SHORE')
    for (let i = 0; i < MAX_GUESSES; i++) lost = play(lost, 'OCEAN')
    expect(shareText(lost, 'Cruise Wordle').split('\n')[0]).toBe('Cruise Wordle X/6')
  })
})
