import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { BINAIRO_LEVELS, CIRCLE, SQUARE, binairoConflicts, binairoDeadCells, generateBinairo, isBinairoSolved, nextBinairoHint, type BinairoTechnique } from '../../../domain/games/binairo'
import { DIFFICULTIES, clock, type Difficulty } from '../../../domain/games/sudoku'
import { t, type StringKey } from '../../../i18n'
import { Button } from '../../Button'
import { Erase, Lightbulb, Undo } from '../../icons'
import { MoreLinks } from '../Parts'
import { GameClock, GameHelp, GameShare, HintBox, IncomingNote, LevelBar, SolvedCard, useGameClock, useIncomingGame } from './parts'

const LEVEL_KEYS: Record<Difficulty, StringKey> = { easy: 'sudoku.level.easy', medium: 'sudoku.level.medium', hard: 'sudoku.level.hard', expert: 'sudoku.level.expert' }
const HINT_KEYS: Record<BinairoTechnique, StringKey> = { pair: 'binairo.hint.pair', gap: 'binairo.hint.gap', half: 'binairo.hint.half', unique: 'binairo.hint.unique' }

/** A hint on screen: the words, the cells it points at, and what to fill in or clear. */
interface ShownHint { text: string; cells: number[]; fill?: { index: number; value: number }; remove?: number[] }

/** The two symbols, drawn as shapes (a disc and a square) so they never depend on colour. */
const Shape = ({ value }: { value: number }) => <span className={value === CIRCLE ? 'bn-shape bn-shape--circle' : 'bn-shape bn-shape--square'} aria-hidden="true" />

/**
 * Binairo: fill the grid with circles and squares. No three of one symbol in a row or column, each row and column has equally many of each,
 * and no two rows or two columns match. Every puzzle has one answer and can be solved without guessing. Nothing is stored.
 */
export function BinairoScreen() {
  const { incoming, fromChat, leaveChat } = useIncomingGame('binairo')
  const sent = incoming && incoming.shared.game === 'binairo' ? incoming.shared : null
  const [level, setLevel] = useState<Difficulty>(sent?.puzzle.difficulty ?? 'easy')
  const [game, setGame] = useState(() => sent?.puzzle ?? generateBinairo('easy'))
  const n = game.size
  const [entries, setEntries] = useState<number[]>(() => sent?.entries ?? Array(n * n).fill(0))
  const [history, setHistory] = useState<number[][]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [hint, setHint] = useState<ShownHint | null>(null)
  const [hints, setHints] = useState(0)
  const boardRef = useRef<HTMLDivElement>(null)

  const grid = useMemo(() => game.puzzle.map((v, i) => v || entries[i]), [game, entries])
  const repeated = useMemo(() => binairoConflicts(grid, n), [grid, n])
  const dead = useMemo(() => binairoDeadCells(grid, n), [grid, n])
  const solved = isBinairoSolved(grid, game.solution)
  const { seconds, reset: resetClock } = useGameClock(!solved)
  const given = (i: number) => game.puzzle[i] !== 0

  const commit = (next: number[]) => {
    setHistory((h) => [...h, entries])
    setEntries(next)
    setHint(null)
  }
  const set = (i: number, value: number) => {
    if (given(i) || solved || entries[i] === value) return
    const e = [...entries]
    e[i] = value
    commit(e)
  }
  /** Tapping a square steps empty, circle, square, empty. */
  const cycle = (i: number) => {
    setSelected(i)
    if (!given(i)) set(i, (entries[i] + 1) % 3)
  }
  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory(history.slice(0, -1))
    setEntries(last)
    setHint(null)
  }

  const showHint = () => {
    const h = nextBinairoHint(grid, game.solution, n)
    if (!h) return
    setHints((x) => x + 1)
    if (h.kind === 'mistake') {
      setSelected(h.cells[0])
      setHint({ text: t(h.cells.length === 1 ? 'sudoku.hint.mistake1' : 'sudoku.hint.mistakeN', { n: h.cells.length }), cells: h.cells, remove: h.cells })
      return
    }
    const index = h.kind === 'move' ? h.move.index : h.index
    const value = h.kind === 'move' ? h.move.value : h.value
    const where = { r: Math.floor(index / n) + 1, c: (index % n) + 1, s: t(value === CIRCLE ? 'binairo.circle' : 'binairo.square'), o: t(value === CIRCLE ? 'binairo.square' : 'binairo.circle') }
    setSelected(index)
    if (h.kind === 'reveal') { setHint({ text: t('binairo.hint.reveal', where), cells: [index], fill: { index, value } }); return }
    const { move } = h
    const line = move.line + 1
    const lineWord = t(move.kind === 'row' ? 'binairo.row' : 'binairo.column')
    const text = t(HINT_KEYS[move.technique], { ...where, line, lineWord, other: (move.other ?? 0) + 1, half: n / 2, n })
    setHint({ text, cells: [index, ...move.cells], fill: { index, value } })
  }

  const applyHint = () => {
    if (!hint) return
    const e = [...entries]
    if (hint.fill) e[hint.fill.index] = hint.fill.value
    for (const i of hint.remove ?? []) e[i] = 0
    commit(e)
  }

  const newPuzzle = () => {
    leaveChat()
    const next = generateBinairo(level)
    setGame(next)
    setEntries(Array(next.size * next.size).fill(0))
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

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const at = selected ?? 0
    const r = Math.floor(at / n)
    const c = at % n
    const arrows: Record<string, number> = { ArrowLeft: c > 0 ? -1 : 0, ArrowRight: c < n - 1 ? 1 : 0, ArrowUp: r > 0 ? -n : 0, ArrowDown: r < n - 1 ? n : 0 }
    if (e.key in arrows) { e.preventDefault(); move(at + arrows[e.key]) }
    else if (selected === null) return
    else if (e.key === '0' || e.key === 'c' || e.key === 'C') set(selected, CIRCLE)
    else if (e.key === '1' || e.key === 's' || e.key === 'S') set(selected, SQUARE)
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); cycle(selected) }
    else if (e.key === 'Backspace' || e.key === 'Delete') set(selected, 0)
    else if (e.key === 'Escape') setHint(null)
  }

  const hintCells = new Set(hint?.cells)
  const remaining = (v: number) => (n * n) / 2 - grid.filter((x) => x === v).length
  const tabbable = selected ?? 0
  const boardStyle = { '--n': n } as CSSProperties

  return (
    <div className="page">
      <div className="sd">
        <LevelBar name="binairo-level" legend={t('sudoku.level.label')} levels={DIFFICULTIES.map((d) => ({ id: d, label: `${t(LEVEL_KEYS[d])} ${BINAIRO_LEVELS[d].size}×${BINAIRO_LEVELS[d].size}` }))} level={level} onLevel={setLevel}>
          <Button variant="secondary" onClick={newPuzzle}>{t('sudoku.new')}</Button>
        </LevelBar>
        {fromChat && <IncomingNote mode={fromChat} onFresh={newPuzzle} />}
        <p className="sd-meta">
          <span>{t(LEVEL_KEYS[game.difficulty])} {n}×{n}</span>
          <GameClock seconds={seconds} label={t('sudoku.time')} />
          <span>{t('sudoku.hintsUsed', { n: hints })}</span>
        </p>

        <div ref={boardRef} className="bn-board" style={boardStyle} role="grid" aria-label={t('binairo.board', { n })} onKeyDown={onKeyDown}>
          {Array.from({ length: n }, (_, r) => (
            <div key={r} role="row" className="bn-row">
              {Array.from({ length: n }, (_, c) => {
                const i = r * n + c
                const v = grid[i]
                const classes = ['bn-cell']
                if (given(i)) classes.push('bn-cell--given')
                if (i === selected) classes.push('bn-cell--selected')
                if (repeated.has(i)) classes.push('bn-cell--repeat')
                if (dead.has(i)) classes.push('bn-cell--dead')
                if (hintCells.has(i)) classes.push('bn-cell--hint')
                const word = v === 0 ? t('sudoku.empty') : `${given(i) ? t('sudoku.given') : t('sudoku.entered')} ${t(v === CIRCLE ? 'binairo.circle' : 'binairo.square')}`
                const parts = [t('sudoku.cell', { r: r + 1, c: c + 1 }), word]
                if (repeated.has(i)) parts.push(t('binairo.repeats'))
                if (dead.has(i)) parts.push(t('binairo.deadCell'))
                return (
                  <div key={c} role="gridcell" data-i={i} tabIndex={i === tabbable ? 0 : -1} aria-selected={i === selected} aria-label={parts.join(', ')} className={classes.join(' ')} onClick={() => cycle(i)}>
                    {v !== 0 && <Shape value={v} />}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="sd-messages" role="status">
          {dead.size > 0 && !solved && <p className="sd-warn">{t('binairo.dead')}</p>}
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

        <div className="sd-tools bn-tools">
          <button type="button" className="sd-tool" onClick={undo} disabled={history.length === 0}><Undo aria-hidden="true" focusable="false" /><span>{t('sudoku.undo')}</span></button>
          <button type="button" className="sd-tool" onClick={() => selected !== null && set(selected, 0)} disabled={selected === null || solved}><Erase aria-hidden="true" focusable="false" /><span>{t('sudoku.erase')}</span></button>
          <button type="button" className="sd-tool" onClick={showHint} disabled={solved}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('sudoku.hint')}</span></button>
          <GameShare shared={{ game: 'binairo', puzzle: game, entries, notes: [] }} title={t('binairo.board', { n })} done={solved} seconds={seconds} />
        </div>
        <div className="bn-pad" role="group" aria-label={t('binairo.pad')}>
          {[CIRCLE, SQUARE].map((v) => (
            <button key={v} type="button" className="sd-digit bn-pad__key" disabled={selected === null || solved} aria-label={t('binairo.place', { s: t(v === CIRCLE ? 'binairo.circle' : 'binairo.square'), n: Math.max(0, remaining(v)) })} onClick={() => selected !== null && set(selected, v)}>
              <Shape value={v} />
              <small aria-hidden="true">{Math.max(0, remaining(v))}</small>
            </button>
          ))}
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('binairo.help.1')}</p>
          <p>{t('binairo.help.2')}</p>
        </GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
