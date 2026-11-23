import { useState } from 'react'
import { TARGETS, TARGET_IDS, hold, rollDie, rollWith, shouldHold, start, type Pig, type PigTargetId } from '../../../games/domain/pig'
import { SKILL_LIST, type Skill } from '../../../games/domain/search'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { LevelBar } from './parts'
import { OPENINGS, useComputerTurn, usePref, type Opening } from './board/shared'
import { VsShell } from './board/VsShell'
import { useCardGame } from './cards/useCardGame'

const NAMES: Record<PigTargetId, StringKey> = { quick: 'pig.target.quick', classic: 'pig.target.classic', long: 'pig.target.long' }
const PIPS: Record<number, [number, number][]> = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] }

/** Pig against the computer: roll as often as you dare, hold to bank. A 1 loses everything you rolled this turn. */
export function PigScreen() {
  const [skill, setSkill] = usePref<Skill>('pig', 'skill', SKILL_LIST, 'captain')
  const [target, setTarget] = usePref<PigTargetId>('pig', 'target', TARGET_IDS, 'classic')
  const [opening, setOpening] = usePref<Opening>('pig', 'opening', OPENINGS, 'you')
  const [started, setStarted] = useState(false)
  const game = useCardGame<Pig>(() => start(TARGETS.classic))
  const g = game.state
  const [tip, setTip] = useState('')
  const over = g.winner !== 0
  const mine = !over && g.turn === 0

  const doRoll = () => { game.commit(rollWith(g, rollDie())); setTip('') }
  const doHold = () => { game.commit(hold(g)); setTip('') }
  useComputerTurn(started && !over && g.turn === 1, skill, g, () => game.commit(shouldHold(g, skill) ? hold(g) : rollWith(g, rollDie())))
  const reset = () => { game.restart({ ...start(TARGETS[target]), turn: opening === 'you' ? 0 : 1 }); setTip('') }
  const hint = () => setTip(g.total === 0 ? t('pig.hint.roll') : shouldHold(g, 'captain') ? t('pig.hint.hold') : t('pig.hint.rollon'))
  const w = g.winner

  return (
    <VsShell
      game="pig" name="pig" skill={skill} onSkill={setSkill} opening={opening} onOpening={setOpening} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      options={<LevelBar name="pig-target" legend={t('pig.target.label')} levels={TARGET_IDS.map((id) => ({ id, label: t(NAMES[id], { n: TARGETS[id] }) }))} level={target} onLevel={setTarget} />}
      status={mine ? (g.roll === null ? t('pig.yourTurn') : t('bd.yourTurn')) : t('pig.cpuTurn', { n: g.total })} thinking={!mine && !over}
      result={over ? { title: t(w === 1 ? 'bd.win' : 'bd.lose'), body: t('pig.final', { a: g.scores[0] + (w === 1 ? g.total : 0), b: g.scores[1] }), outcome: w === 1 ? 'win' : 'loss' } : null}
      meta={<span>{t('pig.target', { n: g.target })}</span>}
      tools={<button type="button" className="sd-tool" onClick={hint} disabled={!mine}><span>{t('bd.hint')}</span></button>}
      help={<><p>{t('pig.help.1')}</p><p>{t('pig.help.2')}</p></>}
    >
      <div className="bd-pig" role="group" aria-label={t('pig.aria', { a: g.scores[0], b: g.scores[1], n: g.total })}>
        <div className={`bd-pig__side ${g.turn === 0 && !over ? 'bd-pig__side--on' : ''}`}><span>{t('pig.you')}</span><b>{g.scores[0]}</b></div>
        <div className="bd-pig__mid">
          <svg className="bd-die-svg" viewBox="0 0 3 3" role="img" aria-label={g.roll === null ? t('pig.noroll') : t('bk.die', { n: g.roll })}>
            <rect className={`bd-die-face ${g.roll === 1 ? 'bd-die-face--bust' : ''}`} x={0.02} y={0.02} width={2.96} height={2.96} rx={0.4} />
            {g.roll !== null && PIPS[g.roll].map(([x, y], i) => <circle key={i} className="bd-die-pip" cx={x + 0.5} cy={y + 0.5} r={0.22} />)}
          </svg>
          <p className="bd-pig__total" aria-live="polite">{t('pig.turn', { n: g.total })}</p>
        </div>
        <div className={`bd-pig__side ${g.turn === 1 && !over ? 'bd-pig__side--on' : ''}`}><span>{t('pig.cpu')}</span><b>{g.scores[1]}</b></div>
      </div>
      {!over && <div className="button-row"><Button onClick={doRoll} disabled={!mine}>{t('pig.roll')}</Button><Button variant="secondary" onClick={doHold} disabled={!mine || g.total === 0}>{t('pig.hold', { n: g.total })}</Button></div>}
      {tip && <p className="bd-note" role="status">{tip}</p>}
    </VsShell>
  )
}
