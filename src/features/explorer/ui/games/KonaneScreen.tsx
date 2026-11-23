import { useState } from 'react'
import { SIZES, SIZE_IDS, allMoves, chooseMove, openingMoves, start, step, type Konane, type KonaneSizeId, type Move } from '../../../games/domain/konane'
import { SKILL_LIST, type Skill } from '../../../games/domain/search'
import { t, type StringKey } from '../../../../shared/i18n'
import { LevelBar } from './parts'
import { OPENINGS, useComputerTurn, useHint, usePref, useRoving, type Opening } from './board/shared'
import { VsShell } from './board/VsShell'
import { useCardGame } from './cards/useCardGame'

const NAMES: Record<KonaneSizeId, StringKey> = { six: 'kn.size.six', eight: 'kn.size.eight' }

/** Konane against the computer: you are black. Take away your first stone, then jump over enemy stones into empty squares. The side that cannot jump loses. */
export function KonaneScreen() {
  const [skill, setSkill] = usePref<Skill>('konane', 'skill', SKILL_LIST, 'captain')
  const [size, setSize] = usePref<KonaneSizeId>('konane', 'size', SIZE_IDS, 'six')
  const [opening, setOpening] = usePref<Opening>('konane', 'opening', OPENINGS, 'you')
  const [started, setStarted] = useState(false)
  const game = useCardGame<Konane>(() => start(6))
  const g = game.state
  const n = g.n
  const [from, setFrom] = useState<number | null>(null)
  const hint = useHint<Konane, number[]>()
  const over = g.winner !== 0
  const mine = !over && g.turn === 1
  const moves: Move[] = mine ? allMoves(g) : []
  const removable = mine && g.opening ? openingMoves(g) : []
  const landings = from === null ? [] : moves.filter((m) => m.path[0] === from).map((m) => m.path[m.path.length - 1])

  const pick = (i: number) => {
    if (!mine) return
    if (g.opening) { const m = moves.find((x) => x.path[0] === i); if (m) game.commit(step(g, m)); return }
    const m = from !== null && moves.find((x) => x.path[0] === from && x.path[x.path.length - 1] === i)
    if (m) { game.commit(step(g, m)); setFrom(null); return }
    setFrom(moves.some((x) => x.path[0] === i) && from !== i ? i : null)
  }
  useComputerTurn(started && !over && g.turn === 2, skill, g, () => { const m = chooseMove(g, skill); if (m) game.commit(step(g, m)) })
  const { root, props } = useRoving(n, n * n, pick)
  const reset = () => { game.restart(opening === 'you' ? start(SIZES[size]) : { ...start(SIZES[size]), turn: 2 }); setFrom(null); hint.reset() }
  const h = hint.of(g)
  const count = (p: 1 | 2) => g.cells.filter((c) => c === p).length

  return (
    <VsShell
      game="konane" name="konane" skill={skill} onSkill={setSkill} opening={opening} onOpening={setOpening} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      options={<LevelBar name="konane-size" legend={t('kn.size.label')} levels={SIZE_IDS.map((s) => ({ id: s, label: `${t(NAMES[s])} ${SIZES[s]}×${SIZES[s]}` }))} level={size} onLevel={setSize} />}
      status={!mine ? t('bd.thinking') : g.opening ? t('kn.remove') : t('bd.yourTurn')} thinking={!mine && !over}
      result={over ? { title: t(g.winner === 1 ? 'bd.win' : 'bd.lose'), body: t('kn.final', { a: count(1), b: count(2) }), outcome: g.winner === 1 ? 'win' : 'loss' } : null}
      meta={<span>{t('bt.count', { a: count(1), b: count(2) })}</span>}
      undo={{ can: game.canUndo, run: () => { game.undoUntil((s) => s.turn === 1 && s.winner === 0); setFrom(null); hint.reset() } }}
      hint={{ run: () => { const m = chooseMove(g, 'captain'); if (m) hint.give(g, m.path.length > 1 ? [m.path[0], m.path[m.path.length - 1]] : [m.path[0]]) }, shown: h !== null, used: hint.used }}
      help={<><p>{t('kn.help.1')}</p><p>{t('kn.help.2')}</p></>}
    >
      <svg ref={root} className="bd-board bd-board--konane" viewBox={`0 0 ${n} ${n}`} role="group" aria-label={t('kn.aria', { a: count(1), b: count(2) })}>
        <rect className="bd-wood" x={0} y={0} width={n} height={n} rx={0.2} />
        {g.cells.map((p, i) => {
          const x = i % n, y = Math.floor(i / n)
          return (
            <g key={i} {...props(i)} onClick={() => pick(i)} className="bd-hit" aria-label={t(p === 1 ? 'kn.cell.black' : p === 2 ? 'kn.cell.white' : landings.includes(i) ? 'kn.cell.landing' : 'kn.cell.empty', { r: y + 1, c: x + 1 })}>
              <rect className={`bd-sq bd-sq--hunt ${g.last.includes(i) ? 'bd-sq--last' : ''}`} x={x + 0.03} y={y + 0.03} width={0.94} height={0.94} rx={0.1} />
              {h?.includes(i) && <rect className="bd-hintring" x={x + 0.08} y={y + 0.08} width={0.84} height={0.84} rx={0.1} />}
              {p !== 0 && <circle className={`bd-stone bd-stone--${p === 1 ? 'b' : 'w'} ${from === i ? 'bd-stone--pick' : ''} ${removable.includes(i) ? 'bd-stone--remove' : ''}`} cx={x + 0.5} cy={y + 0.5} r={0.36} />}
              {p === 0 && landings.includes(i) && <circle className="bd-dot" cx={x + 0.5} cy={y + 0.5} r={0.12} />}
            </g>
          )
        })}
      </svg>
    </VsShell>
  )
}
