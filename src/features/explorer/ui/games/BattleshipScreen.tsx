import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { RotateCw, Shuffle } from 'lucide-react'
import { SHIP_LENGTH, SIZES, SIZE_IDS, SKILLS, accuracy, canPlace, computerFires, hitsOn, isSunk, newMatch, playerFires, randomFleet, shipCells, type Match, type Ship, type ShipKind, type SizeId, type Skill, type Waters } from '../../../games/domain/battleship'
import { clock } from '../../../games/domain/sudoku'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Crosshair } from '../../../../shared/ui/icons'
import { MoreLinks } from '../Parts'
import { GameClock, GameHelp, LevelBar, SolvedCard } from './parts'
import { useGameClock } from './gameHooks'

const SIZE_KEYS: Record<SizeId, StringKey> = { small: 'bs.size.small', classic: 'bs.size.classic', large: 'bs.size.large' }
const SKILL_KEYS: Record<Skill, StringKey> = { cadet: 'bs.skill.cadet', captain: 'bs.skill.captain', admiral: 'bs.skill.admiral' }
const SHIP_KEYS: Record<ShipKind, StringKey> = { carrier: 'bs.ship.carrier', battleship: 'bs.ship.battleship', cruiser: 'bs.ship.cruiser', submarine: 'bs.ship.submarine', destroyer: 'bs.ship.destroyer', patrol: 'bs.ship.patrol', frigate: 'bs.ship.frigate' }

/** A1 style name of a square, columns by letter and rows by number. */
const nameOf = (i: number, n: number) => `${String.fromCharCode(65 + (i % n))}${Math.floor(i / n) + 1}`

/** What happened on the last shot, for the line under the boards. */
interface Event { who: 'you' | 'cpu'; index: number; hit: boolean; sunk: ShipKind | null }

/** For each square, the ship on it and where along the ship it is (for drawing a bow and a stern). */
function layout(ships: readonly Ship[], n: number): ({ ship: Ship; k: number } | undefined)[] {
  const map: ({ ship: Ship; k: number } | undefined)[] = Array(n * n).fill(undefined)
  for (const s of ships) shipCells(s, n).forEach((c, k) => { map[c] = { ship: s, k } })
  return map
}

interface BoardProps {
  n: number
  label: string
  /** Columns A..; rows 1.. are drawn around the grid. */
  className?: string
  cell: (i: number) => { classes: string[]; label: string; mark?: 'miss' | 'hit' | 'sunk' | null }
  selected: number | null
  onCell: (i: number) => void
  /** Enter or Space on a focused square. */
  onKey?: (i: number, e: KeyboardEvent) => void
  disabled?: boolean
}

/** One square grid with letters across the top and numbers down the side. A roving tab stop and arrow keys move between squares. */
function Board({ n, label, className, cell, selected, onCell, onKey, disabled }: BoardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const style = { '--n': n } as CSSProperties
  const move = (i: number) => ref.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.focus()
  const onKeyDown = (e: KeyboardEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')
    if (!el) return
    const at = Number(el.dataset.i)
    const r = Math.floor(at / n), c = at % n
    const next: Record<string, number> = { ArrowLeft: c > 0 ? at - 1 : at, ArrowRight: c < n - 1 ? at + 1 : at, ArrowUp: r > 0 ? at - n : at, ArrowDown: r < n - 1 ? at + n : at, Home: r * n, End: r * n + n - 1 }
    if (e.key in next) { e.preventDefault(); move(next[e.key]) }
    else if (onKey) onKey(at, e)
  }
  return (
    <div className={`bs-wrap ${className ?? ''}`} style={style}>
      <div className="bs-cols" aria-hidden="true">{Array.from({ length: n }, (_, c) => <span key={c}>{String.fromCharCode(65 + c)}</span>)}</div>
      <div className="bs-rows" aria-hidden="true">{Array.from({ length: n }, (_, r) => <span key={r}>{r + 1}</span>)}</div>
      <div ref={ref} className="bs-board" role="grid" aria-label={label} aria-disabled={disabled || undefined} onKeyDown={onKeyDown}>
        {Array.from({ length: n }, (_, r) => (
          <div key={r} role="row" className="bs-row">
            {Array.from({ length: n }, (_, c) => {
              const i = r * n + c
              const d = cell(i)
              return (
                <div key={c} role="gridcell" data-i={i} tabIndex={i === (selected ?? 0) ? 0 : -1} aria-selected={i === selected} aria-label={`${nameOf(i, n)}, ${d.label}`} className={['bs-cell', ...d.classes, i === selected ? 'bs-cell--aim' : ''].join(' ')} onClick={() => onCell(i)}>
                  {d.mark === 'miss' && <span className="bs-peg bs-peg--miss" aria-hidden="true" />}
                  {d.mark === 'hit' && <span className="bs-peg bs-peg--hit" aria-hidden="true" />}
                  {d.mark === 'sunk' && <span className="bs-peg bs-peg--sunk" aria-hidden="true" />}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** The fleet as a row of small ships: a lit pip per square, struck through once sunk. */
function Fleet({ title, w }: { title: string; w: Waters }) {
  const afloat = w.ships.filter((s) => !isSunk(w, s)).length
  return (
    <section className="bs-fleet" aria-label={title}>
      <h3 className="bs-fleet__title">{title}<small>{t('bs.fleet.left', { n: afloat })}</small></h3>
      <ul className="bs-fleet__list">
        {[...w.ships].sort((a, b) => b.length - a.length).map((s) => {
          const sunk = isSunk(w, s)
          return (
            <li key={s.id} className={sunk ? 'bs-ship bs-ship--sunk' : 'bs-ship'}>
              <span className="bs-ship__pips" aria-hidden="true">{Array.from({ length: s.length }, (_, k) => <i key={k} />)}</span>
              <span className="bs-ship__name">{t(SHIP_KEYS[s.kind])}<span className="visually-hidden">, {t(sunk ? 'bs.fleet.sunk' : 'bs.fleet.afloat')}</span></span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Battleship against the app. Place your fleet (a legal layout is dealt for you; move, turn or shuffle it), then take turns calling squares. The opponent plays from only what it has seen
 * of your shots, never from your layout (see `domain/battleship.ts`). Nothing is stored.
 */
export function BattleshipScreen() {
  const [size, setSize] = useState<SizeId>('classic')
  const [skill, setSkill] = useState<Skill>('captain')
  const [ships, setShips] = useState<Ship[]>(() => randomFleet('classic'))
  const [picked, setPicked] = useState(0)
  const [match, setMatch] = useState<Match | null>(null)
  const [aim, setAim] = useState<number | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [note, setNote] = useState('')
  const [cursor, setCursor] = useState<number | null>(null)

  const n = SIZES[size].n
  const winner = match?.winner ?? null
  const { seconds, reset: resetClock } = useGameClock(match !== null && winner === null)

  /* The opponent answers after a short pause, so each turn can be followed. */
  useEffect(() => {
    if (!match || match.winner || match.turn !== 'computer') return
    const id = window.setTimeout(() => {
      const turn = computerFires(match)
      if (!turn) return
      setMatch(turn.match)
      setEvent({ who: 'cpu', index: turn.index, hit: turn.hit, sunk: turn.sunk?.kind ?? null })
    }, 700 + Math.random() * 600)
    return () => window.clearTimeout(id)
  }, [match])

  const mineMap = useMemo(() => layout(match ? match.mine.ships : ships, n), [match, ships, n])
  const theirMap = useMemo(() => (match ? layout(match.theirs.ships, n) : []), [match, n])

  const changeSize = (next: SizeId) => {
    setSize(next)
    setShips(randomFleet(next))
    setPicked(0)
    setNote('')
  }
  const shuffle = () => { setShips(randomFleet(size)); setPicked(0); setNote('') }

  /** Moves the chosen ship so its first square is on `i`, sliding it back inside the board when it would hang over the edge. */
  const place = (i: number) => {
    const ship = ships.find((s) => s.id === picked)
    if (!ship) return
    const row = Math.min(Math.floor(i / n), ship.dir === 'down' ? n - ship.length : n - 1)
    const col = Math.min(i % n, ship.dir === 'across' ? n - ship.length : n - 1)
    const moved = { ...ship, row, col }
    if (!canPlace(n, ships, moved, ship.id)) { setNote(t('bs.nofit')); return }
    setShips(ships.map((s) => (s.id === ship.id ? moved : s)))
    setNote('')
  }
  const rotate = (id = picked) => {
    const ship = ships.find((s) => s.id === id)
    if (!ship || ship.length === 1) return
    const dir = ship.dir === 'across' ? 'down' : 'across'
    const row = Math.min(ship.row, dir === 'down' ? n - ship.length : n - 1)
    const col = Math.min(ship.col, dir === 'across' ? n - ship.length : n - 1)
    const turned = { ...ship, dir, row, col } as Ship
    if (!canPlace(n, ships, turned, ship.id)) { setNote(t('bs.nofit')); return }
    setShips(ships.map((s) => (s.id === id ? turned : s)))
    setNote('')
  }
  const onSetupCell = (i: number) => {
    setCursor(i)
    const on = mineMap[i]
    if (on) {
      if (on.ship.id === picked) rotate(on.ship.id)
      else { setPicked(on.ship.id); setNote('') }
    } else place(i)
  }

  const begin = () => {
    setMatch(newMatch(size, skill, ships))
    setAim(null)
    setEvent(null)
    setCursor(null)
    resetClock()
  }
  const redeploy = () => { setMatch(null); setAim(null); setEvent(null); setCursor(null); setShips(randomFleet(size)); setPicked(0); setNote('') }

  const fireAt = (i: number) => {
    if (!match || match.turn !== 'player' || match.winner) return
    const turn = playerFires(match, i)
    if (!turn) return
    setMatch(turn.match)
    setAim(null)
    setEvent({ who: 'you', index: i, hit: turn.hit, sunk: turn.sunk?.kind ?? null })
  }
  const onTargetCell = (i: number) => {
    if (!match || match.turn !== 'player' || match.winner || match.theirs.shots[i] !== 0) return
    if (aim === i) fireAt(i)
    else setAim(i)
  }

  const eventText = (e: Event): string => {
    const at = nameOf(e.index, n)
    const who = e.who === 'you' ? 'you' : 'cpu'
    if (e.sunk) return t(`bs.msg.${who}.sunk` as StringKey, { at, ship: t(SHIP_KEYS[e.sunk]).toLowerCase() })
    return t(`bs.msg.${who}.${e.hit ? 'hit' : 'miss'}` as StringKey, { at })
  }

  /* ---------------------------------------------------------------- placing the fleet */
  if (!match) {
    const picks = [...ships].sort((a, b) => b.length - a.length)
    return (
      <div className="page">
        <div className="sd bs">
          <LevelBar name="battleship-size" legend={t('bs.size.label')} levels={SIZE_IDS.map((s) => ({ id: s, label: `${t(SIZE_KEYS[s])} ${SIZES[s].n}×${SIZES[s].n}` }))} level={size} onLevel={changeSize} />
          <LevelBar name="battleship-skill" legend={t('bs.skill.label')} levels={SKILLS.map((s) => ({ id: s, label: t(SKILL_KEYS[s]) }))} level={skill} onLevel={setSkill} />
          <p className="bs-lead">{t(`bs.skill.${skill}.about` as StringKey)}</p>
          <h2 className="bs-h">{t('bs.setup.title')}</h2>
          <Board
            n={n} label={t('bs.board.mine', { n })} className="bs-wrap--setup" selected={cursor} onCell={onSetupCell}
            onKey={(i, e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSetupCell(i) } else if (e.key === 'r' || e.key === 'R') rotate() }}
            cell={(i) => {
              const on = mineMap[i]
              if (!on) return { classes: ['bs-cell--water'], label: t('bs.cell.water') }
              return { classes: shipClasses(on, picked === on.ship.id), label: t('bs.cell.ship', { ship: t(SHIP_KEYS[on.ship.kind]).toLowerCase() }) + (picked === on.ship.id ? `, ${t('bs.cell.picked')}` : '') }
            }}
          />
          <div className="bs-picks" role="group" aria-label={t('bs.picks')}>
            {picks.map((s) => (
              <button key={s.id} type="button" className="bs-pick" aria-pressed={picked === s.id} onClick={() => setPicked(s.id)}>
                <span className="bs-ship__pips" aria-hidden="true">{Array.from({ length: SHIP_LENGTH[s.kind] }, (_, k) => <i key={k} />)}</span>
                <span>{t(SHIP_KEYS[s.kind])}</span>
              </button>
            ))}
          </div>
          <p className="bs-note" role="status">{note || t('bs.setup.hint')}</p>
          <div className="sd-tools bs-tools">
            <button type="button" className="sd-tool" onClick={() => rotate()}><RotateCw aria-hidden="true" focusable="false" /><span>{t('bs.rotate')}</span></button>
            <button type="button" className="sd-tool" onClick={shuffle}><Shuffle aria-hidden="true" focusable="false" /><span>{t('bs.shuffle')}</span></button>
          </div>
          <Button onClick={begin}>{t('bs.start')}</Button>
          <GameHelp title={t('sudoku.help.title')}>
            <p>{t('bs.help.1')}</p>
            <p>{t('bs.help.2')}</p>
            <p>{t('bs.help.3')}</p>
          </GameHelp>
        </div>
        <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
      </div>
    )
  }

  /* ---------------------------------------------------------------- the battle */
  const yourTurn = match.turn === 'player' && !winner
  const mySunk = match.mine.ships.filter((s) => isSunk(match.mine, s)).length
  const theirSunk = match.theirs.ships.filter((s) => isSunk(match.theirs, s)).length
  const myHits = hitsOn(match.theirs)
  const lastYou = event?.who === 'you' ? event.index : null
  const lastCpu = event?.who === 'cpu' ? event.index : null
  const reveal = winner === 'computer'

  return (
    <div className="page">
      <div className="sd bs">
        <p className="sd-meta">
          <span>{t(SIZE_KEYS[size])} {n}×{n} · {t(SKILL_KEYS[skill])}</span>
          <GameClock seconds={seconds} label={t('sudoku.time')} />
          <span>{t('bs.stat.shots', { n: match.shotsMine })}</span>
          <span>{t('bs.stat.hits', { n: myHits })}</span>
        </p>

        <div className={`bs-turn ${yourTurn ? 'bs-turn--you' : ''}`} role="status" aria-live="polite">
          <strong>{winner ? t(winner === 'player' ? 'bs.win.title' : 'bs.lose.title') : t(yourTurn ? 'bs.turn.you' : 'bs.turn.cpu')}</strong>
          {event && <span>{eventText(event)}</span>}
        </div>

        <h2 className="bs-h">{t('bs.waters.theirs')}</h2>
        <Board
          n={n} label={t('bs.board.theirs', { n })} className="bs-wrap--target" selected={aim} onCell={onTargetCell} disabled={!yourTurn}
          onKey={(i, e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fireAt(i) } else if (e.key === 'Escape') setAim(null) }}
          cell={(i) => {
            const shot = match.theirs.shots[i]
            const on = theirMap[i]
            const sunkShip = on && isSunk(match.theirs, on.ship) ? on : undefined
            const classes = ['bs-cell--sea']
            if (shot === 0) classes.push('bs-cell--open')
            if (sunkShip) classes.push(...shipClasses(sunkShip, false), 'bs-cell--sunk')
            else if (reveal && on && shot === 0) classes.push(...shipClasses(on, false), 'bs-cell--shown')
            if (i === lastYou) classes.push('bs-cell--last')
            if (!yourTurn || shot !== 0) classes.push('bs-cell--idle')
            const label = sunkShip ? t('bs.cell.sunk', { ship: t(SHIP_KEYS[sunkShip.ship.kind]).toLowerCase() }) : shot === 2 ? t('bs.cell.hit') : shot === 1 ? t('bs.cell.miss') : reveal && on ? t('bs.cell.shown', { ship: t(SHIP_KEYS[on.ship.kind]).toLowerCase() }) : t('bs.cell.unknown')
            return { classes, label, mark: shot === 1 ? 'miss' : sunkShip ? 'sunk' : shot === 2 ? 'hit' : null }
          }}
        />
        <Fleet title={t('bs.fleet.theirs')} w={match.theirs} />

        {!winner && (
          <Button onClick={() => aim !== null && fireAt(aim)} disabled={!yourTurn || aim === null}>
            <Crosshair aria-hidden="true" focusable="false" /> {aim === null ? t('bs.aim') : t('bs.fire.at', { at: nameOf(aim, n) })}
          </Button>
        )}

        {winner && (
          <SolvedCard title={t(winner === 'player' ? 'bs.win.title' : 'bs.lose.title')}>
            <p>{winner === 'player'
              ? t('bs.win.body', { n: match.shotsMine, acc: accuracy(myHits, match.shotsMine), time: clock(seconds) })
              : t('bs.lose.body', { k: theirSunk, m: match.theirs.ships.length, n: match.shotsMine })}</p>
            <div className="button-row"><Button onClick={redeploy}>{t('bs.again')}</Button></div>
          </SolvedCard>
        )}

        <h2 className="bs-h">{t('bs.waters.mine')}</h2>
        <Board
          n={n} label={t('bs.board.mine', { n })} className="bs-wrap--mine" selected={null} onCell={() => undefined} disabled
          cell={(i) => {
            const shot = match.mine.shots[i]
            const on = mineMap[i]
            const classes = on ? shipClasses(on, false) : ['bs-cell--sea']
            if (on && isSunk(match.mine, on.ship)) classes.push('bs-cell--sunk')
            if (i === lastCpu) classes.push('bs-cell--last')
            const label = on ? t(shot === 2 ? 'bs.cell.shipHit' : 'bs.cell.ship', { ship: t(SHIP_KEYS[on.ship.kind]).toLowerCase() }) : shot === 1 ? t('bs.cell.miss') : t('bs.cell.water')
            return { classes, label, mark: shot === 1 ? 'miss' : shot === 2 ? 'hit' : null }
          }}
        />
        <Fleet title={t('bs.fleet.mine')} w={match.mine} />
        <p className="visually-hidden">{t('bs.stat.sunk', { a: theirSunk, b: mySunk })}</p>

        <div className="sd-tools bs-tools">
          <button type="button" className="sd-tool" onClick={redeploy}><Shuffle aria-hidden="true" focusable="false" /><span>{t('bs.newgame')}</span></button>
        </div>
        <GameHelp title={t('sudoku.help.title')}>
          <p>{t('bs.help.1')}</p>
          <p>{t('bs.help.2')}</p>
          <p>{t('bs.help.3')}</p>
        </GameHelp>
      </div>
      <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
    </div>
  )
}

/** Classes that draw one square of a ship: along its length, with a rounded bow and stern. */
function shipClasses(on: { ship: Ship; k: number }, picked: boolean): string[] {
  const c = ['bs-cell--ship', on.ship.dir === 'across' ? 'bs-cell--h' : 'bs-cell--v']
  if (on.ship.length === 1) c.push('bs-cell--solo')
  else if (on.k === 0) c.push('bs-cell--bow')
  else if (on.k === on.ship.length - 1) c.push('bs-cell--stern')
  if (picked) c.push('bs-cell--picked')
  return c
}
