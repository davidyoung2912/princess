import { useState } from 'react'
import { applyStep, canPlay, chooseTurn, endTurn, legalSteps, pipCount, rollDice, start, withDice, type Backgammon, type Step } from '../../../games/domain/backgammon'
import { SKILL_LIST, type Skill } from '../../../games/domain/search'
import { t } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { OPENINGS, useComputerTurn, useHint, usePref, type Opening } from './board/shared'
import { VsShell } from './board/VsShell'
import { useCardGame } from './cards/useCardGame'

/** Column of each point in the drawing: the top row runs 12..23 left to right, the bottom row 11..0, with the bar between the two halves. */
const colOf = (p: number) => { const k = p >= 12 ? p - 12 : 11 - p; return k + (k >= 6 ? 1 : 0) }
const BAR_X = 6, W = 14, H = 11
const BAR = 'bar'

/** Backgammon against the computer: you are white and move from the top right round to the bottom right, then bear off. Roll, tap a disc, tap where it goes. */
export function BackgammonScreen() {
  const [skill, setSkill] = usePref<Skill>('backgammon', 'skill', SKILL_LIST, 'captain')
  const [opening, setOpening] = usePref<Opening>('backgammon', 'opening', OPENINGS, 'you')
  const hint = useHint<Backgammon, Step>()
  const [started, setStarted] = useState(false)
  const game = useCardGame<Backgammon>(start)
  const g = game.state
  const [from, setFrom] = useState<number | typeof BAR | null>(null)
  const [note, setNote] = useState('')
  const over = g.winner !== 0
  const mine = !over && g.turn === 0
  const rolled = g.dice.length > 0
  const steps = mine && rolled ? legalSteps(g) : []
  const stuck = mine && rolled && steps.length === 0
  const mineTo = from === null ? [] : steps.filter((s) => s.from === from)

  const afterStep = (next: Backgammon) => (next.winner || canPlay(next) ? next : endTurn(next))
  const act = (s: Step) => { game.commit(afterStep(applyStep(g, s))); setFrom(null); setNote('') }
  const choose = (target: number | 'off') => { const s = mineTo.find((x) => x.to === target); if (s) act(s); else setFrom(null) }
  const sources = new Set(steps.map((s) => s.from))
  const tapSource = (f: number | typeof BAR) => { if (!mine) return; if (from === f) { setFrom(null); return } if (sources.has(f)) { setFrom(f); setNote('') } }
  const roll = () => { const d = rollDice(); const next = withDice(g, d); game.commit(next); setNote('') }
  const pass = () => { game.commit(endTurn(g)); setNote(t('bk.passed')); setFrom(null) }

  useComputerTurn(started && !over && g.turn === 1, skill, g, () => {
    if (g.dice.length === 0) { game.commit(withDice(g, rollDice())); return }
    let cur = g
    for (const s of chooseTurn(g, skill)) cur = applyStep(cur, s)
    game.commit(cur.winner ? cur : endTurn(cur))
  })
  const reset = () => { game.restart(opening === 'you' ? start() : { ...start(), turn: 1 }); setFrom(null); setNote(''); hint.reset() }
  const w = g.winner

  const disc = (side: 0 | 1, x: number, y: number, k: number, key: string, picked = false) => <circle key={key} className={`bd-disc bd-disc--${side === 0 ? 'w' : 'b'} ${picked ? 'bd-disc--pick' : ''}`} cx={x} cy={y} r={0.43} data-k={k} />
  const stack = (p: number) => {
    const n = Math.abs(g.points[p]), side: 0 | 1 = g.points[p] > 0 ? 0 : 1
    const top = p >= 12
    const x = colOf(p) + 0.5
    const shown = Math.min(n, 5)
    return (
      <g key={`d${p}`} pointerEvents="none">
        {Array.from({ length: shown }, (_, k) => disc(side, x, top ? 0.55 + k * 0.9 : H - 0.55 - k * 0.9, k, `${p}-${k}`, from === p && k === shown - 1))}
        {n > 5 && <text className="bd-count" x={x} y={top ? 0.55 + 4 * 0.9 + 0.12 : H - 0.55 - 4 * 0.9 + 0.12} textAnchor="middle">{n}</text>}
      </g>
    )
  }
  const dieFace = (d: number, k: number, used: boolean) => <span key={k} className={`bd-die ${used ? 'bd-die--used' : ''}`} role="img" aria-label={t('bk.die', { n: d })}>{d}</span>
  const usedIdx = (() => { const left = g.left.slice(); return g.dice.map((d) => { const i = left.indexOf(d); if (i >= 0) { left.splice(i, 1); return false } return true }) })()

  return (
    <VsShell
      game="backgammon" name="backgammon" opening={opening} onOpening={setOpening} skill={skill} onSkill={setSkill} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      status={note || (mine ? (rolled ? (stuck ? t('bk.nomove') : t('bk.move')) : t('bk.roll')) : t('bd.thinking'))} thinking={!mine && !over}
      result={over ? { title: t(w === 1 ? 'bd.win' : 'bd.lose'), body: t('bk.final', { a: g.off[0], b: g.off[1] }), outcome: w === 1 ? 'win' : 'loss' } : null}
      meta={<span>{t('bk.pips', { a: pipCount(g, 0), b: pipCount(g, 1) })}</span>}
      undo={{ can: game.canUndo, run: () => {
        const startOfTurn = g.left.length === g.dice.length
        if (g.turn === 0 && rolled && !startOfTurn) game.undo()
        else game.undoUntil((s) => s.turn === 0 && s.dice.length > 0 && s.left.length === s.dice.length && s.winner === 0)
        setFrom(null); setNote('')
      } }}
      hint={{ run: () => { if (!mine) return; if (!rolled) { setNote(t('bk.roll')); return } const seq = chooseTurn(g, 'captain'); if (seq.length) { hint.give(g, seq[0]); setFrom(seq[0].from) } }, shown: hint.of(g) !== null, used: hint.used }}
      tools={stuck ? <button type="button" className="sd-tool sd-tool--go" onClick={pass}><span>{t('bk.pass')}</span></button> : null}
      help={<><p>{t('bk.help.1')}</p><p>{t('bk.help.2')}</p></>}
    >
      <div className="bd-dice" aria-live="polite">{g.dice.length ? g.dice.map((d, k) => dieFace(d, k, usedIdx[k])) : <span className="bd-dice__none">{t('bk.nodice')}</span>}</div>
      <svg className="bd-board bd-board--bg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t('bk.aria', { a: g.off[0], b: g.off[1] })}>
        <rect className="bd-wood" x={0} y={0} width={W} height={H} rx={0.3} />
        <rect className="bd-barstrip" x={BAR_X} y={0} width={1} height={H} />
        {Array.from({ length: 24 }, (_, p) => {
          const top = p >= 12, x = colOf(p)
          const dest = mineTo.some((s) => s.to === p)
          const label = t('bk.point', { n: p + 1, s: Math.abs(g.points[p]) })
          return (
            <g key={p} data-p={p} role="button" tabIndex={mine ? 0 : -1} aria-label={label} className="bd-hit" onClick={() => (dest ? choose(p) : g.points[p] > 0 ? tapSource(p) : setFrom(null))}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (dest) choose(p); else if (g.points[p] > 0) tapSource(p) } }}>
              <polygon className={`bd-tri bd-tri--${p % 2 ? 'a' : 'b'} ${dest ? 'bd-tri--dest' : ''} ${hint.of(g)?.to === p ? 'bd-tri--hint' : ''}`} points={top ? `${x},0 ${x + 1},0 ${x + 0.5},${H * 0.45}` : `${x},${H} ${x + 1},${H} ${x + 0.5},${H * 0.55}`} />
            </g>
          )
        })}
        {Array.from({ length: 24 }, (_, p) => (g.points[p] !== 0 ? stack(p) : null))}
        {g.bar[0] > 0 && (
          <g role="button" tabIndex={mine ? 0 : -1} className="bd-hit" aria-label={t('bk.bar', { n: g.bar[0] })} onClick={() => tapSource(BAR)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapSource(BAR) } }}>
            {Array.from({ length: Math.min(g.bar[0], 4) }, (_, k) => disc(0, BAR_X + 0.5, H / 2 + 0.6 + k * 0.9, k, `bw${k}`, from === BAR && k === 0))}
          </g>
        )}
        {g.bar[1] > 0 && Array.from({ length: Math.min(g.bar[1], 4) }, (_, k) => disc(1, BAR_X + 0.5, H / 2 - 0.6 - k * 0.9, k, `bb${k}`))}
        <g role="button" tabIndex={mine && mineTo.some((s) => s.to === 'off') ? 0 : -1} className="bd-hit" aria-label={t('bk.off', { n: g.off[0] })} onClick={() => choose('off')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose('off') } }}>
          <rect className={`bd-tray ${mineTo.some((s) => s.to === 'off') ? 'bd-tray--dest' : ''}`} x={W - 1} y={H / 2} width={0.9} height={H / 2 - 0.1} rx={0.1} />
          <text className="bd-count" x={W - 0.55} y={H - 0.4} textAnchor="middle">{g.off[0]}</text>
        </g>
        <g aria-hidden="true"><rect className="bd-tray" x={W - 1} y={0.1} width={0.9} height={H / 2 - 0.1} rx={0.1} /><text className="bd-count" x={W - 0.55} y={0.9} textAnchor="middle">{g.off[1]}</text></g>
      </svg>
      {mine && !rolled && <Button onClick={roll}>{t('bk.rollbtn')}</Button>}
    </VsShell>
  )
}
