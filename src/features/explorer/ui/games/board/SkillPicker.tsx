import { SKILL_LIST, type Skill } from '../../../../games/domain/search'
import { t, type StringKey } from '../../../../../shared/i18n'
import { LevelBar } from '../parts'
import { SKILL_KEYS } from './shared'

/** The opponent-strength picker every game against the computer uses, with the same three names and the line that explains each. */
export function SkillPicker({ name, skill, onSkill }: { name: string; skill: Skill; onSkill: (s: Skill) => void }) {
  return (
    <>
      <LevelBar name={`${name}-skill`} legend={t('bd.skill.label')} levels={SKILL_LIST.map((s) => ({ id: s, label: t(SKILL_KEYS[s]) }))} level={skill} onLevel={onSkill} />
      <p className="bd-lead">{t(`bd.skill.${skill}.about` as StringKey)}</p>
    </>
  )
}
