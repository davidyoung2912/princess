import { useState } from 'react'
import { N, apply, chooseMove, countOf, legalMoves, sideOf, start, type Checkers } from '../../../games/domain/checkers'
import { SKILL_LIST, type Skill } from '../../../games/domain/search'
import { t } from '../../../../shared/i18n'
import { OPENINGS, useComputerTurn, useHint, usePref, useRoving, type Opening } from './board/shared'
import { VsShell } from './board/VsShell'
import { useCardGame } from './cards/useCardGame'

/** Checkers (English draughts): you are red and move first, up the board. Jumps are compulsory and are the only moves offered when one is available. */
export function CheckersScreen() {
  const [skill, setSkill] = usePref<Skill>('checkers', 'skill', SKILL_LIST, 'captain')
  const [opening, setOpening] = usePref<Opening>('checkers', 'opening', OPENINGS, 'you')
  const hint = useHint<Checkers, number[]>()
  const [started, setStarted] = useState(false)
  const game = useCardGame<Checkers>(start)
  const g = game.state
  const [from, setFrom] = useState<number | null>(null)
  const over = g.winner !== 0
  const mine = !over && g.turn === 1
  const moves = mine ? legalMoves(g) : []
  const forced = moves.some((m) => m.captured.length > 0)
  const ends = from === null ? [] : moves.filter((m) => m.path[0] === from).map((m) => m.path[m.path.length - 1])

  const pick = (i: number) => {
    if (!mine) return
    const m = from !== null && moves.find((x) => x.path[0] === from && x.path[x.path.length - 1] === i)
    if (m) { game.commit(apply(g, m)); setFrom(null); return }
    setFrom(moves.some((x) => x.path[0] === i) && from !== i ? i : null)
  }
  useComputerTurn(started && !over && g.turn === 2, skill, g, () => { const m = chooseMove(g, skill); if (m) game.commit(apply(g, m)) })
  const { root, props } = useRoving(N, 64, pick)
  const reset = () => { game.restart(opening === 'you' ? start() : { ...start(), turn: 2 }); setFrom(null); hint.reset() }
  const trail = new Set(g.last)

  return (
    <VsShell
      game="checkers" name="checkers" opening={opening} onOpening={setOpening} skill={skill} onSkill={setSkill} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      status={mine ? t(forced ? 'ck.jump' : 'bd.yourTurn') : t('bd.thinking')} thinking={!mine && !over}
      result={over ? { title: t(g.winner === 1 ? 'bd.win' : g.winner === 2 ? 'bd.lose' : 'bd.draw'), body: t('ck.final', { a: countOf(g, 1), b: countOf(g, 2) }), outcome: g.winner === 1 ? 'win' : g.winner === 2 ? 'loss' : 'draw' } : null}
      meta={<span>{t('ck.count', { a: countOf(g, 1), b: countOf(g, 2) })}</span>}
      hint={{ run: () => { const m = chooseMove(g, 'captain'); if (m) hint.give(g, [m.path[0], m.path[m.path.length - 1]]) }, shown: hint.of(g) !== null, used: hint.used }}
      undo={{ can: game.canUndo, run: () => { game.undoUntil((s) => s.turn === 1 && s.winner === 0); setFrom(null) } }}
      help={<><p>{t('ck.help.1')}</p><p>{t('ck.help.2')}</p></>}
    >
      <svg ref={root} className="bd-board bd-board--checkers" viewBox="0 0 8 8" role="group" aria-label={t('ck.aria', { a: countOf(g, 1), b: countOf(g, 2) })}>
        {Array.from({ length: 64 }, (_, i) => {
          const x = i % 8, y = Math.floor(i / 8), p = g.board[i]
          const dark = (x + y) % 2 === 1
          if (!dark) return <rect key={i} className="bd-sq bd-sq--light" x={x} y={y} width={1} height={1} />
          const kind = p === 1 ? 'red' : p === 2 ? 'black' : p === 3 ? 'redking' : p === 4 ? 'blackking' : ''
          return (
            <g key={i} {...props(i)} onClick={() => pick(i)} className="bd-hit" aria-label={kind ? t(`ck.cell.${kind}` as 'ck.cell.red', { r: y + 1, c: x + 1 }) : t('ck.cell.empty', { r: y + 1, c: x + 1 })}>
              <rect className={`bd-sq bd-sq--dark ${trail.has(i) ? 'bd-sq--last' : ''}`} x={x} y={y} width={1} height={1} />
              {kind && <circle className={`bd-checker bd-checker--${sideOf(p) === 1 ? 'r' : 'b'} ${from === i ? 'bd-checker--pick' : ''}`} cx={x + 0.5} cy={y + 0.5} r={0.4} />}
              {(p === 3 || p === 4) && <path className="bd-crown" d={`M${x + 0.3} ${y + 0.64} L${x + 0.3} ${y + 0.38} L${x + 0.4} ${y + 0.5} L${x + 0.5} ${y + 0.32} L${x + 0.6} ${y + 0.5} L${x + 0.7} ${y + 0.38} L${x + 0.7} ${y + 0.64} Z`} />}
              {hint.of(g)?.includes(i) && <rect className="bd-hintring" x={x + 0.06} y={y + 0.06} width={0.88} height={0.88} rx={0.1} />}
              {!kind && ends.includes(i) && <circle className="bd-dot" cx={x + 0.5} cy={y + 0.5} r={0.12} />}
            </g>
          )
        })}
      </svg>
    </VsShell>
  )
}
