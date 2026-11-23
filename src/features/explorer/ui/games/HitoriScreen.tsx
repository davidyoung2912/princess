import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { BLANK, CIRCLED, HITORI_LEVELS, SHADED, generateHitori, hitoriConflicts, isHitoriSolved, nextHitoriHint, type HitoriTechnique } from '../../../games/domain/hitori'
import { DIFFICULTIES, clock, type Difficulty } from '../../../games/domain/sudoku'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Erase, Lightbulb, Undo } from '../../../../shared/ui/icons'
import { MoreLinks } from '../Parts'
import { GameClock, GameHelp, GameShare, HintBox, IncomingNote, LevelBar, SolvedCard } from './parts'
import { useGameClock, useIncomingGame } from './gameHooks'

const LEVEL_KEYS: Record<Difficulty, StringKey> = { easy: 'sudoku.level.easy', medium: 'sudoku.level.medium', hard: 'sudoku.level.hard', expert: 'sudoku.level.expert' }
const HINT_KEYS: Record<HitoriTechnique, StringKey> = {
  alone: 'hitori.hint.alone', neighbour: 'hitori.hint.neighbour', match: 'hitori.hint.match', pair: 'hitori.hint.pair', sandwich: 'hitori.hint.sandwich', split: 'hitori.hint.split',
}

/** A hint on screen: the words, the squares it points at, and what to mark or clear. */
interface ShownHint { text: string; cells: number[]; fill?: { index: number; mark: number }; remove?: number[] }

/** Shaded squares are drawn as a solid block and circled squares as a ring, so neither depends on colour. */
const Mark = ({ mark }: { mark: number }) => <span className={mark === SHADED ? 'hi-mark hi-mark--shaded' : 'hi-mark hi-mark--circled'} aria-hidden="true" />

/**
 * Hitori: shade squares so no digit repeats among the squares left, no two shaded squares touch, and the squares left stay in one group.
 * Every puzzle has one answer and can be solved without guessing. Nothing is stored.
 */
export function HitoriScreen() {
  const { incoming, fromChat, leaveChat } = useIncomingGame('hitori')
  const sent = incoming && incoming.shared.game === 'hitori' ? incoming.shared : null
  const [level, setLevel] = useState<Difficulty>(sent?.puzzle.difficulty ?? 'easy')
  const [game, setGame] = useState(() => sent?.puzzle ?? generateHitori('easy'))
  const n = game.size
  const [marks, setMarks] = useState<number[]>(() => sent?.entries ?? Array(n * n).fill(BLANK))
  const [history, setHistory] = useState<number[][]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [hint, setHint] = useState<ShownHint | null>(null)
  const [hints, setHints] = useState(0)
  const boardRef = useRef<HTMLDivElement>(null)

  const bad = useMemo(() => hitoriConflicts(game.values, marks, n), [game, marks, n])
  const solved = isHitoriSolved(game.values, marks, n)
  const { seconds, reset: resetClock } = useGameClock(!solved)

  const commit = (next: number[]) => {
    setHistory((h) => [...h, marks])
    setMarks(next)
    setHint(null)
  }
  const set = (i: number, mark: number) => {
    if (solved || marks[i] === mark) return
    const m = [...marks]
    m[i] = mark
    commit(m)
  }
  /** Tapping a square steps blank, shaded, circled, blank. */
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
    const h = nextHitoriHint(game.values, marks, game.solution, n)
    if (!h) return
    setHints((x) => x + 1)
    if (h.kind === 'mistake') {
      setSelected(h.cells[0])
      setHint({ text: t(h.cells.length === 1 ? 'sudoku.hint.mistake1' : 'sudoku.hint.mistakeN', { n: h.cells.length }), cells: h.cells, remove: h.cells })
      return
    }
    const index = h.kind === 'move' ? h.move.index : h.index
    const mark = h.kind === 'move' ? h.move.mark : h.mark
    const where = { r: Math.floor(index / n) + 1, c: (index % n) + 1, d: game.values[index], v: t(mark === SHADED ? 'hitori.toShade' : 'hitori.toKeep') }
    setSelected(index)
    if (h.kind === 'reveal') { setHint({ text: t('hitori.hint.reveal', where), cells: [index], fill: { index, mark } }); return }
    const [a, b] = h.move.cells
    const other = { ...where, d2: a === undefined ? 0 : game.values[a], r2: a === undefined ? 0 : Math.floor(a / n) + 1, c2: a === undefined ? 0 : (a % n) + 1, r3: b === undefined ? 0 : Math.floor(b / n) + 1, c3: b === undefined ? 0 : (b % n) + 1 }
    setHint({ text: t(HINT_KEYS[h.move.technique], other), cells: [index, ...h.move.cells], fill: { index, mark } })
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
    const next = generateHitori(level)
    setGame(next)
    setMarks(Array(next.size * next.size).fill(BLANK))
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
    else if (e.key === 's' || e.key === 'S' || e.key === 'x' || e.key === 'X') set(selected, SHADED)
    else if (e.key === 'c' || e.key === 'C' || e.key === 'o' || e.key === 'O') set(selected, CIRCLED)
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); cycle(selected) }
    else if (e.key === 'Backspace' || e.key === 'Delete') set(selected, BLANK)
    else if (e.key === 'Escape') setHint(null)
  }

  const hintCells = new Set(hint?.cells)
  const tabbable = selected ?? 0
  const boardStyle = { '--n': n } as CSSProperties

  return (
    <div className="page">
      <div className="sd">
        <LevelBar name="hitori-level" legend={t('sudoku.level.label')} levels={DIFFICULTIES.map((d) => ({ id: d, label: `${t(LEVEL_KEYS[d])} ${HITORI_LEVELS[d].size}×${HITORI_LEVELS[d].size}` }))} level={level} onLevel={setLevel}>
          <Button variant="secondary" onClick={newPuzzle}>{t('sudoku.new')}</Button>
        </LevelBar>
        {fromChat && <IncomingNote mode={fromChat} onFresh={newPuzzle} />}
        <p className="sd-meta">
          <span>{t(LEVEL_KEYS[game.difficulty])} {n}×{n}</span>
          <GameClock seconds={seconds} label={t('sudoku.time')} />
          <span>{t('sudoku.hintsUsed', { n: hints })}</span>
        </p>

        <div ref={boardRef} className="hi-board" style={boardStyle} role="grid" aria-label={t('hitori.board', { n })} onKeyDown={onKeyDown}>
          {Array.from({ length: n }, (_, r) => (
            <div key={r} role="row" className="hi-row">
              {Array.from({ length: n }, (_, c) => {
                const i = r * n + c
                const m = marks[i]
                const classes = ['hi-cell']
                if (m === SHADED) classes.push('hi-cell--shaded')
                if (m === CIRCLED) classes.push('hi-cell--circled')
                if (i === selected) classes.push('hi-cell--selected')
                if (bad.has(i)) classes.push('hi-cell--repeat')
                if (hintCells.has(i)) classes.push('hi-cell--hint')
                const state = m === SHADED ? t('hitori.shaded') : m === CIRCLED ? t('hitori.circled') : t('sudoku.empty')
                const parts = [t('sudoku.cell', { r: r + 1, c: c + 1 }), String(game.values[i]), state]
                if (bad.has(i)) parts.push(t('hitori.repeats'))
                return (
                  <div key={c} role="gridcell" data-i={i} tabIndex={i === tabbable ? 0 : -1} aria-selected={i === selected} aria-label={parts.join(', ')} className={classes.join(' ')} onClick={() => cycle(i)}>
                    {m === CIRCLED && <Mark mark={m} />}
                    <span className="hi-digit">{game.values[i]}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="sd-messages" role="status">
          {bad.size > 0 && !solved && <p className="sd-warn">{t('hitori.warn')}</p>}
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
          <GameShare shared={{ game: 'hitori', puzzle: game, entries: marks, notes: [] }} title={t('gx.game.hitori.title')} done={solved} seconds={seconds} />
        </div>
        <div className="bn-pad" role="group" aria-label={t('hitori.pad')}>
          {[SHADED, CIRCLED].map((m) => (
            <button key={m} type="button" className="sd-digit hi-pad__key" disabled={selected === null || solved} onClick={() => selected !== null && set(selected, m)}>
              <span className={m === SHADED ? 'hi-pad__swatch hi-pad__swatch--shaded' : 'hi-pad__swatch hi-pad__swatch--circled'} aria-hidden="true">{m === SHADED ? '' : '5'}</span>
              <small>{t(m === SHADED ? 'hitori.shade' : 'hitori.circle')}</small>
            </button>
          ))}
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('hitori.help.1')}</p>
          <p>{t('hitori.help.2')}</p>
        </GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
