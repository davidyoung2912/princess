import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { KENKEN_LEVELS, cageLabel, generateKenKen, isKenKenSolved, kenkenConflicts, kenkenDeadCells, nextKenKenHint, type KenKenTechnique, type Op } from '../../../domain/games/kenken'
import { DIFFICULTIES, bit, clock, type Difficulty } from '../../../domain/games/sudoku'
import { t, type StringKey } from '../../../i18n'
import { Button } from '../../Button'
import { Erase, Lightbulb, Notes, Undo } from '../../icons'
import { MoreLinks } from '../Parts'
import { GameClock, GameHelp, GameShare, HintBox, IncomingNote, LevelBar, SolvedCard } from './parts'
import { useGameClock, useIncomingGame } from './gameHooks'

const LEVEL_KEYS: Record<Difficulty, StringKey> = { easy: 'sudoku.level.easy', medium: 'sudoku.level.medium', hard: 'sudoku.level.hard', expert: 'sudoku.level.expert' }
const HINT_KEYS: Record<KenKenTechnique, StringKey> = { naked: 'kenken.hint.naked', row: 'kenken.hint.row', column: 'kenken.hint.column', cage: 'kenken.hint.cage', cageRow: 'kenken.hint.cageRow', cageColumn: 'kenken.hint.cageColumn' }
const OP_KEYS: Record<Op, StringKey> = { add: 'kenken.op.add', sub: 'kenken.op.sub', mul: 'kenken.op.mul', div: 'kenken.op.div', given: 'kenken.op.given' }

interface Snapshot { entries: number[]; notes: number[] }
/** A hint on screen: the words, the cells it points at, and what to fill in or clear. */
interface ShownHint { text: string; cells: number[]; fill?: { index: number; value: number }; remove?: number[] }

/**
 * KenKen: fill the grid so every row and column holds each digit once, and every bold cage makes its target with its operation. Every puzzle has one answer and can be solved without guessing. Nothing is stored.
 */
export function KenKenScreen() {
  const { incoming, fromChat, leaveChat } = useIncomingGame('kenken')
  const sent = incoming && incoming.shared.game === 'kenken' ? incoming.shared : null
  const [level, setLevel] = useState<Difficulty>(sent?.puzzle.difficulty ?? 'easy')
  const [game, setGame] = useState(() => sent?.puzzle ?? generateKenKen('easy'))
  const n = game.size
  const digits = useMemo(() => Array.from({ length: n }, (_, k) => k + 1), [n])
  const [entries, setEntries] = useState<number[]>(() => sent?.entries ?? Array(n * n).fill(0))
  const [notes, setNotes] = useState<number[]>(() => sent?.notes ?? Array(n * n).fill(0))
  const [history, setHistory] = useState<Snapshot[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [pencil, setPencil] = useState(false)
  const [hint, setHint] = useState<ShownHint | null>(null)
  const [hints, setHints] = useState(0)
  const boardRef = useRef<HTMLDivElement>(null)

  const grid = useMemo(() => game.puzzle.map((v, i) => v || entries[i]), [game, entries])
  const repeated = useMemo(() => kenkenConflicts(grid, n, game.cages), [grid, n, game.cages])
  const dead = useMemo(() => kenkenDeadCells(grid, n, game.cages), [grid, n, game.cages])
  const solved = isKenKenSolved(grid, game.solution)
  const { seconds, reset: resetClock } = useGameClock(!solved)
  const given = (i: number) => game.puzzle[i] !== 0

  const cageOf = useMemo(() => { const m = Array<number>(n * n).fill(-1); game.cages.forEach((c, k) => c.cells.forEach((i) => { m[i] = k })); return m }, [game.cages, n])

  const peersOf = (i: number) => {
    const r = Math.floor(i / n)
    const c = i % n
    return Array.from({ length: n }, (_, k) => [r * n + k, k * n + c]).flat().filter((p) => p !== i)
  }

  const commit = (nextEntries: number[], nextNotes: number[]) => {
    setHistory((h) => [...h, { entries, notes }])
    setEntries(nextEntries)
    setNotes(nextNotes)
    setHint(null)
  }

  const enter = (d: number) => {
    if (selected === null || given(selected) || solved || d < 1 || d > n) return
    const e = [...entries]
    const m = [...notes]
    if (pencil && e[selected] === 0) m[selected] ^= bit(d)
    else if (!pencil) {
      e[selected] = e[selected] === d ? 0 : d
      m[selected] = 0
      // Placing a digit takes it out of the notes of every square in its row and column.
      if (e[selected] !== 0) for (const p of peersOf(selected)) m[p] &= ~bit(d)
    } else return
    commit(e, m)
  }

  const erase = () => {
    if (selected === null || given(selected) || solved || (entries[selected] === 0 && notes[selected] === 0)) return
    const e = [...entries]
    const m = [...notes]
    e[selected] = 0
    m[selected] = 0
    commit(e, m)
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
    const h = nextKenKenHint(grid, game.solution, n, game.cages)
    if (!h) return
    setHints((x) => x + 1)
    if (h.kind === 'mistake') {
      setSelected(h.cells[0])
      setHint({ text: t(h.cells.length === 1 ? 'sudoku.hint.mistake1' : 'sudoku.hint.mistakeN', { n: h.cells.length }), cells: h.cells, remove: h.cells })
      return
    }
    const index = h.kind === 'move' ? h.move.index : h.index
    const value = h.kind === 'move' ? h.move.value : h.value
    const where = { r: Math.floor(index / n) + 1, c: (index % n) + 1, d: value }
    setSelected(index)
    if (h.kind === 'reveal') { setHint({ text: t('kenken.hint.reveal', where), cells: [index], fill: { index, value } }); return }
    const { move } = h
    const cage = move.cage !== undefined && move.cage >= 0 ? game.cages[move.cage] : undefined
    const text = cage && cage.op !== 'given' && (move.technique === 'cage' || move.technique === 'cageRow' || move.technique === 'cageColumn')
      ? t(HINT_KEYS[move.technique], { ...where, target: cage.target, op: t(OP_KEYS[cage.op]), digits: h.digits.join(', ') })
      : t(move.technique === 'row' ? 'kenken.hint.row' : move.technique === 'column' ? 'kenken.hint.column' : 'kenken.hint.naked', where)
    setHint({ text, cells: move.cells, fill: { index, value } })
  }

  const applyHint = () => {
    if (!hint) return
    const e = [...entries]
    const m = [...notes]
    if (hint.fill) {
      e[hint.fill.index] = hint.fill.value
      m[hint.fill.index] = 0
      for (const p of peersOf(hint.fill.index)) m[p] &= ~bit(hint.fill.value)
    }
    for (const i of hint.remove ?? []) { e[i] = 0; m[i] = 0 }
    commit(e, m)
  }

  const newPuzzle = () => {
    leaveChat()
    const next = generateKenKen(level)
    setGame(next)
    setEntries(Array(next.size * next.size).fill(0))
    setNotes(Array(next.size * next.size).fill(0))
    setHistory([])
    setSelected(null)
    setHint(null)
    setHints(0)
    setPencil(false)
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
    else if (/^[1-9]$/.test(e.key)) enter(Number(e.key))
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') erase()
    else if (e.key === 'n' || e.key === 'N') setPencil((p) => !p)
    else if (e.key === 'Escape') setHint(null)
  }

  const hintCells = new Set(hint?.cells)
  const remaining = (d: number) => n - grid.filter((x) => x === d).length
  const picked = selected === null ? 0 : grid[selected]
  const tabbable = selected ?? 0
  const boardStyle = { '--n': n } as CSSProperties

  return (
    <div className="page">
      <div className="sd">
        <LevelBar name="kenken-level" legend={t('sudoku.level.label')} levels={DIFFICULTIES.map((d) => ({ id: d, label: `${t(LEVEL_KEYS[d])} ${KENKEN_LEVELS[d].size}×${KENKEN_LEVELS[d].size}` }))} level={level} onLevel={setLevel}>
          <Button variant="secondary" onClick={newPuzzle}>{t('sudoku.new')}</Button>
        </LevelBar>
        {fromChat && <IncomingNote mode={fromChat} onFresh={newPuzzle} />}
        <p className="sd-meta">
          <span>{t(LEVEL_KEYS[game.difficulty])} {n}×{n}</span>
          <GameClock seconds={seconds} label={t('sudoku.time')} />
          <span>{t('sudoku.hintsUsed', { n: hints })}</span>
        </p>

        <div ref={boardRef} className="kk-board" style={boardStyle} role="grid" aria-label={t('kenken.board', { n })} onKeyDown={onKeyDown}>
          {Array.from({ length: n }, (_, r) => (
            <div key={r} role="row" className="kk-row">
              {Array.from({ length: n }, (_, c) => {
                const i = r * n + c
                const v = grid[i]
                const classes = ['kk-cell']
                if (given(i)) classes.push('kk-cell--given')
                if (picked !== 0 && v === picked) classes.push('kk-cell--same')
                if (i === selected) classes.push('kk-cell--selected')
                if (repeated.has(i)) classes.push('kk-cell--repeat')
                if (dead.has(i)) classes.push('kk-cell--dead')
                if (hintCells.has(i)) classes.push('kk-cell--hint')
                const cage = game.cages[cageOf[i]]
                const sides = (['t', 'r', 'b', 'l'] as const).filter((side) => {
                  const other = side === 't' ? (r === 0 ? -1 : i - n) : side === 'b' ? (r === n - 1 ? -1 : i + n) : side === 'l' ? (c === 0 ? -1 : i - 1) : (c === n - 1 ? -1 : i + 1)
                  return other < 0 || cageOf[other] !== cageOf[i]
                })
                const label = cage.cells[0] === i ? cageLabel(cage) : ''
                const marks = v === 0 ? digits.filter((d) => notes[i] & bit(d)) : []
                const parts = [t('sudoku.cell', { r: r + 1, c: c + 1 }), v === 0 ? t('sudoku.empty') : `${given(i) ? t('sudoku.given') : t('sudoku.entered')} ${v}`, ...(cage.op === 'given' ? [] : [t('kenken.cellCage', { n: cage.cells.length, target: cage.target, op: t(OP_KEYS[cage.op]) })])]
                if (marks.length) parts.push(`${t('sudoku.notes')} ${marks.join(' ')}`)
                if (repeated.has(i)) parts.push(t('kenken.repeats'))
                if (dead.has(i)) parts.push(t('sudoku.deadCell'))
                return (
                  <div key={c} role="gridcell" data-i={i} tabIndex={i === tabbable ? 0 : -1} aria-selected={i === selected} aria-label={parts.join(', ')} className={classes.join(' ')} onClick={() => setSelected(i)}>
                    {v !== 0 ? <span aria-hidden="true">{v}</span> : marks.length > 0 && (
                      <span className="sd-notes" aria-hidden="true">{digits.map((d) => <i key={d}>{notes[i] & bit(d) ? d : ''}</i>)}</span>
                    )}
                    <span className={`kk-cage ${sides.map((x) => `kk-cage--${x}`).join(' ')}`} aria-hidden="true">{label && <b>{label}</b>}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="sd-messages" role="status">
          {dead.size > 0 && !solved && <p className="sd-warn">{t('kenken.dead')}</p>}
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
          <GameShare shared={{ game: 'kenken', puzzle: game, entries: entries, notes }} title={t('gx.game.kenken.title')} done={solved} seconds={seconds} />
        </div>
        <div className="sd-pad kk-pad" style={boardStyle} role="group" aria-label={t('sudoku.pad')}>
          {digits.map((d) => (
            <button key={d} type="button" className="sd-digit" disabled={remaining(d) <= 0 || selected === null || solved} aria-label={t('sudoku.digit', { d, n: Math.max(0, remaining(d)) })} onClick={() => enter(d)}>
              <span aria-hidden="true">{d}</span>
              <small aria-hidden="true">{Math.max(0, remaining(d))}</small>
            </button>
          ))}
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('kenken.help.1')}</p>
          <p>{t('kenken.help.2')}</p>
        </GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
