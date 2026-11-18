import { t, type StringKey } from '../i18n'
import type { GuideTask, GuideView } from '../api/guideTypes'
import { formatDate } from '../domain/cruise'

/** The words for a guide task: what to do and why. Keyed by the server's task id (`guide.<id>.title`); a test keeps the keys in step with the server's catalogue. */
export function taskWords(task: Pick<GuideTask, 'id'>): { title: string; why: string } {
  return { title: t(`guide.${task.id}.title` as StringKey), why: t(`guide.${task.id}.why` as StringKey) }
}

/** The line saying what really moves the guest to the next stage, with its date when the server gave one. */
export function moveOnWords(moveOn: GuideView['moveOn']): string {
  return t(`guide.moveOn.${moveOn.stage}` as StringKey, { date: moveOn.date ?? '' })
}

const stageName = (stage: string): string => t(`journey.stage.${stage}` as StringKey)

/** The small facts about a task, in the order a guest wants them: still from an earlier stage, optional, when it is due or opens, how long it takes. */
export function taskMeta(task: GuideTask, titleOf: (id: string) => string = (id) => t(`guide.${id}.title` as StringKey)): string[] {
  const out: string[] = []
  if (task.carriedFrom) out.push(t('guide.carried', { stage: stageName(task.carriedFrom) }))
  if (task.optional) out.push(t('guide.optional'))
  if (task.state === 'waiting' && task.opensAt) out.push(t('guide.opens', { date: formatDate(task.opensAt) }))
  else if (task.state === 'blocked' && task.blockedBy) out.push(t('guide.after', { task: titleOf(task.blockedBy).toLowerCase() }))
  else if (task.due) out.push(t('guide.due', { date: formatDate(task.due) }))
  out.push(t('guide.minutes', { count: task.minutes }))
  return out
}
