import { describe, expect, it } from 'vitest'
import { JOURNEY_STAGES } from './hubs'
import { TOP_TASKS } from './nav'
import { ROUTES } from './routes'
import { SCREEN_BY_ID, SCREEN_LIST, STAGE_TABS, stageUses } from './screens'
import { SCREEN_WORDS, isFromEarlier, screenHits, visibleAt } from './screenWords'
import { ALL_TAB_KEYS, accessAt, earlierAt, groupShip, shipGroupOf, activeTabKey, areaAt, linkFor, listedScreens, navTabs, newTabLabels, tabAtPath, tabKey, tabPathFor, tabScreenIds } from './stageNav'
import { tabText } from '../ui/tabText'
import { searchContent } from '../domain/searchIndex'

describe('tabs by stage (P4)', () => {
  it('shows Home first, Me last and two or three stage tabs between, at every stage', () => {
    for (const stage of JOURNEY_STAGES) {
      const tabs = navTabs(stage)
      expect(tabs[0].kind, stage).toBe('home')
      expect(tabs.at(-1)?.kind, stage).toBe('me')
      expect(tabs.filter((x) => x.kind === 'stage').length, stage).toBeGreaterThanOrEqual(2)
      expect(tabs.filter((x) => x.kind === 'stage').length, stage).toBeLessThanOrEqual(3)
      expect(new Set(tabs.map((x) => x.colour)).size, `${stage}: one colour a tab`).toBe(tabs.length)
      expect(new Set(tabs.map((x) => x.path)).size, `${stage}: one address a tab`).toBe(tabs.length)
    }
  })

  it('changes the tabs with the stage, and keeps a tab\'s colour wherever it appears', () => {
    expect(navTabs('dream').map((x) => x.label)).toEqual(['Home', 'Explore', 'Ask', 'Me'])
    expect(navTabs('sea').map((x) => x.label)).toEqual(['Home', 'Today', 'Ship', 'People', 'Me'])
    const colours = new Map<string, string>()
    for (const stage of JOURNEY_STAGES) for (const tab of navTabs(stage)) {
      expect(colours.get(tab.key) ?? tab.colour, tab.key).toBe(tab.colour)
      colours.set(tab.key, tab.colour)
    }
  })

  it('opens Plan and Ship on their own front pages and every other stage tab on a landing address', () => {
    expect(tabPathFor('plan')).toBe('/plan')
    expect(tabPathFor('ship')).toBe('/ship')
    expect(tabPathFor('sailing')).toBe('/tab/sailing')
    expect(tabKey('Get to the ship')).toBe('get-to-the-ship')
    expect(tabAtPath('/tab/cost', 'discover')?.label).toBe('Cost')
    expect(tabAtPath('/tab/cost', 'sea')).toBeUndefined()
    expect(tabAtPath('/plan/', 'prebook')?.label).toBe('Plan')
    expect(tabAtPath('/plan', 'sea')).toBeUndefined()
    expect(ROUTES.some((r) => r.path === '/tab/:slug')).toBe(true)
  })

  it('lists, for each tab, the screens the registry puts under it, in order', () => {
    for (const stage of JOURNEY_STAGES) for (const tab of navTabs(stage)) {
      const ids = tabScreenIds(tab, stage)
      expect(ids.length, `${stage} ${tab.label}`).toBeGreaterThan(0)
      for (const id of ids) expect(SCREEN_BY_ID.has(id), id).toBe(true)
    }
    expect(tabScreenIds(navTabs('dream')[1], 'dream').slice(0, 2)).toEqual(['H06', 'H07'])
  })

  it('gives every listed screen a link, except those that need an id the list cannot know', () => {
    const open = listedScreens(['H07', 'H08', 'P36'], {})
    expect(open.map((x) => x.screen.id)).toEqual(['H07'])
    expect(listedScreens(['H08', 'M03'], { sailingId: 's1', tripNumber: 'B9' }).map((x) => x.to)).toEqual(['/home/sailings/s1', '/me/trips/B9'])
    expect(linkFor(SCREEN_BY_ID.get('H09')!, { sailingId: 's1' })).toBeNull()
  })

  it('reaches every screen a stage uses that has no id by a link from one of its tabs, in at most two taps', () => {
    for (const stage of JOURNEY_STAGES) {
      const listed = new Set(navTabs(stage).flatMap((tab) => listedScreens(tabScreenIds(tab, stage), { sailingId: 's', tripNumber: 'n' }).map((x) => x.screen.id)))
      for (const s of SCREEN_LIST) if (stageUses(s.id, stage) && !s.path.includes(':') && s.family !== 'X') expect(listed.has(s.id), `${stage} ${s.id}`).toBe(true)
    }
  })

  it('keeps the top tasks within two taps in some stage: the tab, then the screen', () => {
    const misses: string[] = []
    for (const task of TOP_TASKS) {
      const steps = task.taps.filter((s) => s !== 'help')
      if (steps.length < 2 || steps[0] === '/' || steps[1].includes(':')) continue
      const target = SCREEN_LIST.find((s) => s.path === steps[1])
      const ok = JOURNEY_STAGES.some((stage) => navTabs(stage).some((tab) => tab.path === steps[0] && tabScreenIds(tab, stage).includes(target?.id ?? '')))
      if (!ok) misses.push(`${task.id}: ${steps[0]} → ${steps[1]}`)
    }
    expect(misses).toEqual([])
  })
})

describe('stale addresses and the active tab', () => {
  it('sends a guest Home from a screen their stage does not use, a tab it does not have, and leaves the rest', () => {
    expect(accessAt('/home/quiz', '/home/quiz', 'dream')).toBe('show')
    expect(accessAt('/ship/order', '/ship/order', 'dream')).toBe('home')
    expect(accessAt('/plan', '/plan', 'dream')).toBe('home')
    expect(accessAt('/plan', '/plan', 'prebook')).toBe('show')
    expect(accessAt('/ship', '/ship', 'manage')).toBe('home')
    expect(accessAt('/tab/:slug', '/tab/explore', 'dream')).toBe('show')
    expect(accessAt('/tab/:slug', '/tab/explore', 'sea')).toBe('home')
    expect(accessAt('/', '/', 'sea')).toBe('show')
    expect(accessAt('/me', '/me', 'sea')).toBe('show')
    expect(accessAt('/kit', '/kit', 'sea')).toBe('show')
    expect(accessAt(null, '/nowhere', 'sea')).toBe('show')
  })

  it('judges a screen exactly as the registry does', () => {
    for (const stage of JOURNEY_STAGES) for (const s of SCREEN_LIST) {
      if (s.family === 'X') continue
      expect(accessAt(s.path, s.path, stage) === 'show', `${stage} ${s.id}`).toBe(stageUses(s.id, stage))
    }
  })

  it('highlights the tab whose colour the screen wears, or the landing tab itself', () => {
    expect(activeTabKey('/tab/cost', 'discover', 'gold')).toBe('cost')
    expect(activeTabKey('/', 'discover', 'blue')).toBe('home')
    expect(activeTabKey('/home/cabins', 'discover', 'pink')).toBe('cabin')
    expect(activeTabKey('/me/settings', 'sea', 'plum')).toBe('me')
    expect(areaAt('/tab/cost', '/tab/:slug', 'discover', undefined, null, 'blue')).toBe('gold')
    expect(areaAt('/home/cabins', '/home/cabins', 'discover', 'gold', null, 'blue')).toBe('pink')
  })

  it('announces a tab once: only tabs the device has not shown, and nothing for a tab it has', () => {
    expect(newTabLabels('sea', ['today', 'people'])).toEqual(['Ship'])
    expect(newTabLabels('sea', ['today', 'ship', 'people'])).toEqual([])
    expect(ALL_TAB_KEYS).toContain('get-to-the-ship'.slice(0, 0) || 'board')
  })
})

describe('tab words', () => {
  it('has the registry English for every tab, Home and Me in the locale file, so the two cannot drift', () => {
    for (const stage of JOURNEY_STAGES) for (const tab of navTabs(stage)) {
      const words = tabText(tab, stage)
      if (tab.kind === 'stage') expect(words).toEqual({ label: tab.label, subtext: tab.subtext })
      else expect(words.subtext.replace(/'/g, '’')).toBe(tab.subtext.replace(/'/g, '’'))
    }
  })
})

describe('Ship groups and earlier screens', () => {
  it('splits a long Ship tab into Find, Services and Safety, in order, and leaves a short one whole', () => {
    const sea = tabScreenIds(navTabs('sea')[2], 'sea')
    const groups = groupShip(sea)
    expect(groups.map((g) => g.group)).toEqual(['find', 'services', 'safety'])
    expect(groups.flatMap((g) => g.ids).sort()).toEqual([...sea].sort())
    expect(groupShip(['S01', 'S02'])).toEqual([{ group: null, ids: ['S01', 'S02'] }])
    expect(shipGroupOf('S25')).toBe('safety')
    expect(shipGroupOf('S40')).toBeNull()
  })

  it('treats a screen from an earlier stage as "from your trip", never a current one or a later one', () => {
    expect(earlierAt('/book', 'manage')).toBe(true)
    expect(earlierAt('/home/quiz', 'manage')).toBe(true)
    expect(earlierAt('/home/quiz', 'dream')).toBe(false)
    expect(earlierAt('/ship/order', 'dream')).toBe(false)
    expect(earlierAt('/me/settings', 'sea')).toBe(false)
    expect(earlierAt('/home/sailings/:id', 'sea')).toBe(false)
    expect(isFromEarlier('manage', '/home/quiz')).toBe(true)
    expect(screenHits((k) => k, 'manage', true).every((h) => isFromEarlier('manage', h.to))).toBe(true)
  })
})

describe('search at a stage', () => {
  const t = (key: string) => (SCREEN_BY_ID.size ? key : key)
  it('offers only screens the stage uses, and says why a result is hidden: its address is stale', () => {
    const dream = screenHits(t as never, 'dream').map((h) => h.to)
    expect(dream).toContain('/home/quiz')
    expect(dream).not.toContain('/ship/order')
    expect(visibleAt('dream', '/ship/order')).toBe(false)
    expect(visibleAt('dream', '/home/quiz?x=1')).toBe(true)
    expect(visibleAt('sea', '/ship/venues/sample')).toBe(true)
    const all = screenHits(t as never).map((h) => h.to)
    expect(all.length).toBeGreaterThan(dream.length)
  })

  it('filters content results by stage, so a dream-stage search never finds a restaurant menu', () => {
    const allow = (stage: (typeof JOURNEY_STAGES)[number]) => (to: string) => visibleAt(stage, to)
    expect(searchContent('crown grill', [], allow('sea')).length).toBeGreaterThan(0)
    expect(searchContent('crown grill', [], allow('dream'))).toEqual([])
    expect(Object.keys(SCREEN_WORDS).length).toBeGreaterThan(100)
  })

  it('keeps tab names from colliding with a stage\'s other tabs', () => {
    for (const stage of JOURNEY_STAGES) {
      const labels = STAGE_TABS[stage].tabs.map((x) => x.label)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })
})
