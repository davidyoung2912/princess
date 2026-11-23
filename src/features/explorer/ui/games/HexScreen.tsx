import { useState } from 'react'
import { SIZES, SIZE_IDS, chooseMove, place, start, type Hex, type HexSizeId } from '../../../games/domain/hex'
import { SKILL_LIST, type Skill } from '../../../games/domain/search'
import { t, type StringKey } from '../../../../shared/i18n'
import { LevelBar } from './parts'
import { OPENINGS, useComputerTurn, useHint, usePref, useRoving, type Opening } from './board/shared'
import { VsShell } from './board/VsShell'
import { useCardGame } from './cards/useCardGame'

const NAMES: Record<HexSizeId, StringKey> = { small: 'hx.size.small', medium: 'hx.size.medium', large: 'hx.size.large' }
const SQ3 = Math.sqrt(3)

/** Hex on a diamond of hexagons: you are Red and join top to bottom; the computer is Blue and joins left to right. You move first. */
export function HexScreen() {
  const [skill, setSkill] = usePref<Skill>('hex', 'skill', SKILL_LIST, 'captain')
  const [size, setSize] = usePref<HexSizeId>('hex', 'size', SIZE_IDS, 'small')
  const [opening, setOpening] = usePref<Opening>('hex', 'opening', OPENINGS, 'you')
  const hint = useHint<Hex, number>()
  const n = SIZES[size]
  const [started, setStarted] = useState(false)
  const game = useCardGame<Hex>(() => start(7))
  const g = game.state
  const over = g.winner !== 0
  const mine = !over && g.turn === 1
  const pick = (i: number) => { if (!mine) return; const next = place(g, i); if (next) game.commit(next) }
  useComputerTurn(started && !over && g.turn === 2, skill, g, () => { const m = chooseMove(g, skill); if (m !== null) { const next = place(g, m); if (next) game.commit(next) } })
  const { root, props } = useRoving(g.n, g.n * g.n, pick)
  const reset = () => { game.restart(opening === 'you' ? start(n) : { ...start(n), turn: 2 }); hint.reset() }

  // Pointy-topped hexagons of radius 1; each row shifts half a hexagon right.
  const cx = (i: number) => SQ3 * ((i % g.n) + Math.floor(i / g.n) / 2) + SQ3 / 2 + 0.6
  const cy = (i: number) => 1.5 * Math.floor(i / g.n) + 1 + 0.6
  const W = SQ3 * (g.n + (g.n - 1) / 2) + 1.2, H = 1.5 * (g.n - 1) + 2 + 1.2
  const poly = (x: number, y: number, r = 1) => Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 6 + (k * Math.PI) / 3; return `${(x + r * Math.cos(a)).toFixed(3)},${(y + r * Math.sin(a)).toFixed(3)}` }).join(' ')
  const chain = new Set(g.chain)

  return (
    <VsShell
      game="hex" name="hex" opening={opening} onOpening={setOpening} skill={skill} onSkill={setSkill} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      options={<LevelBar name="hex-size" legend={t('hx.size.label')} levels={SIZE_IDS.map((s) => ({ id: s, label: `${t(NAMES[s])} ${SIZES[s]}×${SIZES[s]}` }))} level={size} onLevel={setSize} />}
      status={t(mine ? 'bd.yourTurn' : 'bd.thinking')} thinking={!mine && !over}
      result={over ? { title: t(g.winner === 1 ? 'bd.win' : 'bd.lose'), body: t('hx.final', { n: g.moves }), outcome: g.winner === 1 ? 'win' : 'loss' } : null}
      meta={<span>{t('gm.moves', { n: g.moves })}</span>}
      hint={{ run: () => { const m = chooseMove(g, 'captain'); if (m !== null) hint.give(g, m) }, shown: hint.of(g) !== null, used: hint.used }}
      undo={{ can: game.canUndo, run: () => game.undoUntil((s) => s.turn === 1 && s.winner === 0) }}
      help={<><p>{t('hx.help.1')}</p><p>{t('hx.help.2')}</p></>}
    >
      <svg ref={root} className="bd-board bd-board--hex" viewBox={`0 0 ${W.toFixed(2)} ${H.toFixed(2)}`} role="group" aria-label={t('hx.aria', { n: g.n })}>
        <line className="bd-edge bd-edge--red" x1={cx(0) - SQ3 / 2} x2={cx(g.n - 1) + SQ3 / 2} y1={cy(0) - 1.15} y2={cy(0) - 1.15} />
        <line className="bd-edge bd-edge--red" x1={cx(g.n * (g.n - 1)) - SQ3 / 2} x2={cx(g.n * g.n - 1) + SQ3 / 2} y1={cy(g.n * g.n - 1) + 1.15} y2={cy(g.n * g.n - 1) + 1.15} />
        <polyline className="bd-edge bd-edge--blue" fill="none" points={Array.from({ length: g.n }, (_, r) => `${(cx(r * g.n) - SQ3 / 2 - 0.2).toFixed(2)},${cy(r * g.n).toFixed(2)}`).join(' ')} />
        <polyline className="bd-edge bd-edge--blue" fill="none" points={Array.from({ length: g.n }, (_, r) => `${(cx(r * g.n + g.n - 1) + SQ3 / 2 + 0.2).toFixed(2)},${cy(r * g.n).toFixed(2)}`).join(' ')} />
        {Array.from({ length: g.n * g.n }, (_, i) => {
          const d = g.cells[i]
          return (
            <g key={i} {...props(i)} onClick={() => pick(i)} className="bd-hit" aria-label={t(d === 1 ? 'hx.cell.red' : d === 2 ? 'hx.cell.blue' : 'hx.cell.empty', { r: Math.floor(i / g.n) + 1, c: (i % g.n) + 1 })}>
              <polygon className={`bd-hex bd-hex--${d === 1 ? 'r' : d === 2 ? 'b' : 'e'} ${g.last === i ? 'bd-hex--last' : ''} ${chain.has(i) ? 'bd-hex--win' : ''}`} points={poly(cx(i), cy(i), 0.95)} />
              {hint.of(g) === i && <polygon className="bd-hintring" points={poly(cx(i), cy(i), 1.05)} />}
            </g>
          )
        })}
      </svg>
    </VsShell>
  )
}
