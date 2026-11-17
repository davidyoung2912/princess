import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { CROSSMATH_LEVELS, blanksOf, brokenCrossmath, equationText, generateCrossmath, isCrossmathSolved, nextCrossmathHint, trayLeft, type CrossmathTechnique, type Sign } from '../../../domain/games/crossmath'
import { DIFFICULTIES, clock, type Difficulty } from '../../../domain/games/sudoku'
import { t, type StringKey } from '../../../i18n'
import { Button } from '../../Button'
import { Erase, Lightbulb, Undo } from '../../icons'
import { MoreLinks } from '../Parts'
import { GameClock, GameHelp, HintBox, LevelBar, SolvedCard, useGameClock } from './parts'

const LEVEL_KEYS: Record<Difficulty, StringKey> = { easy: 'sudoku.level.easy', medium: 'sudoku.level.medium', hard: 'sudoku.level.hard', expert: 'sudoku.level.expert' }
const HINT_KEYS: Record<CrossmathTechnique, StringKey> = { one: 'crossmath.hint.one', fit: 'crossmath.hint.fit', tray: 'crossmath.hint.tray' }
const SIGN_KEYS: Record<Sign, StringKey> = { '+': 'crossmath.sign.add', '−': 'crossmath.sign.subtract', '×': 'crossmath.sign.multiply', '÷': 'crossmath.sign.divide' }

/** A hint on screen: the words, the squares it points at, and what to place or clear. */
interface ShownHint { text: string; cells: number[]; fill?: { index: number; value: number }; remove?: number[] }

/** Crossmath: fill the blank squares with tray numbers so every equation across and down is true. Every puzzle has one answer and no guessing. Nothing is stored. */
export function CrossmathScreen() {
  const [level, setLevel] = useState<Difficulty>('easy')
  const [game, setGame] = useState(() => generateCrossmath('easy'))
  const [vals, setVals] = useState<number[]>(() => [...game.start])
  const [history, setHistory] = useState<number[][]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [hint, setHint] = useState<ShownHint | null>(null)
  const [hints, setHints] = useState(0)
  const typed = useRef('')
  const boardRef = useRef<HTMLDivElement>(null)

  const { rows, cols } = game
  const blanks = useMemo(() => blanksOf(game), [game])
  const isBlank = useMemo(() => new Set(blanks), [blanks])
  const left = useMemo(() => trayLeft(game.tray, vals, blanks), [game, vals, blanks])
  const broken = useMemo(() => brokenCrossmath(game.equations, vals), [game, vals])
  const solved = isCrossmathSolved(game, vals)
  const { seconds, reset: resetClock } = useGameClock(!solved)
  const distinct = useMemo(() => [...new Set(game.tray)], [game])
  const remaining = (v: number) => left.filter((x) => x === v).length
  const eqsOf = (i: number) => game.equations.filter((e) => e.a === i || e.b === i || e.c === i)

  const commit = (next: number[]) => {
    setHistory((h) => [...h, vals])
    setVals(next)
    setHint(null)
  }
  /** Puts a tray number in a blank square (the number it replaces goes back to the tray). Returns false when none is left. */
  const place = (i: number, v: number): boolean => {
    if (solved || !isBlank.has(i) || vals[i] === v) return true
    if (remaining(v) <= 0) return false
    const next = [...vals]
    next[i] = v
    commit(next)
    return true
  }
  const clear = (i: number) => {
    if (solved || !isBlank.has(i) || vals[i] === 0) return
    const next = [...vals]
    next[i] = 0
    commit(next)
  }
  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory(history.slice(0, -1))
    setVals(last)
    setHint(null)
  }

  const where = (index: number) => ({ r: Math.floor(index / cols) + 1, c: (index % cols) + 1 })
  const showHint = () => {
    const h = nextCrossmathHint(game, vals)
    if (!h) return
    setHints((x) => x + 1)
    if (h.kind === 'mistake') {
      setSelected(h.cells[0])
      setHint({ text: t(h.cells.length === 1 ? 'sudoku.hint.mistake1' : 'sudoku.hint.mistakeN', { n: h.cells.length }), cells: h.cells, remove: h.cells })
      return
    }
    const index = h.kind === 'move' ? h.move.index : h.index
    const value = h.kind === 'move' ? h.move.value : h.value
    setSelected(index)
    if (h.kind === 'reveal') { setHint({ text: t('crossmath.hint.reveal', { ...where(index), v: value }), cells: [index], fill: { index, value } }); return }
    const m = h.move
    const eq = m.equation >= 0 ? equationText(game.equations[m.equation], vals) : ''
    const k = remaining(value)
    const key = m.technique === 'tray' && k > 1 ? 'crossmath.hint.trayMany' : HINT_KEYS[m.technique]
    setHint({ text: t(key, { ...where(index), v: value, eq, k }), cells: [index, ...m.others], fill: { index, value } })
  }
  const applyHint = () => {
    if (!hint) return
    const next = [...vals]
    if (hint.fill) next[hint.fill.index] = hint.fill.value
    for (const i of hint.remove ?? []) next[i] = 0
    commit(next)
  }

  const newPuzzle = () => {
    const next = generateCrossmath(level)
    setGame(next)
    setVals([...next.start])
    setHistory([])
    setSelected(null)
    setHint(null)
    setHints(0)
    typed.current = ''
    resetClock()
  }

  const select = (i: number) => {
    typed.current = ''
    setSelected(i)
    boardRef.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.focus()
  }
  /** Arrow keys jump to the nearest blank square in that direction, favouring the same row or column. */
  const step = (from: number, dr: number, dc: number) => {
    const r0 = Math.floor(from / cols)
    const c0 = from % cols
    let best = -1
    let score = Infinity
    for (const i of blanks) {
      const along = ((Math.floor(i / cols) - r0) * dr) + (((i % cols) - c0) * dc)
      const across = Math.abs(((Math.floor(i / cols) - r0) * dc) + (((i % cols) - c0) * dr))
      if (along <= 0) continue
      const s = along + across * 3
      if (s < score) { score = s; best = i }
    }
    if (best >= 0) select(best)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const at = selected ?? blanks[0]
    const dirs: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }
    if (e.key in dirs) { e.preventDefault(); if (selected === null) select(at); else step(at, ...dirs[e.key]) }
    else if (selected === null) return
    else if (/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      // Two-digit tray numbers are typed one digit after the other.
      let word = typed.current + e.key
      if (word.length > 2) word = e.key
      const v = Number(word)
      const room = (x: number) => remaining(x) + (vals[selected] === x ? 1 : 0) > 0 && game.tray.includes(x)
      if (room(v)) { place(selected, v); typed.current = word }
      else if (room(Number(e.key))) { place(selected, Number(e.key)); typed.current = e.key }
      else typed.current = word
    } else if (e.key === 'Backspace' || e.key === 'Delete') { typed.current = ''; clear(selected) }
    else if (e.key === 'Escape') setHint(null)
  }

  const hintCells = new Set(hint?.cells)
  const tabbable = selected ?? blanks[0] ?? 0
  const boardStyle = { '--cols': cols, '--rows': rows } as CSSProperties
  const word = (i: number): string => (vals[i] > 0 ? String(vals[i]) : t('crossmath.blank'))
  const spoken = (i: number): string => eqsOf(i).map((e) => t(e.dir === 'across' ? 'crossmath.across' : 'crossmath.down', { a: word(e.a), s: t(SIGN_KEYS[e.sign]), b: word(e.b), c: word(e.c) })).join('. ')

  return (
    <div className="page">
      <div className="sd">
        <LevelBar name="crossmath-level" legend={t('sudoku.level.label')} levels={DIFFICULTIES.map((d) => ({ id: d, label: t(LEVEL_KEYS[d]) }))} level={level} onLevel={setLevel}>
          <Button variant="secondary" onClick={newPuzzle}>{t('sudoku.new')}</Button>
        </LevelBar>
        <p className="sd-meta">
          <span>{t(LEVEL_KEYS[game.difficulty])} · {t('crossmath.signs', { signs: CROSSMATH_LEVELS[game.difficulty].signs.join(' ') })}</span>
          <GameClock seconds={seconds} label={t('sudoku.time')} />
          <span>{t('sudoku.hintsUsed', { n: hints })}</span>
        </p>

        <div ref={boardRef} className="cm-board" style={boardStyle} role="grid" aria-label={t('crossmath.board')} onKeyDown={onKeyDown}>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} role="row" className="cm-row">
              {Array.from({ length: cols }, (_, c) => {
                const i = r * cols + c
                const kind = game.kind[i]
                if (kind === 'void') return <div key={c} role="gridcell" aria-hidden="true" className="cm-cell cm-cell--void" />
                if (kind !== 'num') return <div key={c} role="gridcell" className="cm-cell cm-cell--sign" aria-label={kind === 'eq' ? t('crossmath.equals') : t(SIGN_KEYS[game.symbol[i] as Sign])}><span aria-hidden="true">{game.symbol[i]}</span></div>
                const blank = isBlank.has(i)
                const classes = ['cm-cell', 'cm-cell--num', blank ? 'cm-cell--blank' : 'cm-cell--given']
                if (i === selected) classes.push('cm-cell--selected')
                if (broken.cells.has(i)) classes.push('cm-cell--bad')
                if (hintCells.has(i)) classes.push('cm-cell--hint')
                const parts = [t('sudoku.cell', { r: r + 1, c: c + 1 }), vals[i] > 0 ? String(vals[i]) : t('sudoku.empty')]
                parts.push(blank ? t('crossmath.toFill') : t('crossmath.given'))
                if (broken.cells.has(i)) parts.push(t('crossmath.untrue'))
                parts.push(spoken(i))
                return (
                  <div key={c} role="gridcell" data-i={i} tabIndex={blank && i === tabbable ? 0 : -1} aria-selected={blank ? i === selected : undefined} aria-label={parts.join(', ')} className={classes.join(' ')} onClick={() => blank && select(i)}>
                    {vals[i] > 0 ? vals[i] : ''}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="sd-messages" role="status">
          {broken.equations.length > 0 && !solved && <p className="sd-warn">{t('crossmath.warn')}</p>}
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
          <button type="button" className="sd-tool" onClick={() => selected !== null && clear(selected)} disabled={selected === null || solved || vals[selected] === 0}><Erase aria-hidden="true" focusable="false" /><span>{t('sudoku.erase')}</span></button>
          <button type="button" className="sd-tool" onClick={showHint} disabled={solved}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('sudoku.hint')}</span></button>
        </div>
        <div className="cm-tray" role="group" aria-label={t('crossmath.tray')}>
          {distinct.map((v) => (
            <button key={v} type="button" className="sd-digit cm-tray__key" disabled={remaining(v) <= 0 || selected === null || solved} aria-label={t('crossmath.trayNumber', { v, n: remaining(v) })} onClick={() => selected !== null && place(selected, v)}>
              {v}
              <small aria-hidden="true">{remaining(v)}</small>
            </button>
          ))}
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('crossmath.help.1')}</p>
          <p>{t('crossmath.help.2')}</p>
        </GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
