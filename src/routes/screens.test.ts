import { describe, expect, it } from 'vitest'
import { JOURNEY_STAGES } from './hubs'
import { ROUTES } from './routes'
import { SCREEN_BY_ID, SCREEN_LIST, SETTINGS_AND_HELP, STAGE_TABS, TAB_FRONT_PATHS, placementIn, primaryTab, screenForPath, screensOfStage, stageUses } from './screens'

describe('screen registry (P2)', () => {
  it('has an entry for every route except the tab front pages, and no entry for an unknown route', () => {
    const routes = new Set(ROUTES.map((r) => r.path))
    const entries = new Set(SCREEN_LIST.map((s) => s.path))
    expect(ROUTES.filter((r) => !TAB_FRONT_PATHS.includes(r.path) && !entries.has(r.path)).map((r) => r.path)).toEqual([])
    expect(SCREEN_LIST.filter((s) => !routes.has(s.path)).map((s) => s.path)).toEqual([])
    expect(SCREEN_LIST).toHaveLength(191)
  })

  it('has unique ids, paths and titles, each with a title and a subtext', () => {
    for (const key of ['id', 'path', 'title'] as const) {
      const values = SCREEN_LIST.map((s) => s[key])
      expect(values.filter((v, i) => values.indexOf(v) !== i), key).toEqual([])
    }
    for (const s of SCREEN_LIST) {
      expect(s.title.trim(), s.id).not.toBe('')
      expect(s.subtext.trim().length, s.id).toBeGreaterThan(20)
      expect(s.id[0], s.id).toBe(s.family)
    }
  })

  it('gives every stage 2 or 3 stage tabs, each with a subtext, and Dream the only stage with 2', () => {
    for (const stage of JOURNEY_STAGES) {
      const def = STAGE_TABS[stage]
      expect(def.tabs.length, stage).toBe(stage === 'dream' ? 2 : 3)
      expect(def.tiles, stage).toHaveLength(6)
      expect(def.homeSubtext, stage).not.toBe('')
      expect(def.me.subtext, stage).not.toBe('')
      for (const t of def.tabs) {
        expect(t.subtext, `${stage} ${t.label}`).not.toBe('')
        expect(t.screens.length, `${stage} ${t.label}`).toBeGreaterThan(0)
      }
    }
  })

  it('gives the stage tabs of a stage three different colours, and a tab the same colour at every stage', () => {
    const byLabel = new Map<string, string>()
    for (const stage of JOURNEY_STAGES) {
      const colours = STAGE_TABS[stage].tabs.map((t) => t.colour)
      expect(new Set(colours).size, stage).toBe(colours.length)
      for (const t of STAGE_TABS[stage].tabs) {
        expect(['teal', 'pink', 'gold']).toContain(t.colour)
        expect(byLabel.get(t.label) ?? t.colour, `${stage} ${t.label}`).toBe(t.colour)
        byLabel.set(t.label, t.colour)
      }
    }
  })

  it('refers only to known screens, with no repeats inside one tab', () => {
    for (const stage of JOURNEY_STAGES) {
      const def = STAGE_TABS[stage]
      for (const list of [def.tiles, def.me.screens, ...def.tabs.map((t) => t.screens)]) {
        expect(list.filter((id) => !SCREEN_BY_ID.has(id)), stage).toEqual([])
        expect(list.filter((id, i) => list.indexOf(id) !== i), stage).toEqual([])
      }
    }
  })

  it('puts every screen a stage uses under a tab or Me, and every Home tile under a tab', () => {
    for (const stage of JOURNEY_STAGES) {
      for (const id of screensOfStage(stage)) {
        const p = placementIn(id, stage)
        expect(p.tabs.length > 0 || p.inMe, `${stage} ${id}`).toBe(true)
      }
      for (const id of STAGE_TABS[stage].tiles) {
        const p = placementIn(id, stage)
        expect(p.tabs.length > 0 || p.inMe, `${stage} tile ${id}`).toBe(true)
      }
    }
  })

  it('includes Settings and help under Me at every stage, always plum', () => {
    for (const stage of JOURNEY_STAGES) {
      for (const id of SETTINGS_AND_HELP) {
        expect(STAGE_TABS[stage].me.screens, `${stage} ${id}`).toContain(id)
        expect(primaryTab(id, stage)).toEqual({ label: 'Me', colour: 'plum' })
      }
    }
  })

  it('leaves exactly the developer page and the two link-only pages outside every stage', () => {
    const outside = SCREEN_LIST.filter((s) => !JOURNEY_STAGES.some((st) => stageUses(s.id, st))).map((s) => s.id)
    expect(outside.sort()).toEqual(['X01', 'X03', 'X04'])
  })

  it('counts the screens each stage uses as the plan lists them', () => {
    const counts = Object.fromEntries(JOURNEY_STAGES.map((s) => [s, screensOfStage(s).length]))
    expect(counts).toEqual({ dream: 32, discover: 38, book: 43, manage: 58, prebook: 73, getToShip: 62, embark: 67, sea: 93, port: 88, disembark: 48, remember: 47 })
  })

  it('keeps ships out of Dream and the first ship screens in Discover', () => {
    const dream = screensOfStage('dream')
    expect(dream.filter((id) => id.startsWith('S') && Number(id.slice(1)) < 40)).toEqual([])
    expect(dream).not.toContain('H10')
    for (const id of ['S01', 'S02', 'S03', 'H10']) expect(stageUses(id, 'discover')).toBe(true)
  })

  it('moves a screen between tabs by data alone: Chat (C01) is listed in a tab, not coded into one', () => {
    expect(placementIn('C01', 'manage').tabs).toEqual(['Group'])
    expect(placementIn('C01', 'sea').tabs).toEqual(['People'])
    expect(primaryTab('C01', 'discover')).toBeNull()
  })

  it('picks the primary tab: the first listing tab, else Me, else Home', () => {
    expect(primaryTab('H13', 'discover')).toEqual({ label: 'Sailing', colour: 'teal' })
    expect(primaryTab('M10', 'sea')).toEqual({ label: 'Me', colour: 'plum' })
    expect(primaryTab('H21', 'dream')).toBeNull()
    expect(screenForPath('/home/ship')?.id).toBe('H10')
    expect(screenForPath('/plan')).toBeUndefined()
  })
})
