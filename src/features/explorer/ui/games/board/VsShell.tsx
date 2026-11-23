import { useEffect, useRef, type ReactNode } from 'react'
import type { Skill } from '../../../../games/domain/search'
import { t } from '../../../../../shared/i18n'
import { Button } from '../../../../../shared/ui/Button'
import { Lightbulb, Undo } from '../../../../../shared/ui/icons'
import { addResult, readRecord, readyForNext, type Outcome } from '../../../../../shared/settings/gamePrefs'
import { useSettings } from '../../../../../shared/hooks/useSettings'
import { playCue } from '../../../../../shared/sound/cues'
import { HANDICAPS, type Handicap } from '../../../../games/domain/handicap'
import { SKILL_LIST } from '../../../../games/domain/search'
import { MoreLinks } from '../../Parts'
import { LevelBar } from '../parts'
import { GameHelp, SolvedCard } from '../parts'
import { SkillPicker } from './SkillPicker'
import { OPENINGS, skillName, type Opening } from './shared'

export interface VsResult { title: string; body: string; outcome: Outcome }

/**
 * The frame every game against the computer shares. Setup: the game's own options, who moves first, the same Cadet / Captain / Admiral opponent picker, Start. Play: a status line, Undo, Hint
 * ("what would the Captain play?"), the result card with your record against this opponent, and a nudge to the next opponent after three clean wins. The board is passed in as children.
 */
export function VsShell({ skillUsed = true, handicap, quick, variant = '', game, name, skill, onSkill, opening, onOpening, options, started, onStart, onNew, status, thinking, result, onAgain, meta, undo, hint, tools, help, children }: {
  /** A head start for you, offered on the setup page. */
  handicap?: { value: Handicap; onChange: (h: Handicap) => void }
  /** A shorter version of the game, offered on the setup page. */
  quick?: { value: boolean; onChange: (q: boolean) => void }
  /** Appended to the opponent's name in the saved record, so a handicapped win is kept apart from an even one. */
  variant?: string
  /** False when the opponent's strength plays no part in the chosen mode (the picker is then left out). */
  skillUsed?: boolean
  /** The catalogue id, which keys the saved record. */
  game: string
  name: string
  skill: Skill
  onSkill: (s: Skill) => void
  opening?: Opening
  onOpening?: (o: Opening) => void
  options?: ReactNode
  started: boolean
  onStart: () => void
  onNew: () => void
  status: string
  thinking: boolean
  result: VsResult | null
  onAgain: () => void
  meta?: ReactNode
  undo?: { can: boolean; run: () => void }
  /** `shown` is true while a suggested move is highlighted on the board. */
  hint?: { run: () => void; shown: boolean; used: number }
  tools?: ReactNode
  help: ReactNode
  children: ReactNode
}) {
  const links = <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
  const helpBox = <GameHelp title={t('sudoku.help.title')}>{help}</GameHelp>
  const recorded = useRef<VsResult | null>(null)
  const [settings] = useSettings()
  const wasThinking = useRef(thinking)
  // A soft click each time a move changes hands, yours or the computer's (silent unless the guest has sounds on).
  useEffect(() => {
    if (wasThinking.current !== thinking && started) playCue('confirm', settings)
    wasThinking.current = thinking
  }, [thinking, started, settings])
  const recKey = skill + variant
  useEffect(() => {
    if (!result) { recorded.current = null; return }
    if (recorded.current) return
    recorded.current = result
    addResult(game, recKey, result.outcome)
  }, [result, game, recKey])

  if (!started) {
    return (
      <div className="page">
        <div className="sd bd">
          {options}
          {opening && onOpening && <LevelBar name={`${name}-opening`} legend={t('bd.opening.label')} levels={OPENINGS.map((o) => ({ id: o, label: t(o === 'you' ? 'bd.opening.you' : 'bd.opening.computer') }))} level={opening} onLevel={onOpening} />}
          {skillUsed && <div data-tour="vs-skill"><SkillPicker name={name} skill={skill} onSkill={onSkill} /></div>}
          {quick && <LevelBar name={`${name}-quick`} legend={t('bd.quick.label')} levels={[{ id: 'full', label: t('bd.quick.full') }, { id: 'quick', label: t('bd.quick.quick') }]} level={quick.value ? 'quick' : 'full'} onLevel={(l) => quick.onChange(l === 'quick')} />}
          {handicap && <div data-tour="vs-handicap"><LevelBar name={`${name}-handicap`} legend={t('bd.handicap.label')} levels={HANDICAPS.map((h) => ({ id: h, label: t(h === 'none' ? 'bd.handicap.none' : h === 'small' ? 'bd.handicap.small' : 'bd.handicap.large') }))} level={handicap.value} onLevel={handicap.onChange} /></div>}
          {skillUsed && <SetupRecord game={game} recKey={recKey} skill={skill} />}
          <Button onClick={onStart}>{t('bd.start')}</Button>
          {helpBox}
        </div>
        {links}
      </div>
    )
  }
  const rec = readRecord(game, recKey)
  const next = SKILL_LIST[SKILL_LIST.indexOf(skill) + 1]
  return (
    <div className="page">
      <div className="sd bd">
        <p className="sd-meta">{skillUsed && <span>{skillName(skill)}</span>}{meta}</p>
        <div data-tour="vs-turn" className={`bd-turn ${thinking ? 'bd-turn--cpu' : 'bd-turn--you'}`} role="status" aria-live="polite"><strong>{result ? result.title : status}</strong></div>
        {children}
        {hint?.shown && !result && <p className="bd-note" role="status">{t('bd.hint.shown')}</p>}
        <div className="sd-tools bd-tools" data-tour="vs-tools">
          {undo && <button type="button" className="sd-tool" onClick={undo.run} disabled={!undo.can || thinking}><Undo aria-hidden="true" focusable="false" /><span>{t('bd.undo')}</span></button>}
          {hint && <button type="button" className="sd-tool" onClick={hint.run} disabled={thinking || !!result}><Lightbulb aria-hidden="true" focusable="false" /><span>{t('bd.hint')}</span></button>}
          {tools}
        </div>
        {result && (
          <SolvedCard title={result.title} tone={result.outcome === 'win' ? 'win' : result.outcome === 'loss' ? 'loss' : 'draw'}>
            <p>{result.body}</p>
            <p className="muted">{t('bd.record', { opp: skillName(skill), w: rec.w, l: rec.l, d: rec.d })}{hint && hint.used > 0 ? ` ${t('bd.hints.used', { n: hint.used })}` : ''}</p>
            {next && readyForNext(rec) && result.outcome === 'win' && <p>{t('bd.next', { opp: skillName(next) })}</p>}
            <div className="button-row"><Button onClick={onAgain}>{t('bd.again')}</Button><Button variant="secondary" onClick={onNew}>{t('bd.change')}</Button></div>
          </SolvedCard>
        )}
        {!result && <Button variant="secondary" onClick={onNew}>{t('bd.new')}</Button>}
        {helpBox}
      </div>
      {links}
    </div>
  )
}

/** On the setup page: how you have done against the chosen opponent so far. */
function SetupRecord({ game, recKey, skill }: { game: string; recKey: string; skill: Skill }) {
  const r = readRecord(game, recKey)
  if (r.w + r.l + r.d === 0) return null
  return <p className="bd-note">{t('bd.record', { opp: skillName(skill), w: r.w, l: r.l, d: r.d })}</p>
}
