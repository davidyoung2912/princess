import { matchPath } from 'react-router'
import type { StringKey } from '../i18n'
import { ROUTES, type RouteDef, type TabId } from './routes.ts'

export interface TabDef {
  id: TabId
  path: string
  labelKey: StringKey
}

/** The five labelled tabs (phone bar and desktop rail). */
export const TABS: readonly TabDef[] = [
  { id: 'home', path: '/', labelKey: 'tab.home' },
  { id: 'plan', path: '/plan', labelKey: 'tab.plan' },
  { id: 'ship', path: '/ship', labelKey: 'tab.ship' },
  { id: 'chat', path: '/chat', labelKey: 'tab.chat' },
  { id: 'me', path: '/me', labelKey: 'tab.me' },
]

/** A task a guest must reach within two taps (requirement UX-01). */
export interface TaskDef {
  id: string
  labelKey: StringKey
  /** The screens tapped through from app launch, one per tap, or 'help' for the always-visible Help button. */
  taps: readonly (string | 'help')[]
}

/** The top 15 tasks and the tap path to each. */
export const TOP_TASKS: readonly TaskDef[] = [
  { id: 'boardingPass', labelKey: 'task.boardingPass', taps: ['/', '/home/boarding-pass'] },
  { id: 'todaysEvents', labelKey: 'task.todaysEvents', taps: ['/plan'] },
  { id: 'myReservations', labelKey: 'task.myReservations', taps: ['/plan', '/plan/reservations'] },
  { id: 'orderFood', labelKey: 'task.orderFood', taps: ['/ship', '/ship/order'] },
  { id: 'askForHelp', labelKey: 'task.askForHelp', taps: ['help'] },
  { id: 'myBill', labelKey: 'task.myBill', taps: ['/me', '/me/bill'] },
  { id: 'deckMap', labelKey: 'task.deckMap', taps: ['/ship', '/ship/map'] },
  { id: 'guestServices', labelKey: 'task.guestServices', taps: ['help'] },
  { id: 'changeDining', labelKey: 'task.changeDining', taps: ['/plan', '/plan/reservations/:id'] },
  { id: 'findFamily', labelKey: 'task.findFamily', taps: ['/ship', '/ship/family'] },
  { id: 'addPackage', labelKey: 'task.addPackage', taps: ['/me', '/me/packages'] },
  { id: 'allAboard', labelKey: 'task.allAboard', taps: ['/'] },
  { id: 'emergencyInfo', labelKey: 'task.emergencyInfo', taps: ['help'] },
  { id: 'myExcursions', labelKey: 'task.myExcursions', taps: ['/plan', '/plan/excursions'] },
  { id: 'textSize', labelKey: 'task.textSize', taps: ['/me', '/me/settings'] },
]

export const MAX_TAPS = 2

/** The screen definition for a location, or null for an unknown address. */
export function routeForPath(pathname: string): RouteDef | null {
  return ROUTES.find((route) => matchPath({ path: route.path, end: true }, pathname)) ?? null
}

/** The tab whose area contains a location, for highlighting the active tab. */
export function tabForPath(pathname: string): TabId | null {
  return routeForPath(pathname)?.tab ?? null
}

/** The screens one level below a screen (e.g. Me → Bill, Packages, Settings), with `:id` filled by a sample value. */
export function childLinks(path: string): RouteDef[] {
  const prefix = path === '/' ? '/home/' : `${path}/`
  return ROUTES.filter((r) => r.path.startsWith(prefix) && !r.path.slice(prefix.length).includes('/'))
}

/** Problems with the navigation model: unknown screens, paths over the tap budget, duplicate ids. Empty when sound. */
export function navProblems(): string[] {
  const problems: string[] = []
  const known = new Set(ROUTES.map((r) => r.path))
  const seen = new Set<string>()
  for (const tab of TABS) if (!known.has(tab.path)) problems.push(`tab ${tab.id} points at unknown screen ${tab.path}`)
  for (const task of TOP_TASKS) {
    if (seen.has(task.id)) problems.push(`duplicate task ${task.id}`)
    seen.add(task.id)
    if (task.taps.length === 0 || task.taps.length > MAX_TAPS) problems.push(`${task.id} takes ${task.taps.length} taps`)
    for (const step of task.taps) if (step !== 'help' && !known.has(step)) problems.push(`${task.id} uses unknown screen ${step}`)
    const first = task.taps[0]
    if (first !== 'help' && !TABS.some((t) => t.path === first)) problems.push(`${task.id} does not start at a tab or Help`)
  }
  return problems
}
