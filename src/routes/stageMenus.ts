import type { JourneyStage } from './hubs'
import { HUBS, QUICK, type HubDef } from './hubs'
import type { TabId } from './routes.ts'

/**
 * What each journey stage puts first on each tab. `hubs` are the groups that lead the tab (in this order, open); `quick` are screens
 * added to the top of "Most used". Nothing is removed: the other groups stay below, closed, and every screen stays reachable by
 * search. The tab bar itself keeps its fixed order so guests keep their muscle memory.
 */
export interface StageMenu {
  hubs: Partial<Record<TabId, readonly string[]>>
  quick: Partial<Record<TabId, readonly string[]>>
}

export const STAGE_MENUS: Record<JourneyStage, StageMenu> = {
  dream: {
    hubs: { home: ['home.discover'], plan: ['plan.wish', 'plan.group'], ship: ['ship.find'], me: ['me.rules'] },
    quick: { home: ['/home/quiz', '/home/cruise', '/home/saved'], ship: ['/ship/info'] },
  },
  discover: {
    hubs: { home: ['home.discover', 'home.ask'], plan: ['plan.money', 'plan.wish'], ship: ['ship.find'] },
    quick: { home: ['/home/cruise/cost', '/home/decide', '/home/cabins'], plan: ['/plan/price-watch'] },
  },
  book: {
    hubs: { home: ['home.discover'], plan: ['plan.money', 'plan.group'], me: ['me.money', 'me.docs'] },
    quick: { home: ['/home/offers', '/home/cabins'], plan: ['/plan/money-plan', '/plan/contract'], me: ['/me/payments'] },
  },
  manage: {
    hubs: { home: ['home.ask'], plan: ['plan.docs', 'plan.pack', 'plan.group'], me: ['me.money', 'me.docs'] },
    quick: { home: ['/home/summary'], plan: ['/plan/readiness', '/plan/medical'], me: ['/me/payments', '/me/documents'] },
  },
  prebook: {
    hubs: { home: ['home.ask'], plan: ['plan.pack', 'plan.wish', 'plan.week'], ship: ['ship.find'], me: ['me.money'] },
    quick: { home: ['/home/summary'], plan: ['/plan/ahead', '/plan/ship-packing'], ship: ['/ship/info'] },
  },
  getToShip: {
    hubs: { home: ['home.board', 'home.change'], plan: ['plan.travel', 'plan.pack'], me: ['me.docs'] },
    quick: { home: ['/home/disruption', '/home/delayed'], plan: ['/plan/getting-there', '/plan/weather'], me: ['/me/documents'] },
  },
  embark: {
    hubs: { home: ['home.board'], plan: ['plan.week'], ship: ['ship.safety', 'ship.find'] },
    quick: { home: ['/home/find-pass', '/home/meeting-point', '/home/luggage'], ship: ['/ship/muster'], plan: ['/plan/day'] },
  },
  sea: {
    hubs: { home: ['home.ask'], plan: ['plan.week'], ship: ['ship.find', 'ship.service', 'ship.people'], me: ['me.money'] },
    quick: { home: ['/home/briefing'], ship: ['/ship/where', '/ship/spa'], me: ['/me/ledger'] },
  },
  port: {
    hubs: { home: ['home.ask'], plan: ['plan.week'], ship: ['ship.port', 'ship.safety'] },
    quick: { plan: ['/plan/excursions'], ship: ['/ship/port/guide', '/ship/safe-ashore', '/ship/port/snapshot'] },
  },
  disembark: {
    hubs: { home: ['home.leave'], ship: ['ship.service'], me: ['me.money'] },
    quick: { home: ['/home/disembark/bags', '/home/disembark/onward', '/home/disembark/final-night'], me: ['/me/bill/final'] },
  },
  remember: {
    hubs: { home: ['home.discover'], plan: ['plan.wish'], me: ['me.after'] },
    quick: { home: ['/home/sailings'], me: ['/me/recap', '/me/memories', '/me/rebook'] },
  },
}

/** The most screens a stage may add to a tab's "Most used". */
export const MAX_STAGE_QUICK = 3

export interface HubView {
  hub: HubDef
  /** True when the stage leads with this hub: it comes first and opens by itself. */
  lead: boolean
}

/** The tab's hubs for a stage: the stage's own first, in its order, then the rest as they were. Every hub is still there. */
export function hubsForStage(tab: TabId, stage: JourneyStage): HubView[] {
  const mine = HUBS.filter((h) => h.tab === tab)
  const lead = STAGE_MENUS[stage].hubs[tab] ?? []
  const first = lead.map((id) => mine.find((h) => h.id === id)).filter((h): h is HubDef => !!h)
  const rest = mine.filter((h) => !first.includes(h))
  return [...first.map((hub) => ({ hub, lead: true })), ...rest.map((hub) => ({ hub, lead: false }))]
}

/** A tab's "Most used" for a stage: what the stage adds, then the usual list. */
export function quickForStage(tab: TabId, stage: JourneyStage): string[] {
  return [...new Set([...(STAGE_MENUS[stage].quick[tab] ?? []), ...QUICK[tab]])]
}

/** Problems with the matrix: an unknown hub or screen, a hub or screen on the wrong tab, too many additions, a stage that leads with nothing. */
export function stageMenuProblems(): string[] {
  const problems: string[] = []
  for (const [stage, menu] of Object.entries(STAGE_MENUS)) {
    if (Object.values(menu.hubs).every((l) => !l?.length)) problems.push(`${stage} leads with no hub`)
    for (const [tab, ids] of Object.entries(menu.hubs)) {
      for (const id of ids ?? []) {
        const hub = HUBS.find((h) => h.id === id)
        if (!hub) problems.push(`${stage} leads with unknown hub ${id}`)
        else if (hub.tab !== tab) problems.push(`${stage} lists hub ${id} under ${tab}`)
      }
    }
    for (const [tab, paths] of Object.entries(menu.quick)) {
      if ((paths?.length ?? 0) > MAX_STAGE_QUICK) problems.push(`${stage} adds more than ${MAX_STAGE_QUICK} screens to ${tab}`)
      for (const p of paths ?? []) {
        const hub = HUBS.find((h) => h.paths.includes(p))
        if (!hub) problems.push(`${stage} quick-links ${p}, which is in no hub`)
        else if (hub.tab !== tab) problems.push(`${stage} quick-links ${p} under ${tab}`)
      }
    }
  }
  return problems
}
