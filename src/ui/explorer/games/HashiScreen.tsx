import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { HASHI_LEVELS, cycleCount, generateHashi, isHashiSolved, islandStatus, islandTotals, nextHashiHint, type HashiPuzzle } from '../../../domain/games/hashi'
import { DIFFICULTIES, clock, type Difficulty } from '../../../domain/games/sudoku'
import { t, type StringKey } from '../../../i18n'
import { Button } from '../../Button'
import { Lightbulb, Undo } from '../../icons'
import { MoreLinks } from '../Parts'
import { GameClock, GameHelp, HintBox, LevelBar, SolvedCard, useGameClock } from './parts'

const LEVEL_KEYS: Record<Difficulty, StringKey> = { easy: 'sudoku.level.easy', medium: 'sudoku.level.medium', hard: 'sudoku.level.hard', expert: 'sudoku.level.expert' }

/** A hint on screen: the words, the links and islands it points at, and what to do about it. */
interface ShownHint { text: string; links: number[]; islands: number[]; act?: { link: number; count: number }; remove?: number[] }

const DIRS: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }

/**
 * Hashi: join the islands with bridges so each island has its number, no bridge crosses another and every island is connected.
 * Tap an island, then a neighbour (or drag from one to the other, or tap the gap between them) to go none, single, double, none.
 * Every puzzle can be solved by logic alone. Nothing is stored.
 */
export function HashiScreen() {
  const [level, setLevel] = useState<Difficulty>('easy')
  const [game, setGame] = useState<HashiPuzzle>(() => generateHashi('easy'))
  const { rows, cols, islands, links } = game
  const [counts, setCounts] = useState<number[]>(() => links.map(() => 0))
  const [history, setHistory] = useState<number[][]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [focused, setFocused] = useState(0)
  const [hint, setHint] = useState<ShownHint | null>(null)
  const [hints, setHints] = useState(0)
  const [blocked, setBlocked] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ from: number | null; moved: boolean }>({ from: null, moved: false })

  const solved = isHashiSolved(game, counts)
  const { seconds, reset: resetClock } = useGameClock(!solved)
  const totals = useMemo(() => islandTotals(game, counts), [game, counts])
  const status = useMemo(() => islandStatus(game, counts), [game, counts])
  const linkOf = useMemo(() => {
    const m = new Map<string, number>()
    links.forEach((l, i) => { m.set(`${l.a}-${l.b}`, i); m.set(`${l.b}-${l.a}`, i) })
    return m
  }, [links])
  /** The link leaving each island in each direction (up, down, left, right), if there is one. */
  const neighbours = useMemo(() => {
    const out = islands.map(() => ({} as Record<string, number>))
    links.forEach((l) => {
      out[l.a][l.horizontal ? 'ArrowRight' : 'ArrowDown'] = l.b
      out[l.b][l.horizontal ? 'ArrowLeft' : 'ArrowUp'] = l.a
    })
    return out
  }, [islands, links])

  const setLinks = (next: number[]) => {
    setHistory((h) => [...h, counts])
    setCounts(next)
    setHint(null)
    setBlocked(false)
  }
  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory(history.slice(0, -1))
    setCounts(last)
    setHint(null)
    setBlocked(false)
  }
  const cycle = (link: number) => {
    if (solved) return
    const next = cycleCount(game, counts, link)
    if (next === null) { setBlocked(true); return }
    const copy = [...counts]
    copy[link] = next
    setLinks(copy)
  }
  const cycleBetween = (a: number, b: number): boolean => {
    const l = linkOf.get(`${a}-${b}`)
    if (l === undefined) return false
    cycle(l)
    return true
  }

  const onIslandClick = (i: number) => {
    if (drag.current.moved) { drag.current.moved = false; return }
    setFocused(i)
    if (selected === null || selected === i) { setSelected(selected === i ? null : i); return }
    if (cycleBetween(selected, i)) setSelected(null)
    else setSelected(i)
  }
  const onBoardPointerDown = (e: PointerEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-island]')
    drag.current = { from: el ? Number(el.dataset.island) : null, moved: false }
  }
  const onBoardPointerUp = (e: PointerEvent) => {
    const from = drag.current.from
    drag.current.from = null
    if (from === null) return
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-island]')
    const to = el ? Number(el.dataset.island) : null
    if (to === null || to === from) return
    drag.current.moved = true
    setSelected(null)
    if (!cycleBetween(from, to)) drag.current.moved = false
  }

  const focusIsland = (i: number) => {
    setFocused(i)
    boardRef.current?.querySelector<HTMLElement>(`[data-island="${i}"]`)?.focus()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'Escape') { setSelected(null); setHint(null); return }
    const dir = DIRS[e.key]
    if (!dir) return
    const at = (e.target as HTMLElement).closest<HTMLElement>('[data-island]')
    if (!at) return
    e.preventDefault()
    const i = Number(at.dataset.island)
    const direct = neighbours[i][e.key]
    if (e.shiftKey) {
      if (direct !== undefined) cycleBetween(i, direct)
      return
    }
    if (direct !== undefined) { focusIsland(direct); return }
    // No bridge could run that way: go to the nearest island in that direction, preferring one that lines up.
    const [dr, dc] = dir
    let best = -1
    let bestScore = Infinity
    islands.forEach((o, k) => {
      const along = (o.r - islands[i].r) * dr + (o.c - islands[i].c) * dc
      const across = Math.abs((o.r - islands[i].r) * dc) + Math.abs((o.c - islands[i].c) * dr)
      if (along <= 0) return
      const score = along + across * 2
      if (score < bestScore) { bestScore = score; best = k }
    })
    if (best >= 0) focusIsland(best)
  }

  const where = (i: number) => ({ r: islands[i].r + 1, c: islands[i].c + 1 })
  const showHint = () => {
    const h = nextHashiHint(game, counts)
    if (!h) return
    setHints((x) => x + 1)
    if (h.kind === 'mistake') {
      const ends = h.links.flatMap((l) => [links[l].a, links[l].b])
      setSelected(null)
      setHint({ text: t(h.links.length === 1 ? 'hashi.hint.mistake1' : 'hashi.hint.mistakeN', { n: h.links.length }), links: h.links, islands: ends, remove: h.links })
      return
    }
    const { move } = h
    const l = links[move.link]
    const src = move.island ?? l.a
    const dst = src === l.a ? l.b : l.a
    const amount = t(move.lo === move.hi ? (move.lo === 1 ? 'hashi.amt.one' : 'hashi.amt.two') : 'hashi.amt.atLeast')
    const key: StringKey = move.rule === 'all' ? 'hashi.hint.all' : move.rule === 'least' ? 'hashi.hint.least' : 'hashi.hint.reveal'
    const text = t(key, { sr: where(src).r, sc: where(src).c, n: islands[src].n, r: where(dst).r, c: where(dst).c, rest: move.rest, amount })
    setSelected(null)
    setHint({ text, links: [move.link], islands: [src, dst], act: { link: move.link, count: move.lo } })
  }
  const applyHint = () => {
    if (!hint) return
    const copy = [...counts]
    if (hint.remove) for (const l of hint.remove) copy[l] = game.solution[l]
    else if (hint.act) copy[hint.act.link] = hint.act.count
    else return
    setLinks(copy)
  }

  const newPuzzle = () => {
    const next = generateHashi(level)
    setGame(next)
    setCounts(next.links.map(() => 0))
    setHistory([])
    setSelected(null)
    setFocused(0)
    setHint(null)
    setHints(0)
    setBlocked(false)
    resetClock()
  }

  const hintLinks = new Set(hint?.links)
  const hintIslands = new Set(hint?.islands)
  const boardStyle = { aspectRatio: `${cols} / ${rows}` } as CSSProperties
  const pct = (v: number, of: number) => `${(v / of) * 100}%`
  const anyBad = status.bad.some(Boolean)
  const anyClosed = status.closed.some(Boolean)
  const linkName = (l: number) => {
    const a = where(links[l].a)
    const b = where(links[l].b)
    return t('hashi.link', { r1: a.r, c1: a.c, r2: b.r, c2: b.c, n: counts[l] })
  }

  return (
    <div className="page">
      <div className="sd">
        <LevelBar name="hashi-level" legend={t('sudoku.level.label')} levels={DIFFICULTIES.map((d) => ({ id: d, label: `${t(LEVEL_KEYS[d])} ${HASHI_LEVELS[d].rows}×${HASHI_LEVELS[d].cols}` }))} level={level} onLevel={setLevel}>
          <Button variant="secondary" onClick={newPuzzle}>{t('sudoku.new')}</Button>
        </LevelBar>
        <p className="sd-meta">
          <span>{t(LEVEL_KEYS[game.difficulty])} {rows}×{cols}</span>
          <GameClock seconds={seconds} label={t('sudoku.time')} />
          <span>{t('sudoku.hintsUsed', { n: hints })}</span>
        </p>

        <div ref={boardRef} className="hs-board" style={boardStyle} role="group" aria-label={t('hashi.board', { r: rows, c: cols })} onKeyDown={onKeyDown} onPointerDown={onBoardPointerDown} onPointerUp={onBoardPointerUp}>
          <svg className="hs-lines" viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
            {links.map((l, i) => {
              if (!counts[i]) return null
              const a = islands[l.a]
              const b = islands[l.b]
              const offsets = counts[i] === 2 ? [-0.1, 0.1] : [0]
              return (
                <g key={i} className={hintLinks.has(i) ? 'hs-bridge hs-bridge--hint' : 'hs-bridge'}>
                  {offsets.map((o) => (
                    <line key={o} x1={a.c + 0.5 + (l.horizontal ? 0 : o)} y1={a.r + 0.5 + (l.horizontal ? o : 0)} x2={b.c + 0.5 + (l.horizontal ? 0 : o)} y2={b.r + 0.5 + (l.horizontal ? o : 0)} />
                  ))}
                </g>
              )
            })}
          </svg>
          {links.map((l, i) => {
            const a = islands[l.a]
            const b = islands[l.b]
            const style: CSSProperties = l.horizontal
              ? { left: pct(a.c + 0.9, cols), width: pct(b.c - a.c - 0.8, cols), top: pct(a.r + 0.2, rows), height: pct(0.6, rows) }
              : { left: pct(a.c + 0.2, cols), width: pct(0.6, cols), top: pct(a.r + 0.9, rows), height: pct(b.r - a.r - 0.8, rows) }
            return <button key={i} type="button" tabIndex={-1} className="hs-gap" style={style} aria-label={linkName(i)} onClick={() => cycle(i)} />
          })}
          {islands.map((isl, i) => {
            const classes = ['hs-island']
            if (status.done[i]) classes.push('hs-island--done')
            if (status.bad[i]) classes.push('hs-island--bad')
            if (status.closed[i]) classes.push('hs-island--closed')
            if (i === selected) classes.push('hs-island--selected')
            if (hintIslands.has(i)) classes.push('hs-island--hint')
            const state = status.bad[i] ? `, ${t('hashi.state.bad')}` : status.closed[i] ? `, ${t('hashi.state.closed')}` : status.done[i] ? `, ${t('hashi.state.done')}` : ''
            return (
              <button
                key={i}
                type="button"
                data-island={i}
                tabIndex={i === focused ? 0 : -1}
                aria-pressed={i === selected}
                className={classes.join(' ')}
                style={{ left: pct(isl.c, cols), top: pct(isl.r, rows), width: pct(1, cols), height: pct(1, rows) }}
                aria-label={`${t('hashi.island', { n: isl.n, r: isl.r + 1, c: isl.c + 1, have: totals[i] })}${state}`}
                onClick={() => onIslandClick(i)}
                onFocus={() => setFocused(i)}
              >
                <span className="hs-island__disc" aria-hidden="true">{isl.n}</span>
              </button>
            )
          })}
        </div>

        <div className="sd-messages" role="status">
          {blocked && <p className="sd-warn">{t('hashi.blocked')}</p>}
          {anyBad && !solved && <p className="sd-warn">{t('hashi.warn')}</p>}
          {anyClosed && !solved && <p className="sd-warn">{t('hashi.warnClosed')}</p>}
          {selected !== null && !solved && <p>{t('hashi.selected', { r: where(selected).r, c: where(selected).c })}</p>}
          {hint && (
            <HintBox text={hint.text} dismissLabel={t('sudoku.hint.dismiss')} onDismiss={() => setHint(null)}>
              {hint.act && <Button variant="secondary" onClick={applyHint}>{t('hashi.hint.draw')}</Button>}
              {hint.remove && <Button variant="secondary" onClick={applyHint}>{t('hashi.hint.fix')}</Button>}
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
          <button type="button" className="sd-tool" onClick={showHint} disabled={solved}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('sudoku.hint')}</span></button>
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('hashi.help.1')}</p>
          <p>{t('hashi.help.2')}</p>
        </GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}
