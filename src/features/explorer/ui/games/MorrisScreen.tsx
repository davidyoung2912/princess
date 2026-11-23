import { useState } from 'react'
import { XY, POINTS, apply, canFly, chooseMove, destinations, legalMoves, onBoard, start, total, type Morris } from '../../../games/domain/morris'
import { SKILL_LIST, type Skill } from '../../../games/domain/search'
import { t } from '../../../../shared/i18n'
import { OPENINGS, useComputerTurn, useHint, usePref, useRoving, type Opening } from './board/shared'
import { VsShell } from './board/VsShell'
import { useCardGame } from './cards/useCardGame'

/** Nine Men's Morris: you are white and place first, then slide, then fly when you are down to three. Make a mill to remove a man. */
export function MorrisScreen() {
  const [skill, setSkill] = usePref<Skill>('morris', 'skill', SKILL_LIST, 'captain')
  const [opening, setOpening] = usePref<Opening>('morris', 'opening', OPENINGS, 'you')
  const hint = useHint<Morris, number[]>()
  const [started, setStarted] = useState(false)
  const game = useCardGame<Morris>(start)
  const g = game.state
  const [from, setFrom] = useState<number | null>(null)
  const over = g.winner !== 0
  const mine = !over && g.turn === 1
  const moves = mine ? legalMoves(g) : []
  const targets = from === null ? [] : destinations(g, from)

  const pick = (i: number) => {
    if (!mine) return
    const remove = moves.find((m) => m.kind === 'remove' && m.at === i)
    if (remove) { game.commit(apply(g, remove)); return }
    const place = moves.find((m) => m.kind === 'place' && m.to === i)
    if (place) { game.commit(apply(g, place)); return }
    const slide = from !== null && moves.find((m) => m.kind === 'move' && m.from === from && m.to === i)
    if (slide) { game.commit(apply(g, slide)); setFrom(null); return }
    setFrom(g.board[i] === 1 && moves.some((m) => m.kind === 'move' && m.from === i) && from !== i ? i : null)
  }
  useComputerTurn(started && !over && g.turn === 2, skill, g, () => { const m = chooseMove(g, skill); if (m) game.commit(apply(g, m)) })
  const { root, props } = useRoving(7, 49, (i) => { const p = XY.findIndex(([x, y]) => y * 7 + x === i); if (p >= 0) pick(p) })
  const reset = () => { game.restart(opening === 'you' ? start() : { ...start(), turn: 2 }); setFrom(null); hint.reset() }
  const status = g.removing && mine ? t('mr.remove') : !mine ? t('bd.thinking') : g.toPlace[0] > 0 ? t('mr.place', { n: g.toPlace[0] }) : canFly(g, 1) ? t('mr.fly') : t('mr.slide')
  const removable = new Set(g.removing && mine ? moves.flatMap((m) => (m.kind === 'remove' ? [m.at] : [])) : [])

  return (
    <VsShell
      game="morris" name="morris" opening={opening} onOpening={setOpening} skill={skill} onSkill={setSkill} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      status={status} thinking={!mine && !over}
      result={over ? { title: t(g.winner === 1 ? 'bd.win' : 'bd.lose'), body: t('mr.final', { a: total(g, 1), b: total(g, 2) }), outcome: g.winner === 1 ? 'win' : 'loss' } : null}
      meta={<span>{t('mr.men', { a: total(g, 1), b: total(g, 2) })}</span>}
      hint={{ run: () => { const m = chooseMove(g, 'captain'); if (m) hint.give(g, m.kind === 'place' ? [m.to] : m.kind === 'move' ? [m.from, m.to] : [m.at]) }, shown: hint.of(g) !== null, used: hint.used }}
      undo={{ can: game.canUndo, run: () => { game.undoUntil((s) => s.turn === 1 && !s.removing && s.winner === 0); setFrom(null) } }}
      help={<><p>{t('mr.help.1')}</p><p>{t('mr.help.2')}</p></>}
    >
      <svg ref={root} className="bd-board bd-board--morris" viewBox="-0.5 -0.5 7 7" role="group" aria-label={t('mr.aria', { a: onBoard(g, 1), b: onBoard(g, 2) })}>
        <rect className="bd-wood" x={-0.5} y={-0.5} width={7} height={7} rx={0.3} />
        <g className="bd-lines">
          {[0, 1, 2].map((k) => <rect key={k} x={k} y={k} width={6 - 2 * k} height={6 - 2 * k} fill="none" />)}
          {[[3, 0, 3, 2], [3, 4, 3, 6], [0, 3, 2, 3], [4, 3, 6, 3]].map((l, k) => <line key={k} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} />)}
        </g>
        {Array.from({ length: POINTS }, (_, i) => {
          const [x, y] = XY[i]
          const p = g.board[i]
          const dest = targets.includes(i) || (g.toPlace[0] > 0 && mine && !g.removing && p === 0)
          return (
            <g key={i} {...props(y * 7 + x)} onClick={() => pick(i)} className="bd-hit" aria-label={t(p === 1 ? 'mr.cell.white' : p === 2 ? 'mr.cell.black' : 'mr.cell.empty', { n: i + 1 })}>
              <circle className="bd-spot" cx={x} cy={y} r={0.34} />
              {hint.of(g)?.includes(i) && <circle className="bd-hintring" cx={x} cy={y} r={0.42} />}
              {p !== 0 && <circle className={`bd-stone bd-stone--${p === 1 ? 'w' : 'b'} ${from === i ? 'bd-stone--pick' : ''} ${g.last === i ? 'bd-stone--last' : ''} ${removable.has(i) ? 'bd-stone--remove' : ''}`} cx={x} cy={y} r={0.3} />}
              {p === 0 && dest && <circle className="bd-dot" cx={x} cy={y} r={0.12} />}
            </g>
          )
        })}
      </svg>
    </VsShell>
  )
}
