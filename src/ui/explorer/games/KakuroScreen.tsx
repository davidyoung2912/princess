import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { KAKURO_LEVELS, generateKakuro, indexRuns, isKakuroSolved, kakuroConflicts, kakuroDeadCells, nextKakuroHint, type KakuroTechnique } from '../../../domain/games/kakuro'
import { DIFFICULTIES, bit, clock, type Difficulty } from '../../../domain/games/sudoku'
import { t, type StringKey } from '../../../i18n'
import { Button } from '../../Button'
import { Erase, Lightbulb, Notes, Undo } from '../../icons'
import { MoreLinks } from '../Parts'
import { GameClock, GameHelp, GameShare, HintBox, IncomingNote, LevelBar, SolvedCard } from './parts'
import { useGameClock, useIncomingGame } from './gameHooks'

const LEVEL_KEYS: Record<Difficulty, StringKey> = { easy: 'sudoku.level.easy', medium: 'sudoku.level.medium', hard: 'sudoku.level.hard', expert: 'sudoku.level.expert' }
const HINT_KEYS: Record<KakuroTechnique, StringKey> = { last: 'kakuro.hint.last', cross: 'kakuro.hint.cross', deep: 'kakuro.hint.deep' }
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

interface Snapshot { entries: number[]; notes: number[] }
/** A hint on screen: the words, the cells it points at, and what to fill in or clear. */
interface ShownHint { text: string; cells: number[]; fill?: { index: number; value: number }; remove?: number[] }

/** "7 and 9", "1, 2 and 4". */
const listDigits = (d: readonly number[]): string => (d.length > 1 ? `${d.slice(0, -1).join(', ')} ${t('kakuro.and')} ${d[d.length - 1]}` : `${d[0] ?? ''}`)

/**
 * Kakuro: fill the white squares with 1 to 9 so every run adds to its clue with no digit repeated in the run. Every puzzle has one answer and can be solved without guessing. Nothing is stored.
 */
export function KakuroScreen() {
  const { incoming, fromChat, leaveChat } = useIncomingGame('kakuro')
  const sent = incoming && incoming.shared.game === 'kakuro' ? incoming.shared : null
  const [level, setLevel] = useState<Difficulty>(sent?.puzzle.difficulty ?? 'easy')
  const [game, setGame] = useState(() => sent?.puzzle ?? generateKakuro('easy'))
  const n = game.size
  const [entries, setEntries] = useState<number[]>(() => sent?.entries ?? Array(n * n).fill(0))
  const [notes, setNotes] = useState<number[]>(() => sent?.notes ?? Array(n * n).fill(0))
  const [history, setHistory] = useState<Snapshot[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [pencil, setPencil] = useState(false)
  const [hint, setHint] = useState<ShownHint | null>(null)
  const [hints, setHints] = useState(0)
  const boardRef = useRef<HTMLDivElement>(null)

  const grid = useMemo(() => game.puzzle.map((v, i) => v || entries[i]), [game, entries])
  const wrong = useMemo(() => kakuroConflicts(grid, game.runs), [grid, game.runs])
  const dead = useMemo(() => kakuroDeadCells(grid, n, game.runs), [grid, n, game.runs])
  const solved = isKakuroSolved(grid, game.solution)
  const { seconds, reset: resetClock } = useGameClock(!solved)
  const given = (i: number) => game.puzzle[i] !== 0
  const runAt = useMemo(() => indexRuns(game.runs, n), [game.runs, n])
  /** The clue each black square carries: the across run to its right and the down run below it. */
  const clues = useMemo(() => {
    const m = new Map<number, { across?: number; down?: number }>()
    game.runs.forEach((r) => m.set(r.clue, { ...m.get(r.clue), [r.across ? 'across' : 'down']: r.sum }))
    return m
  }, [game.runs])

  const peersOf = (i: number) => [runAt.across[i], runAt.down[i]].filter((k) => k >= 0).flatMap((k) => game.runs[k].cells).filter((p) => p !== i)
  const selectedRuns = useMemo(() => new Set(selected === null ? [] : [runAt.across[selected], runAt.down[selected]].filter((k) => k >= 0).flatMap((k) => game.runs[k].cells)), [selected, runAt, game.runs])

  const commit = (nextEntries: number[], nextNotes: number[]) => {
    setHistory((h) => [...h, { entries, notes }])
    setEntries(nextEntries)
    setNotes(nextNotes)
    setHint(null)
  }

  const enter = (d: number) => {
    if (selected === null || given(selected) || solved || d < 1 || d > 9) return
    const e = [...entries]
    const m = [...notes]
    if (pencil && e[selected] === 0) m[selected] ^= bit(d)
    else if (!pencil) {
      e[selected] = e[selected] === d ? 0 : d
      m[selected] = 0
      // Placing a digit takes it out of the notes of every square in its two runs.
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
    const h = nextKakuroHint(grid, game.solution, n, game.runs, game.white)
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
    if (h.kind === 'reveal') { setHint({ text: t('kakuro.hint.reveal', where), cells: [index], fill: { index, value } }); return }
    const { move } = h
    const used = move.runs.map((k) => game.runs[k])
    const runTexts = used.map((run, j) => t(h.digits[j].length === run.cells.length ? 'kakuro.run.only' : 'kakuro.run.some', { dir: t(run.across ? 'kakuro.across' : 'kakuro.down'), sum: run.sum, n: run.cells.length, digits: listDigits(h.digits[j]) }))
    const text = move.technique === 'last'
      ? t(HINT_KEYS.last, { ...where, dir: t(used[0].across ? 'kakuro.across' : 'kakuro.down'), sum: used[0].sum, rest: used[0].sum - value })
      : t(HINT_KEYS[move.technique], { ...where, runs: runTexts.join(' ') })
    setHint({ text, cells: used.flatMap((r) => [...r.cells]), fill: { index, value } })
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
    const next = generateKakuro(level)
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
    else if (/^[1-9]$/.test(e.key)) enter(Number(e.key))
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') erase()
    else if (e.key === 'n' || e.key === 'N') setPencil((p) => !p)
    else if (e.key === 'Escape') setHint(null)
  }

  const hintCells = new Set(hint?.cells)
  const picked = selected === null ? 0 : grid[selected]

  return (
    <div className="page">
      <div className="sd">
        <LevelBar name="kakuro-level" legend={t('sudoku.level.label')} levels={DIFFICULTIES.map((d) => ({ id: d, label: `${t(LEVEL_KEYS[d])} ${KAKURO_LEVELS[d].size}×${KAKURO_LEVELS[d].size}` }))} level={level} onLevel={setLevel}>
          <Button variant="secondary" onClick={newPuzzle}>{t('sudoku.new')}</Button>
        </LevelBar>
        {fromChat && <IncomingNote mode={fromChat} onFresh={newPuzzle} />}
        <p className="sd-meta">
          <span>{t(LEVEL_KEYS[game.difficulty])} {n}×{n}</span>
          <GameClock seconds={seconds} label={t('sudoku.time')} />
          <span>{t('sudoku.hintsUsed', { n: hints })}</span>
        </p>

        <div ref={boardRef} className="kr-board" style={{ '--n': n } as CSSProperties} role="grid" aria-label={t('kakuro.board', { n })} onKeyDown={onKeyDown}>
          {Array.from({ length: n }, (_, r) => (
            <div key={r} role="row" className="kr-row">
              {Array.from({ length: n }, (_, c) => {
                const i = r * n + c
                const where = t('sudoku.cell', { r: r + 1, c: c + 1 })
                if (!game.white[i]) {
                  const clue = clues.get(i)
                  const spoken = clue ? [t('kakuro.clue'), ...(clue.across !== undefined ? [t('kakuro.clue.across', { sum: clue.across })] : []), ...(clue.down !== undefined ? [t('kakuro.clue.down', { sum: clue.down })] : [])].join(', ') : t('kakuro.black')
                  return (
                    <div key={c} role="gridcell" aria-label={`${where}, ${spoken}`} className={`kr-cell kr-cell--black${clue ? ' kr-cell--clue' : ''}`}>
                      {clue?.down !== undefined && <b className="kr-down" aria-hidden="true">{clue.down}</b>}
                      {clue?.across !== undefined && <b className="kr-across" aria-hidden="true">{clue.across}</b>}
                    </div>
                  )
                }
                const v = grid[i]
                const classes = ['kr-cell']
                if (given(i)) classes.push('kr-cell--given')
                if (selectedRuns.has(i)) classes.push('kr-cell--run')
                if (picked !== 0 && v === picked) classes.push('kr-cell--same')
                if (i === selected) classes.push('kr-cell--selected')
                if (wrong.has(i)) classes.push('kr-cell--repeat')
                if (dead.has(i)) classes.push('kr-cell--dead')
                if (hintCells.has(i)) classes.push('kr-cell--hint')
                const ra = game.runs[runAt.across[i]]
                const rd = game.runs[runAt.down[i]]
                const marks = v === 0 ? DIGITS.filter((d) => notes[i] & bit(d)) : []
                const parts = [where, v === 0 ? t('sudoku.empty') : `${given(i) ? t('sudoku.given') : t('sudoku.entered')} ${v}`, t('kakuro.cellRuns', { a: ra.cells.length, as: ra.sum, d: rd.cells.length, ds: rd.sum })]
                if (marks.length) parts.push(`${t('sudoku.notes')} ${marks.join(' ')}`)
                if (wrong.has(i)) parts.push(t('kakuro.repeats'))
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
          {dead.size > 0 && !solved && <p className="sd-warn">{t('kakuro.dead')}</p>}
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
          <GameShare shared={{ game: 'kakuro', puzzle: game, entries: entries, notes }} title={t('gx.game.kakuro.title')} done={solved} seconds={seconds} />
        </div>
        <div className="sd-pad" role="group" aria-label={t('sudoku.pad')}>
          {DIGITS.map((d) => (
            <button key={d} type="button" className="sd-digit" disabled={selected === null || solved} aria-label={t('kakuro.digit', { d })} onClick={() => enter(d)}>
              <span aria-hidden="true">{d}</span>
            </button>
          ))}
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('kakuro.help.1')}</p>
          <p>{t('kakuro.help.2')}</p>
        </GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
