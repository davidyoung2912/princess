import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { generateKiller, killerConflicts, killerDeadCells, nextKillerHint, type KillerHint, type KillerTechnique } from '../../../games/domain/killer'
import { DIFFICULTIES, clock, colOf, conflicts, deadCells, generatePuzzle, isSolved, nextHint, regionEdges, rowOf, type Difficulty, type Rules, type Variant } from '../../../games/domain/sudoku'
import { isSudokuShare } from '../../../games/domain/share'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Erase, Lightbulb, Notes, Undo } from '../../../../shared/ui/icons'
import { MoreLinks } from '../Parts'
import { GameClock, GameHelp, GameShare, HintBox, IncomingNote, LevelBar, SolvedCard } from './parts'
import { useGameClock, useIncomingGame } from './gameHooks'

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const bit = (d: number) => 1 << (d - 1)
const HINT_KEYS: Record<KillerTechnique, StringKey> = { cage: 'sudoku.hint.cageSingle', sum45: 'sudoku.hint.sum45', naked: 'sudoku.hint.naked', row: 'sudoku.hint.row', column: 'sudoku.hint.column', box: 'sudoku.hint.box', region: 'sudoku.hint.region', diagonal: 'sudoku.hint.diagonal' }
/** The words that differ between the classic grid and its variants. */
const WORDS: Record<Variant, { board: StringKey; repeats: StringKey; help1: StringKey; help2: StringKey }> = {
  classic: { board: 'sudoku.board', repeats: 'sudoku.repeats', help1: 'sudoku.help.1', help2: 'sudoku.help.2' },
  diagonal: { board: 'sudoku.diag.board', repeats: 'sudoku.diag.repeats', help1: 'sudoku.diag.help.1', help2: 'sudoku.diag.help.2' },
  jigsaw: { board: 'sudoku.jigsaw.board', repeats: 'sudoku.jigsaw.repeats', help1: 'sudoku.jigsaw.help.1', help2: 'sudoku.jigsaw.help.2' },
  killer: { board: 'sudoku.killer.board', repeats: 'sudoku.killer.repeats', help1: 'sudoku.killer.help.1', help2: 'sudoku.killer.help.2' },
}
const GAME_ID = { classic: 'sudoku', diagonal: 'diagonal-sudoku', jigsaw: 'jigsaw-sudoku', killer: 'killer-sudoku' } as const
const LEVEL_KEYS: Record<Difficulty, StringKey> = { easy: 'sudoku.level.easy', medium: 'sudoku.level.medium', hard: 'sudoku.level.hard', expert: 'sudoku.level.expert' }

interface Snapshot { entries: number[]; notes: number[] }
/** A hint on screen: the words, the cells it points at, and (when it names a digit) what to fill in. */
interface ShownHint { text: string; cells: number[]; fill?: { index: number; value: number }; remove?: number[] }

/**
 * Sudoku: choose a level, fill the grid so every row, column and box holds 1 to 9. Every puzzle has exactly one solution and can be solved without guessing.
 * The Diagonal variant also needs 1 to 9 on both long diagonals, and the Jigsaw variant swaps the 3 by 3 boxes for irregular shapes. Nothing is stored.
 */
export const SudokuScreen = () => <SudokuGame variant="classic" />
export const DiagonalSudokuScreen = () => <SudokuGame variant="diagonal" />
export const JigsawSudokuScreen = () => <SudokuGame variant="jigsaw" />
export const KillerSudokuScreen = () => <SudokuGame variant="killer" />

/** Each variant's own generator and checkers (Killer adds cage sums to all three). */
const plain = (variant: Variant) => ({ generate: (level: Difficulty) => generatePuzzle(level, Math.random, variant), conflicts, deadCells, nextHint: nextHint as (g: readonly number[], s: readonly number[], r: Rules) => KillerHint | null })
const ENGINES = {
  classic: plain('classic'),
  diagonal: plain('diagonal'),
  jigsaw: plain('jigsaw'),
  killer: { generate: (level: Difficulty) => generateKiller(level), conflicts: killerConflicts, deadCells: killerDeadCells, nextHint: nextKillerHint },
} as const

function SudokuGame({ variant }: { variant: Variant }) {
  const engine = ENGINES[variant]
  const { incoming, fromChat, leaveChat } = useIncomingGame(GAME_ID[variant])
  const sent = incoming && isSudokuShare(incoming.shared) ? incoming.shared : null
  const [level, setLevel] = useState<Difficulty>(sent?.puzzle.difficulty ?? 'easy')
  const [game, setGame] = useState(() => sent?.puzzle ?? engine.generate('easy'))
  const rules = game.rules
  const words = WORDS[variant]
  const [entries, setEntries] = useState<number[]>(() => sent?.entries ?? Array(81).fill(0))
  const [notes, setNotes] = useState<number[]>(() => sent?.notes ?? Array(81).fill(0))
  const [history, setHistory] = useState<Snapshot[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [pencil, setPencil] = useState(false)
  const [hint, setHint] = useState<ShownHint | null>(null)
  const [hints, setHints] = useState(0)
  const boardRef = useRef<HTMLDivElement>(null)

  const grid = useMemo(() => game.puzzle.map((v, i) => v || entries[i]), [game, entries])
  const repeated = useMemo(() => engine.conflicts(grid, rules), [engine, grid, rules])
  const dead = useMemo(() => engine.deadCells(grid, rules), [engine, grid, rules])
  const solved = isSolved(grid, game.solution)

  const { seconds, reset: resetClock } = useGameClock(!solved)
  const peersOfSelected = useMemo(() => new Set(selected === null ? [] : rules.peers[selected]), [rules, selected])

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
      if (e[selected] !== 0) for (const p of rules.peers[selected]) n[p] &= ~bit(d)
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
    const h = engine.nextHint(grid, game.solution, rules)
    if (!h) return
    setHints((n) => n + 1)
    if (h.kind === 'mistake') {
      setSelected(h.cells[0])
      setHint({ text: t(h.cells.length === 1 ? 'sudoku.hint.mistake1' : 'sudoku.hint.mistakeN', { n: h.cells.length }), cells: h.cells, remove: h.cells })
      return
    }
    if (h.kind === 'cage') {
      const cage = rules.cages[h.cage]
      setSelected(cage.cells[0])
      setHint({ text: t('sudoku.hint.cage', { n: cage.cells.length, s: cage.sum, digits: h.digits.join(', ') }), cells: [...cage.cells] })
      return
    }
    const where = { r: rowOf(h.index) + 1, c: colOf(h.index) + 1, d: h.value, n: rules.cages[rules.cageOf[h.index]]?.cells.length ?? 0, s: rules.cages[rules.cageOf[h.index]]?.sum ?? 0 }
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
      for (const p of rules.peers[hint.fill.index]) n[p] &= ~bit(hint.fill.value)
    }
    for (const i of hint.remove ?? []) { e[i] = 0; n[i] = 0 }
    commit(e, n)
  }

  const newPuzzle = () => {
    leaveChat()
    setGame(engine.generate(level))
    setEntries(Array(81).fill(0))
    setNotes(Array(81).fill(0))
    setHistory([])
    setSelected(null)
    setHint(null)
    setHints(0)
    resetClock()
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
        <LevelBar name="sudoku-level" legend={t('sudoku.level.label')} levels={DIFFICULTIES.map((d) => ({ id: d, label: t(LEVEL_KEYS[d]) }))} level={level} onLevel={setLevel}>
          <Button variant="secondary" onClick={newPuzzle}>{t('sudoku.new')}</Button>
        </LevelBar>
        {fromChat && <IncomingNote mode={fromChat} onFresh={newPuzzle} />}
        <p className="sd-meta">
          <span>{t(LEVEL_KEYS[game.difficulty])}</span>
          <GameClock seconds={seconds} label={t('sudoku.time')} />
          <span>{t('sudoku.hintsUsed', { n: hints })}</span>
        </p>

        <div ref={boardRef} className={variant === 'killer' ? 'sd-board sd-board--killer' : 'sd-board'} role="grid" aria-label={t(words.board)} onKeyDown={onKeyDown}>
          {Array.from({ length: 9 }, (_, r) => (
            <div key={r} role="row" className="sd-row">
              {Array.from({ length: 9 }, (_, c) => {
                const i = r * 9 + c
                const v = grid[i]
                const isGiven = given(i)
                const classes = ['sd-cell']
                if (isGiven) classes.push('sd-cell--given')
                if (peersOfSelected.has(i)) classes.push('sd-cell--peer')
                const edge = regionEdges(rules, i)
                if (edge.right) classes.push('sd-cell--edge-r')
                if (edge.bottom) classes.push('sd-cell--edge-b')
                if (rules.diagonal.has(i)) classes.push('sd-cell--diag')
                const cage = rules.cages[rules.cageOf[i]]
                const cageSides = cage ? (['t', 'r', 'b', 'l'] as const).filter((side) => {
                  const n = side === 't' ? (r > 0 ? i - 9 : -1) : side === 'b' ? (r < 8 ? i + 9 : -1) : side === 'l' ? (c > 0 ? i - 1 : -1) : (c < 8 ? i + 1 : -1)
                  return n < 0 || rules.cageOf[n] !== rules.cageOf[i]
                }) : []
                if (picked !== 0 && v === picked) classes.push('sd-cell--same')
                if (i === selected) classes.push('sd-cell--selected')
                if (repeated.has(i)) classes.push('sd-cell--repeat')
                if (dead.has(i)) classes.push('sd-cell--dead')
                if (hintCells.has(i)) classes.push('sd-cell--hint')
                const marks = v === 0 ? DIGITS.filter((d) => notes[i] & bit(d)) : []
                const parts = [t('sudoku.cell', { r: r + 1, c: c + 1 }), ...(variant === 'jigsaw' ? [t('sudoku.cellRegion', { n: rules.region[i] + 1 })] : []), ...(rules.diagonal.has(i) ? [t('sudoku.cellDiagonal')] : []), ...(cage ? [t('sudoku.cellCage', { n: cage.cells.length, s: cage.sum })] : []), v === 0 ? t('sudoku.empty') : `${isGiven ? t('sudoku.given') : t('sudoku.entered')} ${v}`]
                if (marks.length) parts.push(`${t('sudoku.notes')} ${marks.join(' ')}`)
                if (repeated.has(i)) parts.push(t(words.repeats))
                if (dead.has(i)) parts.push(t('sudoku.deadCell'))
                return (
                  <div key={c} role="gridcell" data-i={i} tabIndex={i === tabbable ? 0 : -1} aria-selected={i === selected} aria-label={parts.join(', ')} className={classes.join(' ')} onClick={() => setSelected(i)}>
                    {cage && <span className={`sd-cage ${cageSides.map((s) => `sd-cage--${s}`).join(' ')}`} aria-hidden="true">{cage.cells[0] === i && <b>{cage.sum}</b>}</span>}
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
          <button type="button" className="sd-tool" onClick={erase} disabled={selected === null}><Erase aria-hidden="true" focusable="false" /><span>{t('sudoku.erase')}</span></button>
          <button type="button" className="sd-tool" aria-pressed={pencil} onClick={() => setPencil((p) => !p)}><Notes aria-hidden="true" focusable="false" /><span>{t(pencil ? 'sudoku.notesOn' : 'sudoku.notesOff')}</span></button>
          <button type="button" className="sd-tool" onClick={showHint} disabled={solved}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('sudoku.hint')}</span></button>
          <GameShare shared={{ game: GAME_ID[variant], puzzle: game, entries, notes }} title={t(words.board)} done={solved} seconds={seconds} />
        </div>
        <div className="sd-pad" role="group" aria-label={t('sudoku.pad')}>
          {DIGITS.map((d) => (
            <button key={d} type="button" className="sd-digit" disabled={remaining(d) <= 0 || selected === null || solved} aria-label={t('sudoku.digit', { d, n: Math.max(0, remaining(d)) })} onClick={() => enter(d)}>
              <span aria-hidden="true">{d}</span>
              <small aria-hidden="true">{Math.max(0, remaining(d))}</small>
            </button>
          ))}
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t(words.help1)}</p>
          <p>{t(words.help2)}</p>
        </GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
