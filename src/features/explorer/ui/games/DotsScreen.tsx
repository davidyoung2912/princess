import { useState } from 'react'
import { SIZES, SIZE_IDS, chooseMove, freeEdges, hCount, isOver, play, start, winner, type Dots, type DotsSizeId } from '../../../games/domain/dots'
import { SKILL_LIST, type Skill } from '../../../games/domain/search'
import { t, type StringKey } from '../../../../shared/i18n'
import { LevelBar } from './parts'
import { OPENINGS, useComputerTurn, useHint, usePref, type Opening } from './board/shared'
import { VsShell } from './board/VsShell'
import { useCardGame } from './cards/useCardGame'

const NAMES: Record<DotsSizeId, StringKey> = { small: 'db.size.small', medium: 'db.size.medium', large: 'db.size.large' }
const STEP = 1

/** Dots and Boxes: you are blue and draw first. Finish a box's fourth side to take it and go again. Lines are real buttons, so they work by keyboard and screen reader. */
export function DotsScreen() {
  const [skill, setSkill] = usePref<Skill>('dots', 'skill', SKILL_LIST, 'captain')
  const [size, setSize] = usePref<DotsSizeId>('dots', 'size', SIZE_IDS, 'small')
  const [opening, setOpening] = usePref<Opening>('dots', 'opening', OPENINGS, 'you')
  const hint = useHint<Dots, number>()
  const [started, setStarted] = useState(false)
  const game = useCardGame<Dots>(() => start(3))
  const g = game.state
  const n = g.w
  const over = isOver(g)
  const mine = !over && g.turn === 1
  const H = hCount(g.w, g.h)
  const draw = (e: number) => { if (!mine) return; const next = play(g, e); if (next) game.commit(next) }
  useComputerTurn(started && !over && g.turn === 2, skill, g, () => { const m = chooseMove(g, skill); if (m !== null) { const next = play(g, m); if (next) game.commit(next) } })
  const reset = () => { game.restart(opening === 'you' ? start(SIZES[size]) : { ...start(SIZES[size]), turn: 2 }); hint.reset() }
  const w = winner(g)
  const pt = (k: number) => 0.5 + k * STEP
  const line = (e: number) => {
    if (e < H) { const r = Math.floor(e / n), c = e % n; return { x1: pt(c), y1: pt(r), x2: pt(c + 1), y2: pt(r), label: t('db.line.h', { r: r + 1, c: c + 1 }) } }
    const k = e - H, r = Math.floor(k / (n + 1)), c = k % (n + 1)
    return { x1: pt(c), y1: pt(r), x2: pt(c), y2: pt(r + 1), label: t('db.line.v', { r: r + 1, c: c + 1 }) }
  }

  return (
    <VsShell
      game="dots" name="dots" opening={opening} onOpening={setOpening} skill={skill} onSkill={setSkill} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      options={<LevelBar name="dots-size" legend={t('db.size.label')} levels={SIZE_IDS.map((s) => ({ id: s, label: `${t(NAMES[s])} ${SIZES[s]}×${SIZES[s]}` }))} level={size} onLevel={setSize} />}
      status={t(mine ? (g.taken.length ? 'db.again' : 'bd.yourTurn') : 'bd.thinking')} thinking={!mine && !over}
      result={over ? { title: t(w === 1 ? 'bd.win' : w === 2 ? 'bd.lose' : 'bd.draw'), body: t('db.final', { a: g.scores[0], b: g.scores[1] }), outcome: w === 1 ? 'win' : w === 2 ? 'loss' : 'draw' } : null}
      meta={<span>{t('db.score', { a: g.scores[0], b: g.scores[1] })}</span>}
      hint={{ run: () => { const m = chooseMove(g, 'captain'); if (m !== null) hint.give(g, m) }, shown: hint.of(g) !== null, used: hint.used }}
      help={<><p>{t('db.help.1')}</p><p>{t('db.help.2')}</p></>}
    >
      <svg className="bd-board bd-board--dots" viewBox={`0 0 ${n + 1} ${n + 1}`} role="group" aria-label={t('db.aria', { a: g.scores[0], b: g.scores[1] })}>
        <rect className="bd-panel" x={0} y={0} width={n + 1} height={n + 1} rx={0.2} />
        {g.owner.map((o, b) => o !== 0 && <rect key={b} className={`bd-box bd-box--${o === 1 ? 'you' : 'cpu'}`} x={pt(b % n) + 0.08} y={pt(Math.floor(b / n)) + 0.08} width={0.84} height={0.84} rx={0.1} />)}
        {Array.from({ length: g.edges.length }, (_, e) => {
          const l = line(e)
          const drawn = g.edges[e]
          return (
            <g key={e} className="bd-hit">
              <line className={`bd-edgeline ${drawn ? 'bd-edgeline--on' : ''} ${g.last === e ? 'bd-edgeline--last' : ''} ${hint.of(g) === e ? 'bd-edgeline--hint' : ''}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
              {!drawn && <line className="bd-edgetap" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} onClick={() => draw(e)} />}
            </g>
          )
        })}
        {Array.from({ length: (n + 1) * (n + 1) }, (_, i) => <circle key={i} className="bd-pip" cx={pt(i % (n + 1))} cy={pt(Math.floor(i / (n + 1)))} r={0.07} />)}
      </svg>
      <div className="bd-linelist" role="group" aria-label={t('db.lines')}>
        {freeEdges(g).map((e) => <button key={e} type="button" className="visually-hidden" disabled={!mine} onClick={() => draw(e)}>{line(e).label}</button>)}
      </div>
    </VsShell>
  )
}
