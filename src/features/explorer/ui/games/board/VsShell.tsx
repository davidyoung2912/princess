import type { ReactNode } from 'react'
import type { Skill } from '../../../../games/domain/search'
import { t } from '../../../../../shared/i18n'
import { Button } from '../../../../../shared/ui/Button'
import { Undo } from '../../../../../shared/ui/icons'
import { MoreLinks } from '../../Parts'
import { GameHelp, SolvedCard } from '../parts'
import { SkillPicker } from './SkillPicker'
import { skillName } from './shared'

export interface VsResult { title: string; body: string }

/**
 * The frame every game against the computer shares: a setup page (options, the same Cadet / Captain / Admiral opponent picker, Start), then the game with a status line that says whose turn it is,
 * Undo, New game, the result card and How to Play. The board itself is passed in as children.
 */
export function VsShell({ name, skill, onSkill, options, started, onStart, onNew, status, thinking, result, onAgain, meta, undo, tools, help, children }: {
  name: string
  skill: Skill
  onSkill: (s: Skill) => void
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
  tools?: ReactNode
  help: ReactNode
  children: ReactNode
}) {
  const links = <MoreLinks links={[{ to: '/games-explorer', label: t('route.gamesExplorer') }]} />
  const helpBox = <GameHelp title={t('sudoku.help.title')}>{help}</GameHelp>
  if (!started) {
    return (
      <div className="page">
        <div className="sd bd">
          {options}
          <SkillPicker name={name} skill={skill} onSkill={onSkill} />
          <Button onClick={onStart}>{t('bd.start')}</Button>
          {helpBox}
        </div>
        {links}
      </div>
    )
  }
  return (
    <div className="page">
      <div className="sd bd">
        <p className="sd-meta"><span>{skillName(skill)}</span>{meta}</p>
        <div className={`bd-turn ${thinking ? 'bd-turn--cpu' : 'bd-turn--you'}`} role="status" aria-live="polite"><strong>{result ? result.title : status}</strong></div>
        {children}
        <div className="sd-tools bd-tools">
          {undo && <button type="button" className="sd-tool" onClick={undo.run} disabled={!undo.can || thinking}><Undo aria-hidden="true" focusable="false" /><span>{t('bd.undo')}</span></button>}
          {tools}
        </div>
        {result && (
          <SolvedCard title={result.title}>
            <p>{result.body}</p>
            <div className="button-row"><Button onClick={onAgain}>{t('bd.again')}</Button></div>
          </SolvedCard>
        )}
        <Button variant="secondary" onClick={onNew}>{t('bd.new')}</Button>
        {helpBox}
      </div>
      {links}
    </div>
  )
}
