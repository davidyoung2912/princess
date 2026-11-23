import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { BLANK, CROSS, LINE, NONE, SLITHER_LEVELS, generateSlitherlink, isSlitherSolved, moveEdge, nextSlitherHint, slitherConflicts, topology, type SlitherTechnique } from '../../../games/domain/slitherlink'
import { DIFFICULTIES, clock, type Difficulty } from '../../../games/domain/sudoku'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Erase, Lightbulb, Undo } from '../../../../shared/ui/icons'
import { MoreLinks } from '../Parts'
import { GameClock, GameHelp, GameShare, HintBox, IncomingNote, LevelBar, SolvedCard } from './parts'
import { useGameClock, useIncomingGame } from './gameHooks'

const LEVEL_KEYS: Record<Difficulty, StringKey> = { easy: 'sudoku.level.easy', medium: 'sudoku.level.medium', hard: 'sudoku.level.hard', expert: 'sudoku.level.expert' }
const HINT_KEYS: Record<SlitherTechnique, StringKey> = {
  full: 'slither.hint.full', need: 'slither.hint.need', dotFull: 'slither.hint.dotFull', dotContinue: 'slither.hint.dotContinue', dotDead: 'slither.hint.dotDead',
  closing: 'slither.hint.closing', threes: 'slither.hint.threes', corner: 'slither.hint.corner', finish: 'slither.hint.finish',
}
/** Dot rules point at a dot; every other rule points at a square. */
const DOT_RULES = new Set<SlitherTechnique>(['dotFull', 'dotContinue', 'dotDead', 'closing'])

/** Board drawing units: one square is U wide, with P of room around the dots. */
const U = 10
const P = 4

/** A hint on screen: the words, the edges it points at, and what to mark or clear. */
interface ShownHint { text: string; edges: number[]; fill?: { edge: number; mark: number }; remove?: number[] }

/**
 * Slitherlink: draw one closed loop along the lines between dots so every number says how many of its sides the loop uses.
 * Every puzzle has one answer and can be solved without guessing. Nothing is stored.
 */
export function SlitherlinkScreen() {
  const { incoming, fromChat, leaveChat } = useIncomingGame('slitherlink')
  const sent = incoming && incoming.shared.game === 'slitherlink' ? incoming.shared : null
  const [level, setLevel] = useState<Difficulty>(sent?.puzzle.difficulty ?? 'easy')
  const [game, setGame] = useState(() => sent?.puzzle ?? generateSlitherlink('easy'))
  const n = game.size
  const topo = topology(n)
  const [marks, setMarks] = useState<number[]>(() => sent?.entries ?? Array(topo.edgeDots.length).fill(BLANK))
  const [history, setHistory] = useState<number[][]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [hint, setHint] = useState<ShownHint | null>(null)
  const [hints, setHints] = useState(0)
  const boardRef = useRef<HTMLDivElement>(null)

  const conflicts = useMemo(() => slitherConflicts(game.clues, marks, n), [game, marks, n])
  const solved = isSlitherSolved(game.clues, marks, n)
  const { seconds, reset: resetClock } = useGameClock(!solved)

  /** Lines in red: a closed loop that is wrong, and any line that reaches a dot with three lines or a dead end. */
  const badEdges = useMemo(() => {
    const bad = new Set(conflicts.edges)
    conflicts.dots.forEach((d) => topo.dotEdges[d].forEach((e) => { if (marks[e] === LINE) bad.add(e) }))
    return bad
  }, [conflicts, marks, topo])

  const commit = (next: number[]) => {
    setHistory((h) => [...h, marks])
    setMarks(next)
    setHint(null)
  }
  const set = (e: number, mark: number) => {
    if (solved || marks[e] === mark) return
    const m = [...marks]
    m[e] = mark
    commit(m)
  }
  /** Tapping an edge steps empty, line, cross, empty. */
  const cycle = (e: number) => {
    setSelected(e)
    set(e, (marks[e] + 1) % 3)
  }
  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory(history.slice(0, -1))
    setMarks(last)
    setHint(null)
  }

  const dotName = (d: number) => ({ r: Math.floor(d / (n + 1)) + 1, c: (d % (n + 1)) + 1 })
  const edgeName = (e: number) => {
    const [a, b] = topo.edgeDots[e]
    return t('slither.edge', { r1: dotName(a).r, c1: dotName(a).c, r2: dotName(b).r, c2: dotName(b).c })
  }
  const verb = (mark: number) => t(mark === LINE ? 'slither.toLine' : 'slither.toCross')

  const showHint = () => {
    const h = nextSlitherHint(game.clues, marks, game.solution, n)
    if (!h) return
    setHints((x) => x + 1)
    if (h.kind === 'mistake') {
      setSelected(h.edges[0])
      setHint({ text: t(h.edges.length === 1 ? 'sudoku.hint.mistake1' : 'sudoku.hint.mistakeN', { n: h.edges.length }), edges: h.edges, remove: h.edges })
      return
    }
    if (h.kind === 'reveal') {
      setSelected(h.edge)
      setHint({ text: t('slither.hint.reveal', { e: edgeName(h.edge), v: verb(h.mark) }), edges: [h.edge], fill: { edge: h.edge, mark: h.mark } })
      return
    }
    const { edge, mark, technique, at } = h.move
    const place = at < 0 ? { r: 0, c: 0, k: 0 } : DOT_RULES.has(technique) ? { ...dotName(at), k: 0 } : { r: Math.floor(at / n) + 1, c: (at % n) + 1, k: game.clues[at] }
    setSelected(edge)
    setHint({ text: t(HINT_KEYS[technique], { ...place, e: edgeName(edge), v: verb(mark) }), edges: [edge], fill: { edge, mark } })
  }

  const applyHint = () => {
    if (!hint) return
    const m = [...marks]
    if (hint.fill) m[hint.fill.edge] = hint.fill.mark
    for (const e of hint.remove ?? []) m[e] = BLANK
    commit(m)
  }

  const newPuzzle = () => {
    leaveChat()
    const next = generateSlitherlink(level)
    setGame(next)
    setMarks(Array(next.solution.length).fill(BLANK))
    setHistory([])
    setSelected(null)
    setHint(null)
    setHints(0)
    resetClock()
  }

  const move = (e: number) => {
    setSelected(e)
    boardRef.current?.querySelector<HTMLElement>(`[data-e="${e}"]`)?.focus()
  }

  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return
    const at = selected ?? 0
    const dirs: Record<string, 'left' | 'right' | 'up' | 'down'> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }
    if (ev.key in dirs) { ev.preventDefault(); move(moveEdge(at, dirs[ev.key], n)) }
    else if (selected === null) return
    else if (ev.key === 'l' || ev.key === 'L') set(selected, LINE)
    else if (ev.key === 'x' || ev.key === 'X') set(selected, CROSS)
    else if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); cycle(selected) }
    else if (ev.key === 'Backspace' || ev.key === 'Delete') set(selected, BLANK)
    else if (ev.key === 'Escape') setHint(null)
  }

  const size = n * U + 2 * P
  const px = (x: number) => P + x
  const hintEdges = new Set(hint?.edges)
  const tabbable = selected ?? 0
  const boardStyle = { '--n': n } as CSSProperties

  /** The numbers next to an edge, spoken as part of its label so the clues are available without sight. */
  const nearClues = (e: number) => {
    const out: string[] = []
    topo.sqEdges.forEach((edges, s) => {
      if (game.clues[s] !== NONE && edges.includes(e)) out.push(t('slither.near', { r: Math.floor(s / n) + 1, c: (s % n) + 1, k: game.clues[s] }))
    })
    return out
  }

  return (
    <div className="page">
      <div className="sd">
        <LevelBar name="slither-level" legend={t('sudoku.level.label')} levels={DIFFICULTIES.map((d) => ({ id: d, label: `${t(LEVEL_KEYS[d])} ${SLITHER_LEVELS[d].size}×${SLITHER_LEVELS[d].size}` }))} level={level} onLevel={setLevel}>
          <Button variant="secondary" onClick={newPuzzle}>{t('sudoku.new')}</Button>
        </LevelBar>
        {fromChat && <IncomingNote mode={fromChat} onFresh={newPuzzle} />}
        <p className="sd-meta">
          <span>{t(LEVEL_KEYS[game.difficulty])} {n}×{n}</span>
          <GameClock seconds={seconds} label={t('sudoku.time')} />
          <span>{t('sudoku.hintsUsed', { n: hints })}</span>
        </p>

        <div ref={boardRef} className="sl-board" style={boardStyle} onKeyDown={onKeyDown}>
          <svg className="sl-svg" viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
            {game.clues.map((k, s) => {
              if (k === NONE) return null
              const bad = conflicts.squares.has(s)
              const met = !bad && topo.sqEdges[s].filter((e) => marks[e] === LINE).length === k
              return (
                <text key={s} x={px((s % n) * U + U / 2)} y={px(Math.floor(s / n) * U + U / 2)} className={bad ? 'sl-clue sl-clue--bad' : met ? 'sl-clue sl-clue--met' : 'sl-clue'} textAnchor="middle" dominantBaseline="central">{k}</text>
              )
            })}
            {marks.map((m, e) => {
              const [a, b] = topo.edgeDots[e]
              const x1 = px((a % (n + 1)) * U)
              const y1 = px(Math.floor(a / (n + 1)) * U)
              const x2 = px((b % (n + 1)) * U)
              const y2 = px(Math.floor(b / (n + 1)) * U)
              const cx = (x1 + x2) / 2
              const cy = (y1 + y2) / 2
              return (
                <g key={e}>
                  {hintEdges.has(e) && <line x1={x1} y1={y1} x2={x2} y2={y2} className="sl-hint" />}
                  {m === LINE && <line x1={x1} y1={y1} x2={x2} y2={y2} className={badEdges.has(e) ? 'sl-line sl-line--bad' : 'sl-line'} />}
                  {m === CROSS && <path d={`M${cx - 1.1} ${cy - 1.1}L${cx + 1.1} ${cy + 1.1}M${cx + 1.1} ${cy - 1.1}L${cx - 1.1} ${cy + 1.1}`} className="sl-cross" />}
                </g>
              )
            })}
            {topo.dotEdges.map((_, d) => (
              <circle key={d} cx={px((d % (n + 1)) * U)} cy={px(Math.floor(d / (n + 1)) * U)} r={conflicts.dots.has(d) ? 1.3 : 0.85} className={conflicts.dots.has(d) ? 'sl-dot sl-dot--bad' : 'sl-dot'} />
            ))}
          </svg>
          <div role="group" aria-label={t('slither.board', { n })}>
            {topo.centre.map((p, e) => {
              const horizontal = p.y % 2 === 0
              const w = horizontal ? 0.78 * U : 0.62 * U
              const h = horizontal ? 0.62 * U : 0.78 * U
              const m = marks[e]
              const state = m === LINE ? t('slither.line') : m === CROSS ? t('slither.cross') : t('sudoku.empty')
              const label = [edgeName(e), state, ...nearClues(e)].join(', ')
              const style = { left: `${((px((p.x * U) / 2) - w / 2) / size) * 100}%`, top: `${((px((p.y * U) / 2) - h / 2) / size) * 100}%`, width: `${(w / size) * 100}%`, height: `${(h / size) * 100}%` } as CSSProperties
              return (
                <button
                  key={e}
                  type="button"
                  data-e={e}
                  tabIndex={e === tabbable ? 0 : -1}
                  aria-label={label}
                  className={e === selected ? 'sl-hit sl-hit--selected' : 'sl-hit'}
                  style={style}
                  onClick={() => cycle(e)}
                />
              )
            })}
          </div>
        </div>

        <div className="sd-messages" role="status">
          {(badEdges.size > 0 || conflicts.squares.size > 0 || conflicts.dots.size > 0) && !solved && <p className="sd-warn">{t('slither.warn')}</p>}
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
          <GameShare shared={{ game: 'slitherlink', puzzle: game, entries: marks, notes: [] }} title={t('gx.game.slitherlink.title')} done={solved} seconds={seconds} />
        </div>
        <div className="bn-pad" role="group" aria-label={t('slither.pad')}>
          {[LINE, CROSS].map((m) => (
            <button key={m} type="button" className="sd-digit hi-pad__key" disabled={selected === null || solved} onClick={() => selected !== null && set(selected, m)}>
              <span className={m === LINE ? 'sl-pad__swatch sl-pad__swatch--line' : 'sl-pad__swatch'} aria-hidden="true">{m === LINE ? '' : '×'}</span>
              <small>{t(m === LINE ? 'slither.drawLine' : 'slither.drawCross')}</small>
            </button>
          ))}
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('slither.help.1')}</p>
          <p>{t('slither.help.2')}</p>
        </GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
