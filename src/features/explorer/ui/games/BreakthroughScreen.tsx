import { useState } from 'react'
import { SIZES, SIZE_IDS, apply, chooseMove, countOf, legalMoves, start, withHandicap, type Breakthrough, type BreakSizeId } from '../../../games/domain/breakthrough'
import { HANDICAPS, type Handicap } from '../../../games/domain/handicap'
import { SKILL_LIST, type Skill } from '../../../games/domain/search'
import { t, type StringKey } from '../../../../shared/i18n'
import { LevelBar } from './parts'
import { OPENINGS, useComputerTurn, useHint, usePref, useRoving, type Opening } from './board/shared'
import { VsShell } from './board/VsShell'
import { useCardGame } from './cards/useCardGame'

const NAMES: Record<BreakSizeId, StringKey> = { small: 'bt.size.small', medium: 'bt.size.medium', large: 'bt.size.large' }

/** Breakthrough against the computer: you are white and start at the bottom. Reach the top row, or capture every black pawn. */
export function BreakthroughScreen() {
  const [skill, setSkill] = usePref<Skill>('breakthrough', 'skill', SKILL_LIST, 'captain')
  const [size, setSize] = usePref<BreakSizeId>('breakthrough', 'size', SIZE_IDS, 'small')
  const [opening, setOpening] = usePref<Opening>('breakthrough', 'opening', OPENINGS, 'you')
  const [started, setStarted] = useState(false)
  const game = useCardGame<Breakthrough>(() => start(6))
  const g = game.state
  const n = g.n
  const [from, setFrom] = useState<number | null>(null)
  const [handicap, setHandicap] = usePref<Handicap>('breakthrough', 'handicap', HANDICAPS, 'none')
  const hint = useHint<Breakthrough, number[]>()
  const over = g.winner !== 0
  const mine = !over && g.turn === 1
  const moves = mine ? legalMoves(g) : []
  const targets = from === null ? [] : moves.filter((m) => m.from === from).map((m) => m.to)

  const pick = (i: number) => {
    if (!mine) return
    const m = from !== null && moves.find((x) => x.from === from && x.to === i)
    if (m) { game.commit(apply(g, m)); setFrom(null); return }
    setFrom(g.cells[i] === 1 && moves.some((x) => x.from === i) && from !== i ? i : null)
  }
  useComputerTurn(started && !over && g.turn === 2, skill, g, () => { const m = chooseMove(g, skill); if (m) game.commit(apply(g, m)) })
  const { root, props } = useRoving(n, n * n, pick)
  const reset = () => { const b = withHandicap(start(SIZES[size]), handicap); game.restart(opening === 'you' ? b : { ...b, turn: 2 }); setFrom(null); hint.reset() }
  const h = hint.of(g)

  return (
    <VsShell
      variant={handicap !== 'none' ? `+${handicap}` : ''} handicap={{ value: handicap, onChange: setHandicap }} game="breakthrough" name="breakthrough" skill={skill} onSkill={setSkill} opening={opening} onOpening={setOpening} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      options={<LevelBar name="breakthrough-size" legend={t('bt.size.label')} levels={SIZE_IDS.map((s) => ({ id: s, label: `${t(NAMES[s])} ${SIZES[s]}×${SIZES[s]}` }))} level={size} onLevel={setSize} />}
      status={t(mine ? 'bd.yourTurn' : 'bd.thinking')} thinking={!mine && !over}
      result={over ? { title: t(g.winner === 1 ? 'bd.win' : 'bd.lose'), body: t('bt.final', { a: countOf(g, 1), b: countOf(g, 2) }), outcome: g.winner === 1 ? 'win' : 'loss' } : null}
      meta={<span>{t('bt.count', { a: countOf(g, 1), b: countOf(g, 2) })}</span>}
      undo={{ can: game.canUndo, run: () => { game.undoUntil((s) => s.turn === 1 && s.winner === 0); setFrom(null); hint.reset() } }}
      hint={{ run: () => { const m = chooseMove(g, 'captain'); if (m) hint.give(g, [m.from, m.to]) }, shown: h !== null, used: hint.used }}
      help={<><p>{t('bt.help.1')}</p><p>{t('bt.help.2')}</p></>}
    >
      <svg ref={root} className="bd-board bd-board--checkers" viewBox={`0 0 ${n} ${n}`} role="group" aria-label={t('bt.aria', { a: countOf(g, 1), b: countOf(g, 2) })}>
        {g.cells.map((p, i) => {
          const x = i % n, y = Math.floor(i / n)
          const goal = y === 0 || y === n - 1
          return (
            <g key={i} {...props(i)} onClick={() => pick(i)} className="bd-hit" aria-label={t(p === 1 ? 'bt.cell.white' : p === 2 ? 'bt.cell.black' : targets.includes(i) ? 'bt.cell.target' : 'bt.cell.empty', { r: y + 1, c: x + 1 })}>
              <rect className={`bd-sq ${(x + y) % 2 ? 'bd-sq--dark' : 'bd-sq--light'} ${g.last?.includes(i) ? 'bd-sq--last' : ''} ${goal && !p ? 'bd-sq--goal' : ''}`} x={x} y={y} width={1} height={1} />
              {h?.includes(i) && <rect className="bd-hintring" x={x + 0.06} y={y + 0.06} width={0.88} height={0.88} rx={0.1} />}
              {p !== 0 && <circle className={`bd-checker bd-checker--${p === 1 ? 'w' : 'b'} ${from === i ? 'bd-checker--pick' : ''}`} cx={x + 0.5} cy={y + 0.5} r={0.36} />}
              {p === 0 && targets.includes(i) && <circle className="bd-dot" cx={x + 0.5} cy={y + 0.5} r={0.12} />}
              {p === 2 && targets.includes(i) && <circle className="bd-target-ring" cx={x + 0.5} cy={y + 0.5} r={0.44} />}
            </g>
          )
        })}
      </svg>
    </VsShell>
  )
}
