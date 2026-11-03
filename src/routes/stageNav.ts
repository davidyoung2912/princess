import { JOURNEY_STAGES, type JourneyStage } from './hubs'
import { SCREEN_BY_ID, SETTINGS_AND_HELP, STAGE_TABS, areaFor, screenForPath, stageUses, type ScreenDef, type TabColour } from './screens'

/** One entry of the tab bar (phone) or rail (desktop) at a stage: Home first, the stage's own tabs, Me last. */
export interface NavTab {
  /** Stable key: 'home', 'me', or the lower-case label of a stage tab ('plan', 'sailing'...). */
  key: string
  label: string
  colour: TabColour
  subtext: string
  /** Where the tab opens. Plan and Ship keep their own front pages; every other stage tab opens `/tab/<key>`. */
  path: string
  kind: 'home' | 'stage' | 'me'
}

export const tabKey = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]+/g, '-')

const OWN_PATH: Record<string, string> = { plan: '/plan', ship: '/ship' }

/** The tab path for a stage tab's key. */
export const tabPathFor = (key: string): string => OWN_PATH[key] ?? `/tab/${key}`

/** The tabs a stage shows, left to right. Nothing else is shown: a tab a stage does not have does not exist there. */
export function navTabs(stage: JourneyStage): NavTab[] {
  const def = STAGE_TABS[stage]
  return [
    { key: 'home', label: 'Home', colour: 'blue', subtext: def.homeSubtext, path: '/', kind: 'home' },
    ...def.tabs.map((tab): NavTab => ({ key: tabKey(tab.label), label: tab.label, colour: tab.colour, subtext: tab.subtext, path: tabPathFor(tabKey(tab.label)), kind: 'stage' })),
    { key: 'me', label: 'Me', colour: 'plum', subtext: def.me.subtext, path: '/me', kind: 'me' },
  ]
}

/** The tab a landing address belongs to at a stage: `/`, `/me`, `/plan`, `/ship` or `/tab/<key>`; undefined when the stage has no such tab. */
export function tabAtPath(pathname: string, stage: JourneyStage): NavTab | undefined {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return navTabs(stage).find((tab) => tab.path === clean)
}

/** The screen ids a tab lists, in priority order (Me also lists Settings and help, which its own list already holds). */
export function tabScreenIds(tab: NavTab, stage: JourneyStage): readonly string[] {
  const def = STAGE_TABS[stage]
  if (tab.kind === 'home') return def.tiles
  if (tab.kind === 'me') return def.me.screens
  return def.tabs.find((t) => tabKey(t.label) === tab.key)?.screens ?? []
}

/** The tab to highlight for a location: the tab of the colour the screen wears (stage tabs never share a colour). */
export function activeTabKey(pathname: string, stage: JourneyStage, area: TabColour): string | null {
  const landing = tabAtPath(pathname, stage)
  if (landing) return landing.key
  return navTabs(stage).find((tab) => tab.colour === area)?.key ?? null
}

/** The address a registry screen opens at without more information, or null when it needs an id the list cannot know. */
export function linkFor(screen: ScreenDef, ids: { sailingId?: string | null; tripNumber?: string | null }): string | null {
  if (!screen.path.includes(':')) return screen.path
  if (screen.path === '/home/sailings/:id' && ids.sailingId) return `/home/sailings/${ids.sailingId}`
  if (screen.path === '/me/trips/:id' && ids.tripNumber) return `/me/trips/${ids.tripNumber}`
  return null
}

/** The screens of a list that a guest can open from it, each with its address; id screens appear under the list they open from. */
export function listedScreens(ids: readonly string[], known: { sailingId?: string | null; tripNumber?: string | null }): { screen: ScreenDef; to: string }[] {
  const out: { screen: ScreenDef; to: string }[] = []
  for (const id of ids) {
    const screen = SCREEN_BY_ID.get(id)
    const to = screen ? linkFor(screen, known) : null
    if (screen && to) out.push({ screen, to })
  }
  return out
}

/** Settings and help screens first split out of Me's list so Me can show them as their own group. */
export const splitMe = (ids: readonly string[]): { main: string[]; settings: string[] } => ({
  main: ids.filter((id) => !SETTINGS_AND_HELP.includes(id)),
  settings: ids.filter((id) => SETTINGS_AND_HELP.includes(id)),
})

/**
 * What an address does at a stage. 'show' opens it; 'home' sends the guest Home (a stale address: a screen the stage does not use, or a tab it does not have).
 * Addresses outside the registry (the kit, public links, unknown addresses) are left to the router.
 */
export function accessAt(pattern: string | null, pathname: string, stage: JourneyStage): 'show' | 'home' {
  if (pattern === '/tab/:slug') return tabAtPath(pathname, stage) ? 'show' : 'home'
  if (pattern === '/plan' || pattern === '/ship') return tabAtPath(pattern, stage) ? 'show' : 'home'
  if (!pattern) return 'show'
  const screen = screenForPath(pattern)
  if (!screen || screen.family === 'X') return 'show'
  return stageUses(screen.id, stage) ? 'show' : 'home'
}

/** The colour the shell wears for a screen, as {@link areaFor} says, or the tab's own colour on a landing page. */
export function areaAt(pathname: string, pattern: string | null, stage: JourneyStage, openedFrom: unknown, previous: TabColour | null, fallback: TabColour): TabColour {
  const landing = tabAtPath(pathname, stage)
  if (landing) return landing.colour
  const screen = pattern ? screenForPath(pattern) : undefined
  return screen ? areaFor(screen.id, stage, openedFrom, previous, fallback) : fallback
}

/** Labels of the tabs a stage has that the earlier set did not (the new tabs to announce once). */
export const newTabLabels = (stage: JourneyStage, seen: readonly string[]): string[] =>
  navTabs(stage).filter((tab) => tab.kind === 'stage' && !seen.includes(tab.key)).map((tab) => tab.label)

/** Every tab key any stage can show; used to read a stored list safely. */
export const ALL_TAB_KEYS: readonly string[] = [...new Set(JOURNEY_STAGES.flatMap((s) => navTabs(s).map((t) => t.key)))]
