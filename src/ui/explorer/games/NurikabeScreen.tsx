import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { BLANK, DOT, NURIKABE_LEVELS, WALL, generateNurikabe, isNurikabeSolved, nextNurikabeHint, nurikabeConflicts, type NurikabeTechnique } from '../../../domain/games/nurikabe'
import { DIFFICULTIES, clock, type Difficulty } from '../../../domain/games/sudoku'
import { t, type StringKey } from '../../../i18n'
import { Button } from '../../Button'
import { Erase, Lightbulb, Undo } from '../../icons'
import { MoreLinks } from '../Parts'
import { GameClock, GameHelp, GameShare, HintBox, IncomingNote, LevelBar, SolvedCard, useGameClock, useIncomingGame } from './parts'

const LEVEL_KEYS: Record<Difficulty, StringKey> = { easy: 'sudoku.level.easy', medium: 'sudoku.level.medium', hard: 'sudoku.level.hard', expert: 'sudoku.level.expert' }
const HINT_KEYS: Record<NurikabeTechnique, StringKey> = {
  between: 'nurikabe.hint.between', complete: 'nurikabe.hint.complete', reach: 'nurikabe.hint.reach', block: 'nurikabe.hint.block', single: 'nurikabe.hint.single', wall: 'nurikabe.hint.wall',
}

/** A hint on screen: the words, the squares it points at, and what to mark or clear. */
interface ShownHint { text: string; cells: number[]; fill?: { index: number; mark: number }; remove?: number[] }

/** A dotted square is drawn with a small dot, wall as a solid block, so neither depends on colour. */
const Dot = () => <span className="nk-dot" aria-hidden="true" />

/**
 * Nurikabe: shade the wall so each number sits in a white island of that size, islands never touch, the wall is one piece and has no 2 by 2 block.
 * Every puzzle has one answer and can be solved without guessing. Nothing is stored.
 */
export function NurikabeScreen() {
  const { incoming, fromChat, leaveChat } = useIncomingGame('nurikabe')
  const sent = incoming && incoming.shared.game === 'nurikabe' ? incoming.shared : null
  const [level, setLevel] = useState<Difficulty>(sent?.puzzle.difficulty ?? 'easy')
  const [game, setGame] = useState(() => sent?.puzzle ?? generateNurikabe('easy'))
  const { rows, cols } = game
  const [marks, setMarks] = useState<number[]>(() => sent?.entries ?? Array(rows * cols).fill(BLANK))
  const [history, setHistory] = useState<number[][]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [hint, setHint] = useState<ShownHint | null>(null)
  const [hints, setHints] = useState(0)
  const boardRef = useRef<HTMLDivElement>(null)

  const bad = useMemo(() => nurikabeConflicts(game.clues, marks, rows, cols), [game, marks, rows, cols])
  const solved = isNurikabeSolved(game, marks)
  const { seconds, reset: resetClock } = useGameClock(!solved)

  const commit = (next: number[]) => {
    setHistory((h) => [...h, marks])
    setMarks(next)
    setHint(null)
  }
  const set = (i: number, mark: number) => {
    if (solved || marks[i] === mark || game.clues[i] > 0) return
    const m = [...marks]
    m[i] = mark
    commit(m)
  }
  /** Tapping a square steps blank, wall, dot, blank. */
  const cycle = (i: number) => {
    setSelected(i)
    set(i, (marks[i] + 1) % 3)
  }
  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory(history.slice(0, -1))
    setMarks(last)
    setHint(null)
  }

  const showHint = () => {
    const h = nextNurikabeHint(game, marks)
    if (!h) return
    setHints((x) => x + 1)
    if (h.kind === 'mistake') {
      setSelected(h.cells[0])
      setHint({ text: t(h.cells.length === 1 ? 'sudoku.hint.mistake1' : 'sudoku.hint.mistakeN', { n: h.cells.length }), cells: h.cells, remove: h.cells })
      return
    }
    const index = h.kind === 'move' ? h.move.index : h.index
    const mark = h.kind === 'move' ? h.move.mark : h.mark
    const pos = (k: number | undefined) => (k === undefined ? { r: 0, c: 0, d: 0 } : { r: Math.floor(k / cols) + 1, c: (k % cols) + 1, d: game.clues[k] })
    const where = { r: Math.floor(index / cols) + 1, c: (index % cols) + 1, v: t(mark === WALL ? 'nurikabe.toWall' : 'nurikabe.toWhite') }
    setSelected(index)
    if (h.kind === 'reveal') { setHint({ text: t('nurikabe.hint.reveal', where), cells: [index], fill: { index, mark } }); return }
    const [a, b] = h.move.cells
    const p2 = pos(a)
    const p3 = pos(b)
    setHint({ text: t(HINT_KEYS[h.move.technique], { ...where, d: p2.d, r2: p2.r, c2: p2.c, d2: p3.d, r3: p3.r, c3: p3.c }), cells: [index, ...h.move.cells], fill: { index, mark } })
  }

  const applyHint = () => {
    if (!hint) return
    const m = [...marks]
    if (hint.fill) m[hint.fill.index] = hint.fill.mark
    for (const i of hint.remove ?? []) m[i] = BLANK
    commit(m)
  }

  const newPuzzle = () => {
    leaveChat()
    const next = generateNurikabe(level)
    setGame(next)
    setMarks(Array(next.rows * next.cols).fill(BLANK))
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
    const r = Math.floor(at / cols)
    const c = at % cols
    const arrows: Record<string, number> = { ArrowLeft: c > 0 ? -1 : 0, ArrowRight: c < cols - 1 ? 1 : 0, ArrowUp: r > 0 ? -cols : 0, ArrowDown: r < rows - 1 ? cols : 0 }
    if (e.key in arrows) { e.preventDefault(); move(at + arrows[e.key]) }
    else if (selected === null) return
    else if (e.key === 'w' || e.key === 'W' || e.key === 'x' || e.key === 'X') set(selected, WALL)
    else if (e.key === 'd' || e.key === 'D' || e.key === '.') set(selected, DOT)
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); cycle(selected) }
    else if (e.key === 'Backspace' || e.key === 'Delete') set(selected, BLANK)
    else if (e.key === 'Escape') setHint(null)
  }

  const hintCells = new Set(hint?.cells)
  const tabbable = selected ?? 0
  const boardStyle = { '--n': cols } as CSSProperties

  return (
    <div className="page">
      <div className="sd">
        <LevelBar name="nurikabe-level" legend={t('sudoku.level.label')} levels={DIFFICULTIES.map((d) => ({ id: d, label: `${t(LEVEL_KEYS[d])} ${NURIKABE_LEVELS[d].cols}×${NURIKABE_LEVELS[d].rows}` }))} level={level} onLevel={setLevel}>
          <Button variant="secondary" onClick={newPuzzle}>{t('sudoku.new')}</Button>
        </LevelBar>
        {fromChat && <IncomingNote mode={fromChat} onFresh={newPuzzle} />}
        <p className="sd-meta">
          <span>{t(LEVEL_KEYS[game.difficulty])} {cols}×{rows}</span>
          <GameClock seconds={seconds} label={t('sudoku.time')} />
          <span>{t('sudoku.hintsUsed', { n: hints })}</span>
        </p>

        <div ref={boardRef} className="hi-board" style={boardStyle} role="grid" aria-label={t('nurikabe.board', { r: rows, c: cols })} onKeyDown={onKeyDown}>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} role="row" className="hi-row">
              {Array.from({ length: cols }, (_, c) => {
                const i = r * cols + c
                const m = marks[i]
                const classes = ['hi-cell']
                if (m === WALL) classes.push('hi-cell--shaded')
                if (m === DOT) classes.push('hi-cell--circled')
                if (i === selected) classes.push('hi-cell--selected')
                if (bad.has(i)) classes.push('hi-cell--repeat')
                if (hintCells.has(i)) classes.push('hi-cell--hint')
                const clue = game.clues[i]
                const state = clue > 0 ? t('nurikabe.island', { n: clue }) : m === WALL ? t('nurikabe.wall') : m === DOT ? t('nurikabe.dot') : t('sudoku.empty')
                const parts = [t('sudoku.cell', { r: r + 1, c: c + 1 }), state]
                if (bad.has(i)) parts.push(t('nurikabe.breaks'))
                return (
                  <div key={c} role="gridcell" data-i={i} tabIndex={i === tabbable ? 0 : -1} aria-selected={i === selected} aria-label={parts.join(', ')} className={classes.join(' ')} onClick={() => cycle(i)}>
                    {m === DOT && <Dot />}
                    {clue > 0 && <span className="hi-digit nk-clue">{clue}</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="sd-messages" role="status">
          {bad.size > 0 && !solved && <p className="sd-warn">{t('nurikabe.warn')}</p>}
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
          <button type="button" className="sd-tool" onClick={() => selected !== null && set(selected, BLANK)} disabled={selected === null || solved}><Erase aria-hidden="true" focusable="false" /><span>{t('sudoku.erase')}</span></button>
          <button type="button" className="sd-tool" onClick={showHint} disabled={solved}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('sudoku.hint')}</span></button>
          <GameShare shared={{ game: 'nurikabe', puzzle: game, entries: marks, notes: [] }} title={t('gx.game.nurikabe.title')} />
        </div>
        <div className="bn-pad" role="group" aria-label={t('nurikabe.pad')}>
          {[WALL, DOT].map((m) => (
            <button key={m} type="button" className="sd-digit hi-pad__key" disabled={selected === null || solved || game.clues[selected] > 0} onClick={() => selected !== null && set(selected, m)}>
              <span className={m === WALL ? 'hi-pad__swatch hi-pad__swatch--shaded' : 'hi-pad__swatch nk-pad__dot'} aria-hidden="true">{m === WALL ? '' : '•'}</span>
              <small>{t(m === WALL ? 'nurikabe.shade' : 'nurikabe.mark')}</small>
            </button>
          ))}
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('nurikabe.help.1')}</p>
          <p>{t('nurikabe.help.2')}</p>
        </GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
