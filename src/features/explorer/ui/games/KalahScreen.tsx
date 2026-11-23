import { useState, type CSSProperties } from 'react'
import { SEEDS, SIZE_IDS, STORE, chooseMove, legalMoves, pitsOf, scores, sow, start, winner, type Kalah, type KalahSizeId } from '../../../games/domain/kalah'
import type { Skill } from '../../../games/domain/search'
import { t, type StringKey } from '../../../../shared/i18n'
import { LevelBar } from './parts'
import { useComputerTurn } from './board/shared'
import { VsShell } from './board/VsShell'
import { useCardGame } from './cards/useCardGame'

const NAMES: Record<KalahSizeId, StringKey> = { short: 'ka.size.short', classic: 'ka.size.classic', long: 'ka.size.long' }

/** Mancala (Kalah): your pits are along the bottom, the computer's along the top, stores at the ends. Seeds are sown for you automatically; the last pit sown is highlighted. */
export function KalahScreen() {
  const [skill, setSkill] = useState<Skill>('captain')
  const [size, setSize] = useState<KalahSizeId>('classic')
  const [started, setStarted] = useState(false)
  const game = useCardGame<Kalah>(() => start(4))
  const g = game.state
  const [note, setNote] = useState('')
  const [lit, setLit] = useState<number[]>([])
  const over = g.over
  const mine = !over && g.turn === 0
  const legal = mine ? legalMoves(g) : []

  const sowAt = (pit: number, who: 'you' | 'cpu') => {
    const r = sow(g, pit)
    if (!r) return
    game.commit(r.game)
    setLit(r.path)
    setNote(r.captured ? t(`ka.note.${who}.capture` as StringKey, { n: r.captured.count }) : r.extra ? t(`ka.note.${who}.extra` as StringKey) : '')
  }
  useComputerTurn(started && !over && g.turn === 1, skill, g, () => { const m = chooseMove(g, skill); if (m !== null) sowAt(m, 'cpu') })
  const reset = () => { game.restart(start(SEEDS[size])); setNote(''); setLit([]) }
  const [a, b] = scores(g)
  const w = winner(g)
  const top = [12, 11, 10, 9, 8, 7]

  const pit = (i: number, mineRow: boolean) => (
    <button key={i} type="button" className={`bd-pit ${lit.includes(i) ? 'bd-pit--lit' : ''} ${legal.includes(i) ? 'bd-pit--can' : ''}`} disabled={!mineRow || !legal.includes(i)} onClick={() => sowAt(i, 'you')} aria-label={t(mineRow ? 'ka.pit.yours' : 'ka.pit.theirs', { n: mineRow ? i + 1 : 13 - i, s: g.pits[i] })}>
      <span className="bd-seeds" aria-hidden="true">{Array.from({ length: Math.min(g.pits[i], 12) }, (_, k) => <i key={k} style={{ '--k': k } as CSSProperties} />)}</span>
      <b aria-hidden="true">{g.pits[i]}</b>
    </button>
  )

  return (
    <VsShell
      name="kalah" skill={skill} onSkill={setSkill} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      options={<LevelBar name="kalah-size" legend={t('ka.size.label')} levels={SIZE_IDS.map((s) => ({ id: s, label: t(NAMES[s], { n: SEEDS[s] }) }))} level={size} onLevel={setSize} />}
      status={note || t(mine ? 'bd.yourTurn' : 'bd.thinking')} thinking={!mine && !over}
      result={over ? { title: t(w === 1 ? 'bd.win' : w === 2 ? 'bd.lose' : 'bd.draw'), body: t('ka.final', { a, b }) } : null}
      meta={<span>{t('db.score', { a, b })}</span>}
      undo={{ can: game.canUndo, run: () => { game.undoUntil((s) => s.turn === 0 && !s.over); setNote(''); setLit([]) } }}
      help={<><p>{t('ka.help.1')}</p><p>{t('ka.help.2')}</p></>}
    >
      <div className="bd-kalah" role="group" aria-label={t('ka.aria', { a, b })}>
        <div className="bd-store bd-store--cpu" aria-label={t('ka.store.theirs', { n: b })}><b>{b}</b></div>
        <div className="bd-kalah__rows">
          <div className="bd-kalah__row">{top.map((i) => pit(i, false))}</div>
          <div className="bd-kalah__row">{pitsOf(0).map((i) => pit(i, true))}</div>
        </div>
        <div className={`bd-store bd-store--you ${lit.includes(STORE[0]) ? 'bd-pit--lit' : ''}`} aria-label={t('ka.store.yours', { n: a })}><b>{a}</b></div>
      </div>
    </VsShell>
  )
}
