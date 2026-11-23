import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { MINE_LEVELS, badNumbers, chordTargets, generateMinesweeper, isMinesweeperSolved, neighboursOf, nextMineHint, revealFrom, type MinePuzzle, type MineRule } from '../../../games/domain/minesweeper'
import { DIFFICULTIES, clock, type Difficulty } from '../../../games/domain/sudoku'
import { useLongPress } from '../../../../shared/hooks/useLongPress'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Flag, Lightbulb, Undo } from '../../../../shared/ui/icons'
import { MoreLinks } from '../Parts'
import { GameClock, GameHelp, GameShare, HintBox, IncomingNote, LevelBar, SolvedCard } from './parts'
import { useGameClock, useIncomingGame } from './gameHooks'

const LEVEL_KEYS: Record<Difficulty, StringKey> = { easy: 'sudoku.level.easy', medium: 'sudoku.level.medium', hard: 'sudoku.level.hard', expert: 'sudoku.level.expert' }
const HINT_KEYS: Record<MineRule, Record<'safe' | 'mine', StringKey>> = {
  count: { safe: 'mine.hint.count.safe', mine: 'mine.hint.count.mine' },
  subset: { safe: 'mine.hint.subset.safe', mine: 'mine.hint.subset.mine' },
  total: { safe: 'mine.hint.total', mine: 'mine.hint.total' },
}

/** What the player has done: the squares opened, the flags placed and the mine that was opened, if any. */
interface State { revealed: boolean[]; flags: boolean[]; boom: number | null }
/** A hint on screen: the words, the squares it points at, and what to do with the square it names. */
interface ShownHint { text: string; cells: number[]; act?: { index: number; kind: 'safe' | 'mine' }; remove?: number[] }

const fresh = (p: MinePuzzle): State => ({ revealed: revealFrom(p, Array<boolean>(p.rows * p.cols).fill(false), p.start), flags: Array<boolean>(p.rows * p.cols).fill(false), boom: null })

/**
 * Minesweeper with no guessing: open every safe square, flag the mines. A patch is open at the start and every board can be cleared by logic alone.
 * Opening a mine stops the board until Undo or a new puzzle. Nothing is stored.
 */
export function MinesweeperScreen() {
  const { incoming, fromChat, leaveChat } = useIncomingGame('minesweeper')
  const sent = incoming && incoming.shared.game === 'minesweeper' ? incoming.shared : null
  const [level, setLevel] = useState<Difficulty>(sent?.puzzle.difficulty ?? 'easy')
  const [game, setGame] = useState(() => sent?.puzzle ?? generateMinesweeper('easy'))
  const { rows, cols } = game
  const [state, setState] = useState<State>(() => {
    const start = fresh(game)
    if (!sent) return start
    return { revealed: start.revealed.map((r, i) => r || sent.entries[i] === 1), flags: start.flags.map((_, i) => sent.entries[i] === 2 && !start.revealed[i]), boom: null }
  })
  const [history, setHistory] = useState<State[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [tool, setTool] = useState<'open' | 'flag'>('open')
  const [hint, setHint] = useState<ShownHint | null>(null)
  const [hints, setHints] = useState(0)
  const boardRef = useRef<HTMLDivElement>(null)
  const pressed = useRef<{ index: number | null; long: boolean }>({ index: null, long: false })

  const { revealed, flags, boom } = state
  const solved = isMinesweeperSolved(game, revealed) && boom === null
  const over = solved || boom !== null
  const { seconds, reset: resetClock } = useGameClock(!over)
  const bad = useMemo(() => badNumbers(game, revealed, flags), [game, revealed, flags])
  const flagCount = flags.filter(Boolean).length
  const total = MINE_LEVELS[game.difficulty].mines

  const commit = (next: State) => {
    setHistory((h) => [...h, state])
    setState(next)
    setHint(null)
  }
  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory(history.slice(0, -1))
    setState(last)
    setHint(null)
  }
  /** Opens squares one after another; the first mine stops the board. */
  const open = (targets: number[]) => {
    let rev = revealed
    let hit: number | null = null
    for (const i of targets) {
      if (rev[i] || flags[i]) continue
      if (game.mines[i]) { hit = i; break }
      rev = revealFrom(game, rev, i)
    }
    if (hit === null && rev === revealed) return
    const nextFlags = hit === null ? flags.map((f, i) => f && !rev[i]) : flags
    commit({ revealed: rev, flags: nextFlags, boom: hit })
  }
  const toggleFlag = (i: number) => {
    if (over || revealed[i]) return
    const next = [...flags]
    next[i] = !next[i]
    commit({ revealed, flags: next, boom })
  }
  /** A tap or Space: open (or flag, with the Flag tool) a hidden square, or chord on an open number. */
  const act = (i: number) => {
    if (over) return
    if (revealed[i]) {
      const targets = chordTargets(game, revealed, flags, i)
      if (targets) open(targets)
    } else if (tool === 'flag') toggleFlag(i)
    else open([i])
  }

  const showHint = () => {
    const h = nextMineHint(game, revealed, flags)
    if (!h) return
    setHints((x) => x + 1)
    if (h.kind === 'mistake') {
      setSelected(h.cells[0])
      setHint({ text: t(h.cells.length === 1 ? 'mine.hint.mistake1' : 'mine.hint.mistakeN', { n: h.cells.length }), cells: h.cells, remove: h.cells })
      return
    }
    const { move } = h
    const v = t(move.kind === 'safe' ? 'mine.toSafe' : 'mine.toMine')
    const where = { r: Math.floor(move.index / cols) + 1, c: (move.index % cols) + 1, v }
    const src = move.source === null ? null : { sr: Math.floor(move.source / cols) + 1, sc: (move.source % cols) + 1, n: game.values[move.source] }
    const oth = move.other === null ? null : { or: Math.floor(move.other / cols) + 1, oc: (move.other % cols) + 1 }
    const cells = [move.index, ...(move.source === null ? [] : [move.source]), ...(move.other === null ? [] : [move.other])]
    setSelected(move.index)
    const key = HINT_KEYS[move.rule][move.kind]
    const fit = move.rule === 'total' ? t(move.kind === 'safe' ? 'mine.hint.total.safe' : 'mine.hint.total.mine') : ''
    setHint({ text: t(key, { ...where, ...src, ...oth, fit }), cells, act: { index: move.index, kind: move.kind } })
  }
  const applyHint = () => {
    if (!hint) return
    if (hint.remove) {
      const next = [...flags]
      for (const i of hint.remove) next[i] = false
      commit({ revealed, flags: next, boom })
    } else if (hint.act) {
      if (hint.act.kind === 'safe') open([hint.act.index])
      else if (!flags[hint.act.index]) {
        const next = [...flags]
        next[hint.act.index] = true
        commit({ revealed, flags: next, boom })
      }
    }
  }

  const newPuzzle = () => {
    leaveChat()
    const next = generateMinesweeper(level)
    setGame(next)
    setState(fresh(next))
    setHistory([])
    setSelected(null)
    setHint(null)
    setHints(0)
    resetClock()
  }

  /* A touch held on a square flags it (a right click does the same with a mouse); the click that follows the hold is ignored. */
  const longPress = useLongPress(() => {
    const i = pressed.current.index
    if (i === null) return
    pressed.current.long = true
    setSelected(i)
    toggleFlag(i)
  })
  const onBoardPointerDown = (e: PointerEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')
    pressed.current = { index: el ? Number(el.dataset.i) : null, long: false }
    if (!over && el && !revealed[Number(el.dataset.i)]) longPress.onPointerDown(e)
  }
  const onCellClick = (i: number) => {
    if (pressed.current.long) { pressed.current.long = false; return }
    setSelected(i)
    act(i)
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
    else if (e.key === 'f' || e.key === 'F') toggleFlag(selected)
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); act(selected) }
    else if (e.key === 'Backspace' || e.key === 'Delete') { if (flags[selected]) toggleFlag(selected) }
    else if (e.key === 'Escape') setHint(null)
  }

  const hintCells = new Set(hint?.cells)
  const tabbable = selected ?? game.start
  const boardStyle = { '--cols': cols, '--rows': rows } as CSSProperties
  const badFlags = useMemo(() => {
    const set = new Set<number>()
    for (const i of bad) for (const k of neighboursOf(i, rows, cols)) if (flags[k]) set.add(k)
    return set
  }, [bad, flags, rows, cols])

  return (
    <div className="page">
      <div className="sd">
        <LevelBar name="minesweeper-level" legend={t('sudoku.level.label')} levels={DIFFICULTIES.map((d) => ({ id: d, label: `${t(LEVEL_KEYS[d])} ${MINE_LEVELS[d].rows}×${MINE_LEVELS[d].cols}` }))} level={level} onLevel={setLevel}>
          <Button variant="secondary" onClick={newPuzzle}>{t('sudoku.new')}</Button>
        </LevelBar>
        {fromChat && <IncomingNote mode={fromChat} onFresh={newPuzzle} />}
        <p className="sd-meta">
          <span>{t(LEVEL_KEYS[game.difficulty])} {rows}×{cols}</span>
          <GameClock seconds={seconds} label={t('sudoku.time')} />
          <span>{t('mine.left', { n: total - flagCount })}</span>
          <span>{t('sudoku.hintsUsed', { n: hints })}</span>
        </p>

        <div ref={boardRef} className="ms-board" style={boardStyle} role="grid" aria-label={t('mine.board', { r: rows, c: cols })} onKeyDown={onKeyDown} onPointerDown={onBoardPointerDown} onPointerUp={longPress.onPointerUp} onPointerCancel={longPress.onPointerCancel} onPointerLeave={longPress.onPointerLeave}>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} role="row" className="ms-row">
              {Array.from({ length: cols }, (_, c) => {
                const i = r * cols + c
                const isOpen = revealed[i]
                const isBoom = boom === i
                const showMine = isBoom || (boom !== null && game.mines[i] && !flags[i])
                const value = game.values[i]
                const classes = ['ms-cell']
                if (isOpen) classes.push('ms-cell--open', `ms-cell--n${value}`)
                if (showMine) classes.push('ms-cell--mine')
                if (isBoom) classes.push('ms-cell--boom')
                if (isOpen && bad.has(i)) classes.push('ms-cell--bad')
                if (flags[i] && badFlags.has(i)) classes.push('ms-cell--badflag')
                if (i === selected) classes.push('ms-cell--selected')
                if (hintCells.has(i)) classes.push('ms-cell--hint')
                const label = isOpen ? (value ? t('mine.number', { n: value }) : t('mine.zero')) : showMine ? t('mine.mine') : flags[i] ? t('mine.flagged') : t('mine.hidden')
                return (
                  <div
                    key={c}
                    role="gridcell"
                    data-i={i}
                    tabIndex={i === tabbable ? 0 : -1}
                    aria-selected={i === selected}
                    aria-label={`${t('sudoku.cell', { r: r + 1, c: c + 1 })}, ${label}${isOpen && bad.has(i) ? `, ${t('mine.bad')}` : ''}`}
                    className={classes.join(' ')}
                    onClick={() => onCellClick(i)}
                    onContextMenu={(e) => { e.preventDefault(); if (!pressed.current.long) { setSelected(i); toggleFlag(i) } }}
                  >
                    {isOpen && value > 0 && <span aria-hidden="true">{value}</span>}
                    {showMine && !flags[i] && <span aria-hidden="true">✹</span>}
                    {flags[i] && !(boom !== null && !game.mines[i]) && <Flag aria-hidden="true" focusable="false" />}
                    {flags[i] && boom !== null && !game.mines[i] && <span aria-hidden="true">✗</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="sd-messages" role="status">
          {boom !== null && <p className="sd-warn">{t('mine.boom')}</p>}
          {bad.size > 0 && !over && <p className="sd-warn">{t('mine.warn')}</p>}
          {hint && (
            <HintBox text={hint.text} dismissLabel={t('sudoku.hint.dismiss')} onDismiss={() => setHint(null)}>
              {hint.act && <Button variant="secondary" onClick={applyHint}>{t(hint.act.kind === 'safe' ? 'mine.hint.open' : 'mine.hint.flag')}</Button>}
              {hint.remove && <Button variant="secondary" onClick={applyHint}>{t('mine.hint.remove')}</Button>}
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
          <GameShare shared={{ game: 'minesweeper', puzzle: game, entries: game.mines.map((_, i) => (revealed[i] ? 1 : flags[i] ? 2 : 0)), notes: [] }} title={t('gx.game.minesweeper.title')} done={solved} seconds={seconds} />
          <button type="button" className="sd-tool" onClick={showHint} disabled={over}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('sudoku.hint')}</span></button>
        </div>
        <div className="bn-pad" role="group" aria-label={t('mine.pad')}>
          {(['open', 'flag'] as const).map((m) => (
            <button key={m} type="button" className="sd-digit ms-pad__key" aria-pressed={tool === m} onClick={() => setTool(m)}>
              {m === 'flag' ? <Flag aria-hidden="true" focusable="false" /> : <span className="ms-pad__swatch" aria-hidden="true" />}
              <small>{t(m === 'open' ? 'mine.open' : 'mine.flag')}</small>
            </button>
          ))}
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('mine.help.1')}</p>
          <p>{t('mine.help.2')}</p>
        </GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
