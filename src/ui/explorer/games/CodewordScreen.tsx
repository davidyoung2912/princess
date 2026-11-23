import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ALPHABET, CODEWORD_LEVELS, codewordConflicts, generateCodeword, isCodewordSolved, knownLetters, letterChar, nextCodewordHint, patternOf, type CodewordTechnique } from '../../../domain/games/codeword'
import { DIFFICULTIES, clock, type Difficulty } from '../../../domain/games/sudoku'
import { t, type StringKey } from '../../../i18n'
import { Button } from '../../Button'
import { Erase, Lightbulb, Undo } from '../../icons'
import { MoreLinks } from '../Parts'
import { GameClock, GameHelp, GameShare, HintBox, IncomingNote, LevelBar, SolvedCard, useGameClock, useIncomingGame } from './parts'

const LEVEL_KEYS: Record<Difficulty, StringKey> = { easy: 'sudoku.level.easy', medium: 'sudoku.level.medium', hard: 'sudoku.level.hard', expert: 'sudoku.level.expert' }
const HINT_KEYS: Record<CodewordTechnique, StringKey> = { word: 'codeword.hint.word', cross: 'codeword.hint.cross', deep: 'codeword.hint.deep' }
const LETTERS = Array.from({ length: 26 }, (_, k) => k + 1)

/** A hint on screen: the words, the squares it points at, and what to fill in or clear. */
interface ShownHint { text: string; cells: number[]; fill?: { num: number; letter: number }[]; remove?: number[] }

/**
 * Codeword: every square holds a number from 1 to 26 and each number stands for one letter. A few letters are given; work out the rest
 * from the words they spell. Every puzzle has one answer that the word list and logic reach. Nothing is stored.
 */
export function CodewordScreen() {
  const { incoming, fromChat, leaveChat } = useIncomingGame('codeword')
  const sent = incoming && incoming.shared.game === 'codeword' ? incoming.shared : null
  const [level, setLevel] = useState<Difficulty>(sent?.puzzle.difficulty ?? 'easy')
  const [game, setGame] = useState(() => sent?.puzzle ?? generateCodeword('easy'))
  const n = game.size
  const [entries, setEntries] = useState<number[]>(() => sent?.entries ?? Array(27).fill(0))
  const [history, setHistory] = useState<number[][]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [hint, setHint] = useState<ShownHint | null>(null)
  const [hints, setHints] = useState(0)
  const boardRef = useRef<HTMLDivElement>(null)

  const known = useMemo(() => knownLetters(game, entries), [game, entries])
  const clash = useMemo(() => codewordConflicts(game, entries), [game, entries])
  const solved = isCodewordSolved(game, entries)
  const { seconds, reset: resetClock } = useGameClock(!solved)
  const given = (num: number) => game.givens.includes(num)
  const num = selected === null ? 0 : game.code[selected]
  const cellsOf = (u: number) => game.code.flatMap((c, i) => (c === u ? [i] : []))
  /** Which number holds each letter right now. */
  const holder = useMemo(() => {
    const h = Array<number>(27).fill(0)
    game.used.forEach((u) => { if (known[u]) h[known[u]] = u })
    return h
  }, [game.used, known])

  const commit = (next: number[]) => {
    setHistory((h) => [...h, entries])
    setEntries(next)
    setHint(null)
  }

  const enter = (letter: number) => {
    if (!num || given(num) || solved) return
    const e = [...entries]
    e[num] = e[num] === letter ? 0 : letter
    commit(e)
  }

  const erase = () => {
    if (!num || given(num) || solved || entries[num] === 0) return
    const e = [...entries]
    e[num] = 0
    commit(e)
  }

  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory(history.slice(0, -1))
    setEntries(last)
    setHint(null)
  }

  const showHint = () => {
    const h = nextCodewordHint(game, entries)
    if (!h) return
    setHints((x) => x + 1)
    if (h.kind === 'mistake') {
      setSelected(cellsOf(h.nums[0])[0])
      setHint({ text: t(h.nums.length === 1 ? 'sudoku.hint.mistake1' : 'sudoku.hint.mistakeN', { n: h.nums.length }), cells: h.nums.flatMap(cellsOf), remove: h.nums })
      return
    }
    if (h.kind === 'reveal') {
      setSelected(cellsOf(h.num)[0])
      setHint({ text: t('codeword.hint.reveal', { n: h.num, l: letterChar(h.letter) }), cells: cellsOf(h.num), fill: [{ num: h.num, letter: h.letter }] })
      return
    }
    const { move } = h
    const first = move.fills[0]
    setSelected(cellsOf(first.num)[0])
    const where = move.slot === null ? null : game.slots[move.slot].cells[0]
    const text = t(HINT_KEYS[move.technique], {
      n: first.num,
      l: letterChar(first.letter),
      dir: move.slot === null ? '' : t(game.slots[move.slot].across ? 'kakuro.across' : 'kakuro.down'),
      r: where === null ? 0 : Math.floor(where / n) + 1,
      c: where === null ? 0 : (where % n) + 1,
      pattern: move.slot === null ? '' : patternOf(game, move.slot, known),
      words: move.words.join(', '),
      all: move.fills.map((f) => `${f.num} = ${letterChar(f.letter)}`).join(', '),
    })
    setHint({ text, cells: [...new Set([...(move.slot === null ? [] : game.slots[move.slot].cells), ...move.fills.flatMap((f) => cellsOf(f.num))])], fill: move.fills })
  }

  const applyHint = () => {
    if (!hint) return
    const e = [...entries]
    for (const f of hint.fill ?? []) e[f.num] = f.letter
    for (const u of hint.remove ?? []) e[u] = 0
    commit(e)
  }

  const newPuzzle = () => {
    leaveChat()
    setGame(generateCodeword(level))
    setEntries(Array(27).fill(0))
    setHistory([])
    setSelected(null)
    setHint(null)
    setHints(0)
    resetClock()
  }

  const move = (i: number) => {
    setSelected(i)
    boardRef.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.focus()
  }

  /** The next white square in a direction, jumping over black squares; stays put at the edge. */
  const step = (from: number, dr: number, dc: number): number => {
    let r = Math.floor(from / n) + dr
    let c = (from % n) + dc
    while (r >= 0 && r < n && c >= 0 && c < n) {
      if (game.white[r * n + c]) return r * n + c
      r += dr
      c += dc
    }
    return from
  }

  const firstWhite = game.white.indexOf(true)
  const tabbable = selected ?? firstWhite

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const at = selected ?? firstWhite
    const dirs: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }
    if (e.key in dirs) { e.preventDefault(); move(step(at, dirs[e.key][0], dirs[e.key][1])) }
    else if (selected === null) return
    else if (/^[a-zA-Z]$/.test(e.key)) enter(ALPHABET.indexOf(e.key.toUpperCase()) + 1)
    else if (e.key === 'Backspace' || e.key === 'Delete') erase()
    else if (e.key === 'Escape') setHint(null)
  }

  const hintCells = new Set(hint?.cells)

  return (
    <div className="page">
      <div className="sd">
        <LevelBar name="codeword-level" legend={t('sudoku.level.label')} levels={DIFFICULTIES.map((d) => ({ id: d, label: `${t(LEVEL_KEYS[d])} ${CODEWORD_LEVELS[d].size}×${CODEWORD_LEVELS[d].size}` }))} level={level} onLevel={setLevel}>
          <Button variant="secondary" onClick={newPuzzle}>{t('sudoku.new')}</Button>
        </LevelBar>
        {fromChat && <IncomingNote mode={fromChat} onFresh={newPuzzle} />}
        <p className="sd-meta">
          <span>{t(LEVEL_KEYS[game.difficulty])} {n}×{n}</span>
          <GameClock seconds={seconds} label={t('sudoku.time')} />
          <span>{t('sudoku.hintsUsed', { n: hints })}</span>
        </p>

        <div ref={boardRef} className="cw-board" style={{ '--n': n } as CSSProperties} role="grid" aria-label={t('codeword.board', { n })} onKeyDown={onKeyDown}>
          {Array.from({ length: n }, (_, r) => (
            <div key={r} role="row" className="cw-row">
              {Array.from({ length: n }, (_, c) => {
                const i = r * n + c
                const where = t('sudoku.cell', { r: r + 1, c: c + 1 })
                if (!game.white[i]) return <div key={c} role="gridcell" aria-label={`${where}, ${t('kakuro.black')}`} className="cw-cell cw-cell--black" />
                const u = game.code[i]
                const letter = known[u]
                const classes = ['cw-cell']
                if (given(u)) classes.push('cw-cell--given')
                if (u === num) classes.push('cw-cell--same')
                if (i === selected) classes.push('cw-cell--selected')
                if (clash.has(u)) classes.push('cw-cell--repeat')
                if (hintCells.has(i)) classes.push('cw-cell--hint')
                const parts = [where, t('codeword.number', { n: u }), letter === 0 ? t('sudoku.empty') : `${given(u) ? t('sudoku.given') : t('sudoku.entered')} ${letterChar(letter)}`]
                if (clash.has(u)) parts.push(t('codeword.repeats'))
                return (
                  <div key={c} role="gridcell" data-i={i} tabIndex={i === tabbable ? 0 : -1} aria-selected={i === selected} aria-label={parts.join(', ')} className={classes.join(' ')} onClick={() => setSelected(i)}>
                    <b className="cw-num" aria-hidden="true">{u}</b>
                    {letter !== 0 && <span aria-hidden="true">{letterChar(letter)}</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="sd-messages" role="status">
          {hint && (
            <HintBox text={hint.text} dismissLabel={t('sudoku.hint.dismiss')} onDismiss={() => setHint(null)}>
              {hint.fill && <Button variant="secondary" onClick={applyHint}>{t('sudoku.hint.fill')}</Button>}
              {hint.remove && <Button variant="secondary" onClick={applyHint}>{t('sudoku.hint.remove')}</Button>}
            </HintBox>
          )}
        </div>

        {solved && (
          <SolvedCard title={t('sudoku.solved')}>
            <p>{t('sudoku.solvedBody', { level: t(LEVEL_KEYS[game.difficulty]), time: clock(seconds), n: hints })}</p>
            <div className="button-row"><Button onClick={newPuzzle}>{t('sudoku.new')}</Button></div>
          </SolvedCard>
        )}

        <div className="sd-tools">
          <button type="button" className="sd-tool" onClick={undo} disabled={history.length === 0}><Undo aria-hidden="true" focusable="false" /><span>{t('sudoku.undo')}</span></button>
          <button type="button" className="sd-tool" onClick={erase} disabled={!num || given(num)}><Erase aria-hidden="true" focusable="false" /><span>{t('sudoku.erase')}</span></button>
          <GameShare shared={{ game: 'codeword', puzzle: game, entries, notes: [] }} title={t('gx.game.codeword.title')} />
          <button type="button" className="sd-tool" onClick={showHint} disabled={solved}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('sudoku.hint')}</span></button>
        </div>
        <div className="cw-keys" role="group" aria-label={t('codeword.keys')}>
          {LETTERS.map((l) => {
            const owner = holder[l]
            const here = owner !== 0 && owner === num
            return (
              <button key={l} type="button" className={`cw-key${owner ? ' cw-key--used' : ''}${here ? ' cw-key--here' : ''}`} aria-pressed={here} disabled={!num || given(num) || solved}
                aria-label={owner ? t('codeword.key.used', { l: letterChar(l), n: owner }) : t('codeword.key.free', { l: letterChar(l) })} onClick={() => enter(l)}>
                <span aria-hidden="true">{letterChar(l)}</span>
                <small aria-hidden="true">{owner || ''}</small>
              </button>
            )
          })}
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('codeword.help.1')}</p>
          <p>{t('codeword.help.2')}</p>
        </GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
