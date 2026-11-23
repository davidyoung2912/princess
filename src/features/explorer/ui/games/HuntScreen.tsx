import { useState } from 'react'
import * as bd from '../../../games/domain/brandubh'
import * as fg from '../../../games/domain/foxGeese'
import type { Skill } from '../../../games/domain/search'
import { t, type StringKey } from '../../../../shared/i18n'
import { LevelBar } from './parts'
import { useComputerTurn, useRoving } from './board/shared'
import { VsShell } from './board/VsShell'
import { useCardGame } from './cards/useCardGame'

type Mode = 'fox' | 'brandubh'
type Pos = { mode: 'fox'; s: fg.FoxGeese } | { mode: 'brandubh'; s: bd.Brandubh }
interface Mv { from: number; to: number; jumped?: number | null }

const N = 7
const MODES: readonly Mode[] = ['fox', 'brandubh']
const MODE_NAMES: Record<Mode, StringKey> = { fox: 'hg.mode.fox', brandubh: 'hg.mode.brandubh' }
/** The side that moves first is listed first: the geese, and the attackers. */
const SIDES: Record<Mode, [string, StringKey][]> = { fox: [['geese', 'hg.side.geese'], ['fox', 'hg.side.fox']], brandubh: [['attackers', 'hg.side.attackers'], ['defenders', 'hg.side.defenders']] }

const begin = (m: Mode): Pos => (m === 'fox' ? { mode: 'fox', s: fg.start() } : { mode: 'brandubh', s: bd.start() })
const movesOf = (p: Pos): Mv[] => (p.mode === 'fox' ? fg.legalMoves(p.s) : bd.legalMoves(p.s))
const step = (p: Pos, m: Mv): Pos => (p.mode === 'fox' ? { mode: 'fox', s: fg.apply(p.s, m as fg.Move) } : { mode: 'brandubh', s: bd.apply(p.s, m) })
const choose = (p: Pos, skill: Skill): Mv | null => (p.mode === 'fox' ? fg.chooseMove(p.s, skill) : bd.chooseMove(p.s, skill))
const cells = (p: Pos): number[] => p.s.board
const valid = (p: Pos, i: number) => p.mode === 'brandubh' || fg.valid(i)

/** Fox and Geese or Brandubh (a small Hnefatafl) against the computer, playing either side. Tap a piece to see where it can go, then tap a point. */
export function HuntScreen() {
  const [skill, setSkill] = useState<Skill>('captain')
  const [mode, setMode] = useState<Mode>('fox')
  const [side, setSide] = useState<string>('geese')
  const [started, setStarted] = useState(false)
  const game = useCardGame<Pos>(() => begin('fox'))
  const g = game.state
  const [from, setFrom] = useState<number | null>(null)
  const winner = g.s.winner
  const over = winner !== ''
  const mine = !over && g.s.turn === side
  const all = movesOf(g)
  const targets = from === null || !mine ? [] : all.filter((m) => m.from === from).map((m) => m.to)

  const pick = (i: number) => {
    if (!mine) return
    const m = from !== null && all.find((x) => x.from === from && x.to === i)
    if (m) { game.commit(step(g, m)); setFrom(null); return }
    setFrom(all.some((x) => x.from === i) && from !== i ? i : null)
  }
  useComputerTurn(started && !over && g.s.turn !== side, skill, g, () => { const m = choose(g, skill); if (m) game.commit(step(g, m)) })
  const { root, props } = useRoving(N, 49, pick)
  const reset = () => { game.restart(begin(mode)); setFrom(null) }
  const changeMode = (m: Mode) => { setMode(m); setSide(SIDES[m][0][0]) }
  const geeseLeft = g.mode === 'fox' ? fg.geese(g.s) : 0
  const youWon = winner === side
  const last = g.s.last

  return (
    <VsShell
      name="hunt" skill={skill} onSkill={setSkill} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      options={<>
        <LevelBar name="hunt-mode" legend={t('hg.mode.label')} levels={MODES.map((m) => ({ id: m, label: t(MODE_NAMES[m]) }))} level={mode} onLevel={changeMode} />
        <LevelBar name="hunt-side" legend={t('hg.side.label')} levels={SIDES[mode].map(([id, k]) => ({ id, label: t(k) }))} level={side} onLevel={setSide} />
      </>}
      status={t(mine ? 'bd.yourTurn' : 'bd.thinking')} thinking={!mine && !over}
      result={over ? { title: t(youWon ? 'bd.win' : 'bd.lose'), body: t(`hg.final.${g.mode === 'fox' ? 'fox' : 'bd'}.${winner}` as StringKey) } : null}
      meta={g.mode === 'fox' ? <span>{t('hg.geese', { n: geeseLeft })}</span> : <span>{t('gm.moves', { n: g.s.moves })}</span>}
      undo={{ can: game.canUndo, run: () => { game.undoUntil((s) => s.s.turn === side && s.s.winner === ''); setFrom(null) } }}
      help={<><p>{t(g.mode === 'fox' ? 'hg.help.fox.1' : 'hg.help.bd.1')}</p><p>{t(g.mode === 'fox' ? 'hg.help.fox.2' : 'hg.help.bd.2')}</p></>}
    >
      <svg ref={root} className="bd-board bd-board--hunt" viewBox={`0 0 ${N} ${N}`} role="group" aria-label={t(g.mode === 'fox' ? 'hg.aria.fox' : 'hg.aria.bd')}>
        {cells(g).map((p, i) => {
          if (!valid(g, i)) return null
          const x = i % N, y = Math.floor(i / N)
          const corner = g.mode === 'brandubh' && bd.CORNERS.includes(i)
          const throne = g.mode === 'brandubh' && i === bd.THRONE
          const kind = g.mode === 'fox' ? (p === 1 ? 'fox' : p === 2 ? 'goose' : '') : p === 1 ? 'attacker' : p === 2 ? 'defender' : p === 3 ? 'king' : ''
          return (
            <g key={i} {...props(i)} onClick={() => pick(i)} className="bd-hit" aria-label={kind ? t(`hg.cell.${kind}` as StringKey) : t(targets.includes(i) ? 'hg.cell.target' : 'hg.cell.empty')}>
              <rect className={`bd-sq bd-sq--hunt ${corner ? 'bd-sq--corner' : ''} ${throne ? 'bd-sq--throne' : ''} ${last === i ? 'bd-sq--last' : ''}`} x={x + 0.03} y={y + 0.03} width={0.94} height={0.94} rx={0.12} />
              {kind && <circle className={`bd-piece bd-piece--${kind} ${from === i ? 'bd-piece--pick' : ''}`} cx={x + 0.5} cy={y + 0.5} r={kind === 'king' ? 0.38 : 0.33} />}
              {kind === 'king' && <path className="bd-crown" d={`M${x + 0.3} ${y + 0.62} L${x + 0.3} ${y + 0.4} L${x + 0.4} ${y + 0.5} L${x + 0.5} ${y + 0.34} L${x + 0.6} ${y + 0.5} L${x + 0.7} ${y + 0.4} L${x + 0.7} ${y + 0.62} Z`} />}
              {kind === 'fox' && <path className="bd-crown" d={`M${x + 0.3} ${y + 0.62} L${x + 0.34} ${y + 0.36} L${x + 0.45} ${y + 0.48} L${x + 0.55} ${y + 0.48} L${x + 0.66} ${y + 0.36} L${x + 0.7} ${y + 0.62} Z`} />}
              {!kind && targets.includes(i) && <circle className="bd-dot" cx={x + 0.5} cy={y + 0.5} r={0.11} />}
            </g>
          )
        })}
      </svg>
    </VsShell>
  )
}
