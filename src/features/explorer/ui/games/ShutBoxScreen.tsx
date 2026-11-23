import { useState } from 'react'
import { SIZES, SIZE_IDS, canMove, choose, close, endTurn, isOver, rollDice, rollFor, start, winner, type Box, type BoxSizeId } from '../../../games/domain/shutbox'
import { SKILL_LIST, type Skill } from '../../../games/domain/search'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { LevelBar } from './parts'
import { OPENINGS, useComputerTurn, useHint, usePref, type Opening } from './board/shared'
import { VsShell } from './board/VsShell'
import { useCardGame } from './cards/useCardGame'

const NAMES: Record<BoxSizeId, StringKey> = { nine: 'sb.size.nine', ten: 'sb.size.ten', twelve: 'sb.size.twelve' }
const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0)

/** Shut the Box against the computer: roll, then close any tiles that add up to the roll. When you are stuck, the open tiles are your score, and the lowest score wins. */
export function ShutBoxScreen() {
  const [skill, setSkill] = usePref<Skill>('shutbox', 'skill', SKILL_LIST, 'captain')
  const [size, setSize] = usePref<BoxSizeId>('shutbox', 'size', SIZE_IDS, 'nine')
  const [opening, setOpening] = usePref<Opening>('shutbox', 'opening', OPENINGS, 'you')
  const [started, setStarted] = useState(false)
  const game = useCardGame<Box>(() => start(9))
  const g = game.state
  const [chosen, setChosen] = useState<number[]>([])
  const hint = useHint<Box, number[]>()
  const over = isOver(g)
  const mine = !over && g.turn === 0
  const rolled = g.dice.length > 0
  const total = sum(g.dice)
  const stuck = mine && rolled && !canMove(g)
  const h = hint.of(g)

  const roll = () => { game.commit(rollFor(g, rollDice(g.open))); setChosen([]) }
  const toggle = (v: number) => { if (!mine || !rolled) return; const next = chosen.includes(v) ? chosen.filter((x) => x !== v) : [...chosen, v]; setChosen(next); if (sum(next) === total) { const b = close(g, next); if (b) { game.commit(b); setChosen([]) } } }
  const pass = () => { game.commit(endTurn(g)); setChosen([]) }
  useComputerTurn(started && !over && g.turn === 1, skill, g, () => {
    if (!rolled) { game.commit(rollFor(g, rollDice(g.open))); return }
    const m = choose(g, skill)
    game.commit(m ? close(g, m)! : endTurn(g))
  })
  const reset = () => { game.restart({ ...start(SIZES[size]), turn: opening === 'you' ? 0 : 1 }); setChosen([]); hint.reset() }
  const w = winner(g)
  const mineScore = g.scores[0], theirScore = g.scores[1]

  return (
    <VsShell
      game="shutbox" name="shutbox" skill={skill} onSkill={setSkill} opening={opening} onOpening={setOpening} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      options={<LevelBar name="shutbox-size" legend={t('sb.size.label')} levels={SIZE_IDS.map((s) => ({ id: s, label: t(NAMES[s], { n: SIZES[s] }) }))} level={size} onLevel={setSize} />}
      status={!mine ? t('sb.cpu') : !rolled ? t('sb.roll') : stuck ? t('sb.stuck', { n: sum(g.open) }) : t('sb.close', { n: total })} thinking={!mine && !over}
      result={over ? { title: t(w === 1 ? 'bd.win' : w === 2 ? 'bd.lose' : 'bd.draw'), body: t('sb.final', { a: mineScore ?? 0, b: theirScore ?? 0 }), outcome: w === 1 ? 'win' : w === 2 ? 'loss' : 'draw' } : null}
      meta={<span>{t('sb.score', { a: mineScore ?? '–', b: theirScore ?? '–' })}</span>}
      hint={{ run: () => { if (!mine || !rolled) return; const m = choose(g, 'admiral'); if (m) hint.give(g, m) }, shown: h !== null, used: hint.used }}
      help={<><p>{t('sb.help.1')}</p><p>{t('sb.help.2')}</p></>}
    >
      <div className="bd-box" role="group" aria-label={t('sb.aria', { n: sum(g.open) })}>
        <div className="bd-box__tiles">
          {Array.from({ length: g.n }, (_, i) => i + 1).map((v) => {
            const isOpen = g.open.includes(v)
            return <button key={v} type="button" className={`bd-tilebox ${isOpen ? '' : 'bd-tilebox--shut'} ${chosen.includes(v) ? 'bd-tilebox--on' : ''} ${h?.includes(v) ? 'bd-tilebox--hint' : ''}`} disabled={!mine || !rolled || !isOpen || stuck} aria-pressed={chosen.includes(v)} aria-label={t(isOpen ? 'sb.tile.open' : 'sb.tile.shut', { n: v })} onClick={() => toggle(v)}>{isOpen ? v : ''}</button>
          })}
        </div>
        <div className="bd-dice">{g.dice.length ? g.dice.map((d, k) => <span key={k} className="bd-die" role="img" aria-label={t('bk.die', { n: d })}>{d}</span>) : <span className="bd-dice__none">{t('bk.nodice')}</span>}</div>
        {mine && !rolled && <Button onClick={roll}>{t('bk.rollbtn')}</Button>}
        {stuck && <Button onClick={pass}>{t('sb.end')}</Button>}
        {mine && rolled && !stuck && <p className="bd-note">{t('sb.chosen', { a: sum(chosen), b: total })}</p>}
      </div>
    </VsShell>
  )
}
