import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { DIFFICULTIES, PEERS, boxOf, clock, colOf, conflicts, deadCells, generatePuzzle, isSolved, nextHint, rowOf, type Difficulty, type Hint } from '../../../domain/games/sudoku'
import { startVisibleInterval } from '../../../hooks/visibleInterval'
import { t, type StringKey } from '../../../i18n'
import { Button } from '../../Button'
import { Card } from '../../Card'
import { Ask, Clock, Erase, X, Lightbulb, Notes, Undo } from '../../icons'
import { MoreLinks } from '../Parts'

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const bit = (d: number) => 1 << (d - 1)
const HINT_KEYS: Record<'naked' | 'row' | 'column' | 'box', StringKey> = { naked: 'sudoku.hint.naked', row: 'sudoku.hint.row', column: 'sudoku.hint.column', box: 'sudoku.hint.box' }
const LEVEL_KEYS: Record<Difficulty, StringKey> = { easy: 'sudoku.level.easy', medium: 'sudoku.level.medium', hard: 'sudoku.level.hard', expert: 'sudoku.level.expert' }

interface Snapshot { entries: number[]; notes: number[] }
/** A hint on screen: the words, the cells it points at, and (when it names a digit) what to fill in. */
interface ShownHint { text: string; cells: number[]; fill?: { index: number; value: number }; remove?: number[] }

/** Sudoku: choose a level, fill the grid so every row, column and box holds 1 to 9. Every puzzle has exactly one solution and can be solved without guessing. Nothing is stored. */
export function SudokuScreen() {
  const [level, setLevel] = useState<Difficulty>('easy')
  const [game, setGame] = useState(() => generatePuzzle('easy'))
  const [entries, setEntries] = useState<number[]>(() => Array(81).fill(0))
  const [notes, setNotes] = useState<number[]>(() => Array(81).fill(0))
  const [history, setHistory] = useState<Snapshot[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [pencil, setPencil] = useState(false)
  const [hint, setHint] = useState<ShownHint | null>(null)
  const [hints, setHints] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const boardRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const grid = useMemo(() => game.puzzle.map((v, i) => v || entries[i]), [game, entries])
  const repeated = useMemo(() => conflicts(grid), [grid])
  const dead = useMemo(() => deadCells(grid), [grid])
  const solved = isSolved(grid, game.solution)

  useEffect(() => (solved ? undefined : startVisibleInterval(() => setSeconds((s) => s + 1), 1000)), [solved])
  useEffect(() => { if (solved) resultRef.current?.focus() }, [solved])

  const given = (i: number) => game.puzzle[i] !== 0
  const commit = (nextEntries: number[], nextNotes: number[]) => {
    setHistory((h) => [...h, { entries, notes }])
    setEntries(nextEntries)
    setNotes(nextNotes)
    setHint(null)
  }

  const enter = (d: number) => {
    if (selected === null || given(selected) || solved) return
    const e = [...entries]
    const n = [...notes]
    if (pencil && e[selected] === 0) n[selected] ^= bit(d)
    else if (!pencil) {
      e[selected] = e[selected] === d ? 0 : d
      n[selected] = 0
      // Placing a digit takes it out of the pencil marks of every cell that sees it.
      if (e[selected] !== 0) for (const p of PEERS[selected]) n[p] &= ~bit(d)
    } else return
    commit(e, n)
  }

  const erase = () => {
    if (selected === null || given(selected) || solved || (entries[selected] === 0 && notes[selected] === 0)) return
    const e = [...entries]
    const n = [...notes]
    e[selected] = 0
    n[selected] = 0
    commit(e, n)
  }

  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory(history.slice(0, -1))
    setEntries(last.entries)
    setNotes(last.notes)
    setHint(null)
  }

  const showHint = () => {
    const h: Hint | null = nextHint(grid, game.solution)
    if (!h) return
    setHints((n) => n + 1)
    if (h.kind === 'mistake') {
      setSelected(h.cells[0])
      setHint({ text: t(h.cells.length === 1 ? 'sudoku.hint.mistake1' : 'sudoku.hint.mistakeN', { n: h.cells.length }), cells: h.cells, remove: h.cells })
      return
    }
    const where = { r: rowOf(h.index) + 1, c: colOf(h.index) + 1, d: h.value }
    const key: StringKey = h.kind === 'reveal' ? 'sudoku.hint.reveal' : HINT_KEYS[h.technique]
    setSelected(h.index)
    setHint({ text: t(key, where), cells: [h.index], fill: { index: h.index, value: h.value } })
  }

  const applyHint = () => {
    if (!hint) return
    const e = [...entries]
    const n = [...notes]
    if (hint.fill) {
      e[hint.fill.index] = hint.fill.value
      n[hint.fill.index] = 0
      for (const p of PEERS[hint.fill.index]) n[p] &= ~bit(hint.fill.value)
    }
    for (const i of hint.remove ?? []) { e[i] = 0; n[i] = 0 }
    commit(e, n)
  }

  const newPuzzle = () => {
    setGame(generatePuzzle(level))
    setEntries(Array(81).fill(0))
    setNotes(Array(81).fill(0))
    setHistory([])
    setSelected(null)
    setHint(null)
    setHints(0)
    setSeconds(0)
    setPencil(false)
  }

  const move = (i: number) => {
    setSelected(i)
    boardRef.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.focus()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const at = selected ?? 0
    const arrows: Record<string, number> = { ArrowLeft: colOf(at) > 0 ? -1 : 0, ArrowRight: colOf(at) < 8 ? 1 : 0, ArrowUp: rowOf(at) > 0 ? -9 : 0, ArrowDown: rowOf(at) < 8 ? 9 : 0 }
    if (e.key in arrows) { e.preventDefault(); move(at + arrows[e.key]) }
    else if (/^[1-9]$/.test(e.key)) enter(Number(e.key))
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') erase()
    else if (e.key === 'Escape') setHint(null)
    else if (e.key === 'n' || e.key === 'N') setPencil((p) => !p)
  }

  const picked = selected === null ? 0 : grid[selected]
  const hintCells = new Set(hint?.cells)
  const remaining = (d: number) => 9 - grid.filter((v) => v === d).length
  const tabbable = selected ?? 0

  return (
    <div className="page">
      <div className="sd">
        <div className="sd-bar">
          <fieldset className="sd-levels">
            <legend className="visually-hidden">{t('sudoku.level.label')}</legend>
            {DIFFICULTIES.map((d) => (
              <label key={d} className="sd-level">
                <input type="radio" className="visually-hidden" name="sudoku-level" checked={level === d} onChange={() => setLevel(d)} />
                <span>{t(LEVEL_KEYS[d])}</span>
              </label>
            ))}
          </fieldset>
          <Button variant="secondary" onClick={newPuzzle}>{t('sudoku.new')}</Button>
        </div>
        <p className="sd-meta">
          <span>{t(LEVEL_KEYS[game.difficulty])}</span>
          <span className="game-clock" role="timer" aria-label={t('sudoku.time')}><Clock aria-hidden="true" focusable="false" />{clock(seconds)}</span>
          <span>{t('sudoku.hintsUsed', { n: hints })}</span>
        </p>

        <div ref={boardRef} className="sd-board" role="grid" aria-label={t('sudoku.board')} onKeyDown={onKeyDown}>
          {Array.from({ length: 9 }, (_, r) => (
            <div key={r} role="row" className="sd-row">
              {Array.from({ length: 9 }, (_, c) => {
                const i = r * 9 + c
                const v = grid[i]
                const isGiven = given(i)
                const classes = ['sd-cell']
                if (isGiven) classes.push('sd-cell--given')
                if (selected !== null && i !== selected && (rowOf(i) === rowOf(selected) || colOf(i) === colOf(selected) || boxOf(i) === boxOf(selected))) classes.push('sd-cell--peer')
                if (picked !== 0 && v === picked) classes.push('sd-cell--same')
                if (i === selected) classes.push('sd-cell--selected')
                if (repeated.has(i)) classes.push('sd-cell--repeat')
                if (dead.has(i)) classes.push('sd-cell--dead')
                if (hintCells.has(i)) classes.push('sd-cell--hint')
                const marks = v === 0 ? DIGITS.filter((d) => notes[i] & bit(d)) : []
                const parts = [t('sudoku.cell', { r: r + 1, c: c + 1 }), v === 0 ? t('sudoku.empty') : `${isGiven ? t('sudoku.given') : t('sudoku.entered')} ${v}`]
                if (marks.length) parts.push(`${t('sudoku.notes')} ${marks.join(' ')}`)
                if (repeated.has(i)) parts.push(t('sudoku.repeats'))
                if (dead.has(i)) parts.push(t('sudoku.deadCell'))
                return (
                  <div key={c} role="gridcell" data-i={i} tabIndex={i === tabbable ? 0 : -1} aria-selected={i === selected} aria-label={parts.join(', ')} className={classes.join(' ')} onClick={() => setSelected(i)}>
                    {v !== 0 ? <span aria-hidden="true">{v}</span> : marks.length > 0 && (
                      <span className="sd-notes" aria-hidden="true">{DIGITS.map((d) => <i key={d}>{notes[i] & bit(d) ? d : ''}</i>)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="sd-messages" role="status">
          {dead.size > 0 && !solved && <p className="sd-warn">{t('sudoku.dead')}</p>}
          {hint && (
            <div className="sd-hint">
              <button type="button" className="sd-hint__close" aria-label={t('sudoku.hint.dismiss')} onClick={() => setHint(null)}><X aria-hidden="true" focusable="false" /></button>
              <p>{hint.text}</p>
              <div className="button-row">
                {hint.fill && <Button variant="secondary" onClick={applyHint}>{t('sudoku.hint.fill')}</Button>}
                {hint.remove && <Button variant="secondary" onClick={applyHint}>{t('sudoku.hint.remove')}</Button>}
              </div>
            </div>
          )}
        </div>

        {solved && (
          <div ref={resultRef} tabIndex={-1} className="sd-result">
            <Card info>
              <h2 className="sd-result__title">{t('sudoku.solved')}</h2>
              <p>{t('sudoku.solvedBody', { level: t(LEVEL_KEYS[game.difficulty]), time: clock(seconds), n: hints })}</p>
              <div className="button-row"><Button onClick={newPuzzle}>{t('sudoku.new')}</Button></div>
            </Card>
          </div>
        )}

        <div className="sd-tools">
          <button type="button" className="sd-tool" onClick={undo} disabled={history.length === 0}><Undo aria-hidden="true" focusable="false" /><span>{t('sudoku.undo')}</span></button>
          <button type="button" className="sd-tool" onClick={erase} disabled={selected === null}><Erase aria-hidden="true" focusable="false" /><span>{t('sudoku.erase')}</span></button>
          <button type="button" className="sd-tool" aria-pressed={pencil} onClick={() => setPencil((p) => !p)}><Notes aria-hidden="true" focusable="false" /><span>{t(pencil ? 'sudoku.notesOn' : 'sudoku.notesOff')}</span></button>
          <button type="button" className="sd-tool" onClick={showHint} disabled={solved}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('sudoku.hint')}</span></button>
        </div>
        <div className="sd-pad" role="group" aria-label={t('sudoku.pad')}>
          {DIGITS.map((d) => (
            <button key={d} type="button" className="sd-digit" disabled={remaining(d) <= 0 || selected === null || solved} aria-label={t('sudoku.digit', { d, n: Math.max(0, remaining(d)) })} onClick={() => enter(d)}>
              <span aria-hidden="true">{d}</span>
              <small aria-hidden="true">{Math.max(0, remaining(d))}</small>
            </button>
          ))}
        </div>
        <details className="game-help">
          <summary><Ask aria-hidden="true" focusable="false" />{t('sudoku.help.title')}</summary>
          <p>{t('sudoku.help.1')}</p>
          <p>{t('sudoku.help.2')}</p>
        </details>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
