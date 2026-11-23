import { useMemo, useState } from 'react'
import { SIZES, SIZE_IDS, allCodes, chooseGuess, consistent, randomCode, score, type Code, type MindSizeId, type Turn } from '../../../games/domain/mastermind'
import { SKILL_LIST, type Skill } from '../../../games/domain/search'
import { t, type StringKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { GameShare, IncomingNote, LevelBar } from './parts'
import { useIncomingGame } from './gameHooks'
import { seededShare } from '../../../games/domain/share'
import { seededRng } from '../../../games/domain/cards'
import { randomDealNumber } from './cards/dealNumber'
import { useComputerTurn, usePref } from './board/shared'
import { VsShell } from './board/VsShell'

const NAMES: Record<MindSizeId, StringKey> = { easy: 'mm.size.easy', classic: 'mm.size.classic', hard: 'mm.size.hard' }
type Mode = 'break' | 'make'
const MODES: readonly Mode[] = ['break', 'make']
/** A shape in each peg as well as a colour, so the pegs can be told apart without colour. */
const GLYPH = ['●', '▲', '■', '◆', '★', '✚', '♥', '♣']

/** Mastermind: break the computer's secret code from the black and white clues, or make a code and watch the computer work it out. The clues are always scored honestly. */
export function MastermindScreen() {
  const [skill, setSkill] = usePref<Skill>('mastermind', 'skill', SKILL_LIST, 'captain')
  const { incoming, fromChat, leaveChat } = useIncomingGame('mastermind')
  const sent = incoming && incoming.shared.game === 'mastermind' ? incoming.shared.puzzle : null
  /** While a code sent from a chat is in play the size is the sender's and the player is breaking; changing either option goes back to the player's own choices. */
  const [forced, setForced] = useState(sent)
  const [chosenSize, setSize] = usePref<MindSizeId>('mastermind', 'size', SIZE_IDS, 'classic')
  const [chosenMode, setMode] = usePref<Mode>('mastermind', 'mode', MODES, 'break')
  const size = (forced?.level as MindSizeId | undefined) ?? chosenSize
  const mode: Mode = forced ? 'break' : chosenMode
  const [seed, setSeed] = useState<number | null>(sent?.seed ?? null)
  const [started, setStarted] = useState(sent !== null)
  const { colours, length, tries } = SIZES[size]
  const [secret, setSecret] = useState<Code | null>(() => (sent ? randomCode(SIZES[sent.level as MindSizeId].colours, SIZES[sent.level as MindSizeId].length, seededRng(sent.seed)) : null))
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState<(number | null)[]>([])
  const [colour, setColour] = useState(0)
  const [used, setUsed] = useState(0)
  const all = useMemo(() => allCodes(colours, length), [colours, length])

  const solved = turns.some((x) => x.feedback.black === length)
  const out = turns.length >= tries
  const over = solved || out
  const breaking = mode === 'break'
  const cpuGuessing = started && !breaking && secret !== null && !over

  const place = (i: number) => setDraft((d) => d.map((v, k) => (k === i ? colour : v)))
  const submit = () => {
    if (!secret || draft.some((v) => v === null)) return
    const guess = draft as Code
    setTurns((tn) => [...tn, { guess, feedback: score(secret, guess) }])
    setDraft(Array(length).fill(null))
  }
  const lock = () => { if (draft.every((v) => v !== null)) { setSecret(draft as Code); setDraft(Array(length).fill(null)) } }
  useComputerTurn(cpuGuessing, skill, turns.length, () => {
    if (!secret) return
    const guess = chooseGuess(all, turns, skill)
    setTurns((tn) => [...tn, { guess, feedback: score(secret, guess) }])
  })
  const reset = () => {
    setTurns([]); setUsed(0); setDraft(Array(length).fill(null)); setColour(0)
    leaveChat()
    const next = randomDealNumber()
    setSeed(next)
    setSecret(breaking ? randomCode(colours, length, seededRng(next)) : null)
  }
  const suggest = () => { const c = consistent(all, turns); if (c.length) { setDraft(c[Math.floor(Math.random() * c.length)]); setUsed((u) => u + 1) } }
  const peg = (v: number | null, key: string | number, onClick?: () => void, label?: string) => (
    <button key={key} type="button" className={`bd-mpeg ${v === null ? 'bd-mpeg--empty' : `bd-mpeg--c${v}`}`} onClick={onClick} disabled={!onClick} aria-label={label ?? (v === null ? t('mm.peg.empty') : t('mm.peg', { n: v + 1 }))}>{v === null ? '' : GLYPH[v]}</button>
  )
  const entering = breaking ? !over : secret === null
  const result = over ? { title: t(breaking ? (solved ? 'bd.win' : 'bd.lose') : (solved ? 'bd.lose' : 'bd.win')), body: t(solved ? 'mm.solved' : 'mm.failed', { n: turns.length }) + ' ' + t('mm.code', { code: (secret ?? []).map((v) => GLYPH[v]).join(' ') }), outcome: (breaking === solved ? 'win' : 'loss') as 'win' | 'loss' } : null

  return (
    <VsShell
      skillUsed={!breaking} game={`mastermind-${mode}`} name="mastermind" skill={skill} onSkill={setSkill} started={started} onStart={() => { reset(); setStarted(true) }} onNew={() => { reset(); setStarted(false) }} onAgain={reset}
      options={<>
        <LevelBar name="mastermind-mode" legend={t('mm.mode.label')} levels={MODES.map((m) => ({ id: m, label: t(m === 'break' ? 'mm.mode.break' : 'mm.mode.make') }))} level={mode} onLevel={(m) => { setForced(null); setMode(m) }} />
        <LevelBar name="mastermind-size" legend={t('mm.size.label')} levels={SIZE_IDS.map((s) => ({ id: s, label: t(NAMES[s], { c: SIZES[s].colours, p: SIZES[s].length }) }))} level={size} onLevel={(z) => { setForced(null); setSize(z) }} />
      </>}
      status={breaking ? t('mm.status.break', { n: tries - turns.length }) : secret === null ? t('mm.status.set') : t('mm.status.watch', { n: turns.length })} thinking={cpuGuessing}
      result={result}
      meta={<span>{t('mm.tries', { a: turns.length, b: tries })}</span>}
      hint={breaking ? { run: suggest, shown: false, used } : undefined}
      help={<><p>{t('mm.help.1')}</p><p>{t('mm.help.2')}</p></>}
    >
      <div className="bd-mm" role="group" aria-label={t('mm.aria')}>
        {fromChat && <IncomingNote mode={fromChat} onFresh={reset} />}
        <ol className="bd-mm__rows">
          {turns.map((tn, r) => (
            <li key={r} className="bd-mm__row" aria-label={t('mm.row', { n: r + 1, b: tn.feedback.black, w: tn.feedback.white })}>
              {tn.guess.map((v, i) => peg(v, i))}
              <span className="bd-mm__fb" aria-hidden="true">{Array.from({ length: tn.feedback.black }, (_, k) => <i key={`b${k}`} className="bd-fb bd-fb--b" />)}{Array.from({ length: tn.feedback.white }, (_, k) => <i key={`w${k}`} className="bd-fb bd-fb--w" />)}</span>
            </li>
          ))}
        </ol>
        {entering && (
          <div className="bd-mm__entry">
            <div className="bd-mm__row bd-mm__row--draft">{(draft.length === length ? draft : Array(length).fill(null)).map((v, i) => peg(v, i, () => place(i), t('mm.slot', { n: i + 1 })))}</div>
            <div className="bd-mm__palette" role="radiogroup" aria-label={t('mm.palette')}>
              {Array.from({ length: colours }, (_, c) => <button key={c} type="button" role="radio" aria-checked={colour === c} className={`bd-mpeg bd-mpeg--c${c} ${colour === c ? 'bd-mpeg--on' : ''}`} aria-label={t('mm.peg', { n: c + 1 })} onClick={() => setColour(c)}>{GLYPH[c]}</button>)}
            </div>
            <div className="button-row">
              <Button onClick={breaking ? submit : lock} disabled={draft.length !== length || draft.some((v) => v === null)}>{t(breaking ? 'mm.guess' : 'mm.lock')}</Button>
              <Button variant="secondary" onClick={() => setDraft(Array(length).fill(null))}>{t('mm.clear')}</Button>
            </div>
          </div>
        )}
        {breaking && seed !== null && started && <div className="sd-tools bd-tools"><GameShare shared={seededShare('mastermind', size, seed)} title={t('gx.game.mastermind.title')} /></div>}
      </div>
    </VsShell>
  )
}
