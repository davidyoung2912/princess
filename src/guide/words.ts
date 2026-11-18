import { t, type StringKey } from '../i18n'
import type { GuideTask, GuideView } from '../api/guideTypes'

/** The words for a guide task: what to do and why. Keyed by the server's task id (`guide.<id>.title`); a test keeps the keys in step with the server's catalogue. */
export function taskWords(task: Pick<GuideTask, 'id'>): { title: string; why: string } {
  return { title: t(`guide.${task.id}.title` as StringKey), why: t(`guide.${task.id}.why` as StringKey) }
}

/** The line saying what really moves the guest to the next stage, with its date when the server gave one. */
export function moveOnWords(moveOn: GuideView['moveOn']): string {
  return t(`guide.moveOn.${moveOn.stage}` as StringKey, { date: moveOn.date ?? '' })
}
