import { describe, expect, it } from 'vitest'
import { HUBS, JOURNEY_STAGES, QUICK } from './hubs'
import { MAX_STAGE_QUICK, STAGE_MENUS, hubsForStage, quickForStage, stageMenuProblems } from './stageMenus'
import type { TabId } from './routes'

const TABS: TabId[] = ['home', 'plan', 'ship', 'chat', 'me']

describe('stage-tailored menus', () => {
  it('has no problems in the matrix', () => {
    expect(stageMenuProblems()).toEqual([])
  })

  it('covers all eleven stages', () => {
    expect(Object.keys(STAGE_MENUS).sort()).toEqual([...JOURNEY_STAGES].sort())
  })

  it('never loses a hub or a screen: every stage lists every hub of a tab exactly once', () => {
    for (const stage of JOURNEY_STAGES) {
      for (const tab of TABS) {
        const ids = hubsForStage(tab, stage).map((v) => v.hub.id).sort()
        expect(ids, `${stage}/${tab}`).toEqual(HUBS.filter((h) => h.tab === tab).map((h) => h.id).sort())
      }
    }
  })

  it('puts the stage hubs first and open, in matrix order', () => {
    const views = hubsForStage('home', 'disembark')
    expect(views[0]).toMatchObject({ lead: true, hub: { id: 'home.leave' } })
    expect(views.slice(1).every((v) => !v.lead)).toBe(true)
    expect(hubsForStage('plan', 'manage').slice(0, 3).map((v) => v.hub.id)).toEqual(['plan.docs', 'plan.pack', 'plan.group'])
  })

  it('keeps the usual most-used list and adds at most three screens on top', () => {
    for (const stage of JOURNEY_STAGES) {
      for (const tab of TABS) {
        const list = quickForStage(tab, stage)
        for (const p of QUICK[tab]) expect(list, `${stage}/${tab}`).toContain(p)
        expect(list.length).toBeLessThanOrEqual(QUICK[tab].length + MAX_STAGE_QUICK)
        expect(new Set(list).size).toBe(list.length)
      }
    }
    expect(quickForStage('home', 'getToShip')[0]).toBe('/home/disruption')
  })
})
