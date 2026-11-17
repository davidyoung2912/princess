import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { CROSSED, EMPTY, FILLED, NONOGRAM_LEVELS, generateNonogram, isNonogramSolved, lineIndexes, lineStatus, nextNonogramHint, type NonogramTechnique } from '../../../domain/games/nonogram'
import { DIFFICULTIES, clock, type Difficulty } from '../../../domain/games/sudoku'
import { t, type StringKey } from '../../../i18n'
import { Button } from '../../Button'
import { Erase, Lightbulb, Undo } from '../../icons'
import { MoreLinks } from '../Parts'
import { GameClock, GameHelp, HintBox, LevelBar, SolvedCard, useGameClock } from './parts'

const LEVEL_KEYS: Record<Difficulty, StringKey> = { easy: 'sudoku.level.easy', medium: 'sudoku.level.medium', hard: 'sudoku.level.hard', expert: 'sudoku.level.expert' }
const HINT_KEYS: Record<NonogramTechnique, StringKey> = {
  blank: 'nono.hint.blank', full: 'nono.hint.full', done: 'nono.hint.done', overlap: 'nono.hint.overlap', line: 'nono.hint.line',
}

/** A hint on screen: the words, the squares it points at, and what to mark or clear. */
interface ShownHint { text: string; cells: number[]; fill?: { index: number; mark: number }; remove?: number[] }

/** A drag in progress: the mark being painted, the line it is locked to and the marks as they will be when the finger lifts. */
interface Drag { value: number; from: number; axis: 'row' | 'col' | null; draft: number[] }

/**
 * Nonogram: the numbers beside each row and above each column give the runs of filled squares in that line. Fill squares to reveal the picture.
 * Every puzzle has one answer and can be solved without guessing. Nothing is stored.
 */
export function NonogramScreen() {
  const [level, setLevel] = useState<Difficulty>('easy')
  const [game, setGame] = useState(() => generateNonogram('easy'))
  const n = game.size
  const [marks, setMarks] = useState<number[]>(() => Array(n * n).fill(EMPTY))
  const [history, setHistory] = useState<number[][]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [tool, setTool] = useState<number>(FILLED)
  const [draft, setDraft] = useState<number[] | null>(null)
  const [hint, setHint] = useState<ShownHint | null>(null)
  const [hints, setHints] = useState(0)
  const drag = useRef<Drag | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  const shown = draft ?? marks
  const solved = isNonogramSolved(marks, game.solution)
  const { seconds, reset: resetClock } = useGameClock(!solved)
  const status = useMemo(() => ({
    rows: game.rows.map((clue, k) => lineStatus(clue, lineIndexes('row', k, n).map((i) => shown[i]))),
    cols: game.cols.map((clue, k) => lineStatus(clue, lineIndexes('col', k, n).map((i) => shown[i]))),
  }), [game, shown, n])

  const commit = (next: number[]) => {
    setHistory((h) => [...h, marks])
    setMarks(next)
    setHint(null)
  }
  /** Taps and keys: a square already holding the tool's mark goes blank, any other square takes it. */
  const toggle = (i: number, mark: number) => {
    if (solved) return
    const next = [...marks]
    next[i] = marks[i] === mark ? EMPTY : mark
    commit(next)
  }
  const set = (i: number, mark: number) => {
    if (solved || marks[i] === mark) return
    const next = [...marks]
    next[i] = mark
    commit(next)
  }
  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory(history.slice(0, -1))
    setMarks(last)
    setHint(null)
  }

  const showHint = () => {
    const h = nextNonogramHint(game, marks)
    if (!h) return
    setHints((x) => x + 1)
    if (h.kind === 'mistake') {
      setSelected(h.cells[0])
      setHint({ text: t(h.cells.length === 1 ? 'sudoku.hint.mistake1' : 'sudoku.hint.mistakeN', { n: h.cells.length }), cells: h.cells, remove: h.cells })
      return
    }
    const index = h.kind === 'move' ? h.move.index : h.index
    const mark = h.kind === 'move' ? h.move.mark : h.mark
    const where = { r: Math.floor(index / n) + 1, c: (index % n) + 1, v: t(mark === FILLED ? 'nono.toFill' : 'nono.toCross') }
    setSelected(index)
    if (h.kind === 'reveal') { setHint({ text: t('nono.hint.reveal', where), cells: [index], fill: { index, mark } }); return }
    const { kind, line } = h.move
    const clue = (kind === 'row' ? game.rows : game.cols)[line]
    const which = t(kind === 'row' ? 'nono.row' : 'nono.col', { n: line + 1 })
    setHint({ text: t(HINT_KEYS[h.move.technique], { ...where, line: which, clue: clue.length ? clue.join(' ') : '0' }), cells: [...new Set([index, ...lineIndexes(kind, line, n)])], fill: { index, mark } })
  }
  const applyHint = () => {
    if (!hint) return
    const next = [...marks]
    if (hint.fill) next[hint.fill.index] = hint.fill.mark
    for (const i of hint.remove ?? []) next[i] = EMPTY
    commit(next)
  }

  const newPuzzle = () => {
    const next = generateNonogram(level)
    setGame(next)
    setMarks(Array(next.size * next.size).fill(EMPTY))
    setHistory([])
    setSelected(null)
    setHint(null)
    setHints(0)
    setDraft(null)
    drag.current = null
    resetClock()
  }

  /* Dragging paints a straight line of squares: the first square decides whether to paint or to clear, and the first move decides row or column. */
  const cellAt = (e: PointerEvent): number | null => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-i]')
    return el && boardRef.current?.contains(el) ? Number(el.dataset.i) : null
  }
  const onPointerDown = (e: PointerEvent) => {
    if (solved || e.button > 0) return
    const i = cellAt(e)
    if (i === null) return
    const value = marks[i] === tool ? EMPTY : tool
    const next = [...marks]
    next[i] = value
    drag.current = { value, from: i, axis: null, draft: next }
    setSelected(i)
    setDraft(next)
    e.preventDefault()
  }
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const i = cellAt(e)
    if (i === null || i === d.from) return
    const sameRow = Math.floor(i / n) === Math.floor(d.from / n)
    const sameCol = i % n === d.from % n
    const axis = d.axis ?? (sameRow ? 'row' : sameCol ? 'col' : null)
    if (!axis || (axis === 'row' ? !sameRow : !sameCol)) return
    d.axis = axis
    // Painting only fills empty squares; clearing only clears squares holding the tool's mark.
    if (marks[i] === (d.value === EMPTY ? tool : EMPTY) && d.draft[i] !== d.value) {
      d.draft = [...d.draft]
      d.draft[i] = d.value
      setDraft(d.draft)
    }
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    setDraft(null)
    if (d.draft.some((v, i) => v !== marks[i])) commit(d.draft)
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
    else if (e.key === 'f' || e.key === 'F') toggle(selected, FILLED)
    else if (e.key === 'x' || e.key === 'X') toggle(selected, CROSSED)
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(selected, tool) }
    else if (e.key === 'Backspace' || e.key === 'Delete') set(selected, EMPTY)
    else if (e.key === 'Escape') setHint(null)
  }

  const hintCells = new Set(hint?.cells)
  const tabbable = selected ?? 0
  const rowClueMax = Math.max(1, ...game.rows.map((c) => c.length))
  const colClueMax = Math.max(1, ...game.cols.map((c) => c.length))
  const boardStyle = { '--n': n, '--rc': rowClueMax, '--cc': colClueMax } as CSSProperties
  const clueText = (clue: readonly number[]) => (clue.length ? clue.join(', ') : '0')

  return (
    <div className="page">
      <div className="sd">
        <LevelBar name="nonogram-level" legend={t('sudoku.level.label')} levels={DIFFICULTIES.map((d) => ({ id: d, label: `${t(LEVEL_KEYS[d])} ${NONOGRAM_LEVELS[d].size}×${NONOGRAM_LEVELS[d].size}` }))} level={level} onLevel={setLevel}>
          <Button variant="secondary" onClick={newPuzzle}>{t('sudoku.new')}</Button>
        </LevelBar>
        <p className="sd-meta">
          <span>{t(LEVEL_KEYS[game.difficulty])} {n}×{n}</span>
          <GameClock seconds={seconds} label={t('sudoku.time')} />
          <span>{t('sudoku.hintsUsed', { n: hints })}</span>
        </p>

        <div ref={boardRef} className="nn-board" style={boardStyle} role="grid" aria-label={t('nono.board', { n })} onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <div role="row" className="nn-row nn-row--head">
            <span className="nn-corner" aria-hidden="true" />
            {game.cols.map((clue, k) => (
              <span key={k} role="columnheader" className={`nn-clue nn-clue--col nn-clue--${status.cols[k]}`} aria-label={t('nono.colClue', { n: k + 1, clue: clueText(clue), state: t(status.cols[k] === 'bad' ? 'nono.bad' : status.cols[k] === 'met' ? 'nono.met' : 'nono.open') })}>
                {(clue.length ? clue : [0]).map((v, j) => <b key={j} aria-hidden="true">{v}</b>)}
              </span>
            ))}
          </div>
          {Array.from({ length: n }, (_, r) => (
            <div key={r} role="row" className="nn-row">
              <span role="rowheader" className={`nn-clue nn-clue--row nn-clue--${status.rows[r]}`} aria-label={t('nono.rowClue', { n: r + 1, clue: clueText(game.rows[r]), state: t(status.rows[r] === 'bad' ? 'nono.bad' : status.rows[r] === 'met' ? 'nono.met' : 'nono.open') })}>
                {(game.rows[r].length ? game.rows[r] : [0]).map((v, j) => <b key={j} aria-hidden="true">{v}</b>)}
              </span>
              {Array.from({ length: n }, (_, c) => {
                const i = r * n + c
                const m = shown[i]
                const classes = ['nn-cell']
                if (m === FILLED) classes.push('nn-cell--filled')
                if (m === CROSSED) classes.push('nn-cell--crossed')
                if ((c + 1) % 5 === 0 && c < n - 1) classes.push('nn-cell--vline')
                if ((r + 1) % 5 === 0 && r < n - 1) classes.push('nn-cell--hline')
                if (i === selected) classes.push('nn-cell--selected')
                if (hintCells.has(i)) classes.push('nn-cell--hint')
                const state = m === FILLED ? t('nono.filled') : m === CROSSED ? t('nono.crossed') : t('sudoku.empty')
                return (
                  <div key={c} role="gridcell" data-i={i} tabIndex={i === tabbable ? 0 : -1} aria-selected={i === selected} aria-label={`${t('sudoku.cell', { r: r + 1, c: c + 1 })}, ${state}`} className={classes.join(' ')}>
                    {m === CROSSED && <span aria-hidden="true">×</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="sd-messages" role="status">
          {(status.rows.includes('bad') || status.cols.includes('bad')) && !solved && <p className="sd-warn">{t('nono.warn')}</p>}
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
          <button type="button" className="sd-tool" onClick={() => selected !== null && set(selected, EMPTY)} disabled={selected === null || solved}><Erase aria-hidden="true" focusable="false" /><span>{t('sudoku.erase')}</span></button>
          <button type="button" className="sd-tool" onClick={showHint} disabled={solved}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('sudoku.hint')}</span></button>
        </div>
        <div className="bn-pad" role="group" aria-label={t('nono.pad')}>
          {[FILLED, CROSSED].map((m) => (
            <button key={m} type="button" className="sd-digit nn-pad__key" aria-pressed={tool === m} onClick={() => setTool(m)}>
              <span className={m === FILLED ? 'nn-pad__swatch nn-pad__swatch--filled' : 'nn-pad__swatch'} aria-hidden="true">{m === FILLED ? '' : '×'}</span>
              <small>{t(m === FILLED ? 'nono.fill' : 'nono.cross')}</small>
            </button>
          ))}
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('nono.help.1')}</p>
          <p>{t('nono.help.2')}</p>
        </GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
