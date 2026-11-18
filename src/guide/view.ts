import type { GuideReason, GuideState, GuideTask, GuideView } from '../api/guideTypes'

/** The most open tasks Home lists at once: the first is "Do this now", the rest are "Coming up" (docs/next-steps-guidance-plan.md, decision 2). */
export const HOME_TASKS = 5

/**
 * The step of the stage's welcome page that opening a guide task's screen counts for. Tasks the app can see done for itself are not here; these are the ones whose only sign
 * is a visit (`doneBy: 'visit'`). The step numbers are the welcome page's (from 1), so the visits already kept on the server still count.
 */
export const VISIT_STEP: Readonly<Record<string, number>> = {
  'dream.quiz': 1, 'dream.invite': 3,
  'discover.cost': 2, 'discover.book': 3,
  'book.finish': 1, 'book.deposit': 2, 'book.names': 3,
  'manage.readiness': 3,
  'getToShip.pass': 1, 'getToShip.travel': 2,
  'embark.steps': 1, 'embark.group': 2,
  'sea.today': 1, 'sea.dinner': 2, 'sea.bags': 3,
  'port.leaveby': 1, 'port.excursion': 2, 'port.safe': 3,
  'disembark.exit': 1, 'disembark.bags': 2, 'disembark.bill': 3,
  'remember.recap': 1,
}

/** The welcome step of each task the app sees done for itself, so the welcome page's checks follow the same guide as Home. */
const DATA_STEP: Readonly<Record<string, number>> = {
  'dream.save': 2, 'discover.room': 1, 'manage.pay': 1, 'manage.documents': 2, 'getToShip.checkin': 1, 'getToShip.documents': 3, 'embark.muster': 3, 'remember.feedback': 2, 'remember.next': 3,
}

/** True when the guide shows a task of its own stage that belongs to this welcome step (from 1) as done. */
export const stepDoneInGuide = (view: GuideView, step: number): boolean =>
  view.tasks.some((x) => x.state === 'done' && x.carriedFrom === null && (VISIT_STEP[x.id] ?? DATA_STEP[x.id]) === step)

const RANK: Record<GuideState, number> = { todo: 0, blocked: 1, waiting: 2, done: 3 }

/** The primary (the first task to do) of a list already in order. */
const firstTodo = (tasks: readonly GuideTask[]): string | null => tasks.find((x) => x.state === 'todo')?.id ?? null

/**
 * The guide with the visits laid over it: a task only a visit can finish is done once its screen was opened. Tasks that become done drop to the end (the rest keep the
 * server's order), and the primary and counts follow. A task that was blocked by a task now done opens up.
 */
export function applyVisits(view: GuideView, visited: (step: number) => boolean): GuideView {
  const finished = new Set(view.tasks.filter((x) => x.state !== 'done' && x.doneBy === 'visit' && x.carriedFrom === null && VISIT_STEP[x.id] !== undefined && visited(VISIT_STEP[x.id]!)).map((x) => x.id))
  if (finished.size === 0) return view
  const settled = view.tasks.map((x): GuideTask => {
    if (finished.has(x.id)) return { ...x, state: 'done', urgency: 'none', urgencyReason: null }
    if (x.state === 'blocked' && x.blockedBy !== null && finished.has(x.blockedBy)) return { ...x, state: 'todo', blockedBy: null }
    return x
  })
  const tasks = settled.map((x, i) => ({ x, i })).sort((a, b) => RANK[a.x.state] - RANK[b.x.state] || a.i - b.i).map((p) => p.x)
  const own = tasks.filter((x) => x.carriedFrom === null)
  return { ...view, tasks, primaryId: firstTodo(tasks), counts: { done: own.filter((x) => x.state === 'done').length, total: own.length, open: tasks.filter((x) => x.state !== 'done').length } }
}

/** The task to do first, or null when nothing is open to do now. */
export const primaryOf = (view: GuideView): GuideTask | null => view.tasks.find((x) => x.id === view.primaryId) ?? null

/** Up to `HOME_TASKS` tasks still to do, in the guide's order (the primary first). Waiting and blocked ones follow the ones that can be done now. */
export const openTasks = (view: GuideView, limit: number = HOME_TASKS): GuideTask[] => view.tasks.filter((x) => x.state !== 'done').slice(0, limit)

export const doneTasks = (view: GuideView): GuideTask[] => view.tasks.filter((x) => x.state === 'done')

/** How many open tasks Home does not list, so the guest is told and can reach them. */
export const moreCount = (view: GuideView, limit: number = HOME_TASKS): number => Math.max(0, view.tasks.filter((x) => x.state !== 'done').length - limit)

/** Why the guest should act now, from the guide: the reason of the first open task marked urgent (payment, check-in, documents, muster, bags). */
export function urgentReason(view: GuideView | null): GuideReason | null {
  const task = view?.tasks.find((x) => x.state === 'todo' && x.urgency === 'now' && x.urgencyReason !== null)
  return task?.urgencyReason ?? null
}

/** The urgent task itself (where its button goes). */
export const urgentTask = (view: GuideView | null): GuideTask | null => view?.tasks.find((x) => x.state === 'todo' && x.urgency === 'now' && x.urgencyReason !== null) ?? null
