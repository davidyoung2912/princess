import type { GuideView } from '../../../shared/api/guideTypes'

const bare = (p: string): string => p.split(/[?#]/)[0]!

/** The address of the task to do first, or null when nothing is open to do or it is Home itself. This is the screen marked "Start here" in its tab. */
export function startHerePath(view: GuideView): string | null {
  const first = view.tasks.find((x) => x.id === view.primaryId)
  return first && bare(first.to) !== '/' ? bare(first.to) : null
}

/**
 * The keys of the tabs that hold a task that needs the guest soon: open, and urgent. A screen that sits under more than one tab counts for the first tab that lists it
 * (as everywhere else). A tab with only calm or optional tasks gets no dot, and neither does Home, which shows the whole plan.
 */
export function tabsHoldingUrgent(view: GuideView, tabs: readonly { key: string; paths: readonly string[] }[]): Set<string> {
  const urgent = new Set(view.tasks.filter((x) => x.state === 'todo' && (x.urgency === 'now' || x.urgency === 'soon')).map((x) => bare(x.to)))
  const claimed = new Set<string>()
  const out = new Set<string>()
  for (const tab of tabs) {
    const mine = tab.paths.filter((p) => !claimed.has(p))
    mine.forEach((p) => claimed.add(p))
    if (tab.key !== 'home' && tab.key !== 'me' && mine.some((p) => urgent.has(p))) out.add(tab.key)
  }
  return out
}
