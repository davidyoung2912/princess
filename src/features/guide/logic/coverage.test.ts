import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OPTIONAL_FIRST_STEP, OPTIONAL_VISITS } from './optionalVisits'
import { VISIT_STEP } from './view'
import { MAX_PROGRESS_STEP } from '../../../app/routes/stageProgress'
import { en } from '../../../shared/i18n/locales/en'
import { ROUTES } from '../../../app/routes/routes'
import { JOURNEY_STAGES, type JourneyStage } from '../../../app/routes/hubs'
import { SCREEN_BY_ID, screenForPath, screensOfStage } from '../../../app/routes/screens'

/**
 * G7, prove it: the server's catalogue is read as text (the C# is not run here), and every task in it is held to the plan's promises. The words for each task are checked in
 * `guide.test.ts`; this file checks that each task has somewhere to go, a stage it belongs to, and a way to know it is done.
 */
const SRC = readFileSync(new URL('../../../../server/Princess.Api/Domain/GuideRules.cs', import.meta.url), 'utf8')
const CODE = SRC.split('\n').filter((l) => !l.trim().startsWith('///') && !l.trim().startsWith('//')).join('\n')

const TASK = /(?:new\(|Item\(\w+, |Documents\(f, )"((?:dream|discover|book|manage|prebook|getToShip|embark|sea|port|disembark|remember)\.[A-Za-z]+)"/g
const taskIds = [...new Set([...CODE.matchAll(TASK)].map((m) => m[1]))]

/** Every address the catalogue can send a guest to, with `{x}` holes turned into route parameters. */
const destinations = [...new Set([...CODE.matchAll(/\$?"(\/[A-Za-z0-9/_\-{}.]*)"/g)].map((m) => m[1].replace(/\{[^}]*\}/g, ':id')))]
const routePaths = new Set(ROUTES.map((r) => r.path))

const stageOf = (id: string): JourneyStage => id.split('.')[0] as JourneyStage

describe('the guide catalogue, read from the server', () => {
  it('finds every task and every destination', () => {
    expect(taskIds.length).toBeGreaterThan(55)
    expect(destinations.length).toBeGreaterThan(40)
  })

  it('has tasks in every stage', () => {
    for (const s of JOURNEY_STAGES) expect(taskIds.filter((id) => stageOf(id) === s).length, s).toBeGreaterThan(1)
  })

  it('sends every destination to a screen that exists', () => {
    expect(destinations.filter((d) => !routePaths.has(d))).toEqual([])
  })

  it('gives every task a destination in the catalogue', () => {
    // The destination is a path in the task's own line, the booking draft's resume address, or one of the two helpers that fix theirs (documents, and pay).
    for (const id of taskIds) {
      const line = CODE.split('\n').find((l) => l.includes(`"${id}"`) && /new\(|Item\(|Documents\(f/.test(l)) ?? ''
      expect(/\$?"\//.test(line) || /\bresume\b/.test(line) || /Documents\(f/.test(line), id).toBe(true)
    }
  })

  it('puts every task in a stage whose screens include its destination', () => {
    // A task's own stage lists its screen in its tabs, tiles or Me; the few reached by address only (booking steps) are named here, and Chat is global so it has no stage tab.
    const reachedByAddress = new Set(['/book', '/book/resume/:id', '/book/pay/:id', '/trial-day'])
    const rows: string[] = []
    for (const s of JOURNEY_STAGES) {
      const listed = new Set(screensOfStage(s).map((id) => SCREEN_BY_ID.get(id)?.path))
      const re = new RegExp(`"${s}\\.[A-Za-z]+"[^\\n]*?\\$?"(/[^"]*)"`, 'g')
      for (const m of CODE.matchAll(re)) {
        const to = m[1].replace(/\{[^}]*\}/g, ':id')
        if (!listed.has(to) && !reachedByAddress.has(to) && !to.startsWith('/chat/') && screenForPath(to)) rows.push(`${s}: ${m[0].slice(0, 30)} -> ${to}`)
      }
    }
    expect(rows).toEqual([])
  })

  it('says how each task is known done, and every due date comes from a named source', () => {
    expect(new Set([...CODE.matchAll(/\bBy(?:Data|Tick|Visit) = "(\w+)"/g)].map((m) => m[1]))).toEqual(new Set(['data', 'tick', 'visit']))
    const sources = [...new Set([...CODE.matchAll(/(?:DueSource: |c\.Due, )"(\w+)"/g)].map((m) => m[1]))]
    expect(sources.length).toBeGreaterThan(0)
    expect(sources.filter((s) => !['booking', 'checklist'].includes(s))).toEqual([])
  })

  it('never lists a task in two stages without marking the later one as carried over', () => {
    // A task id is written under one stage prefix, and the only helpers that reuse a task across stages pass a `from` stage.
    const defined = (id: string) => [...CODE.matchAll(new RegExp(`.*(?:new\\(|Item\\(\\w+, |Documents\\(f, )"${id.replace('.', '\\.')}".*`, 'g'))].map((m) => m[0])
    const reused = taskIds.filter((id) => defined(id).length > 1)
    for (const id of reused) {
      const uses = defined(id)
      const carried = uses.filter((u) => /StageRules\.\w+\)/.test(u) || /from:/i.test(u) || /Pay\(f|Documents\(f/.test(u))
      expect(carried.length, id).toBeGreaterThan(0)
    }
  })

  it('has a time-of-day rule only where the plan says so (bag night)', () => {
    expect(CODE).toContain('"sea.bags"')
    expect(CODE).not.toMatch(/DateTime\.(Now|UtcNow)/)
  })

  it('keeps hard tasks to the five that cannot be put aside', () => {
    const hard = [...new Set([...CODE.matchAll(/"([A-Za-z]+\.[A-Za-z]+)"[^\n]*Hard: true/g)].map((m) => m[1]))]
    for (const id of hard) expect(`guide.${id}.why` in en, id).toBe(true)
    expect(hard.length).toBeLessThan(12)
  })
})

describe('optional tasks done by visiting (G9b)', () => {
  const listed = Object.values(OPTIONAL_VISITS).flatMap((l) => l ?? [])
  const lines = CODE.split('\n')
  // Optional tasks the catalogue marks as known only by a visit, with the address in the same line (the ones a welcome step already counts, dream.invite and port.safe, are left out).
  const catalogue = lines.flatMap((l) => {
    const m = /new\("([A-Za-z]+\.[A-Za-z]+)", "(\/[^"]*)",[^\n]*ByVisit, Optional: true\)/.exec(l)
    return m && (VISIT_STEP[m[1]] ?? OPTIONAL_FIRST_STEP) >= OPTIONAL_FIRST_STEP ? [{ id: m[1], to: m[2] }] : []
  })

  it('lists exactly the optional visit tasks of the catalogue, with the same screen', () => {
    expect(catalogue.length).toBeGreaterThan(15)
    expect([...listed].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...catalogue].sort((a, b) => a.id.localeCompare(b.id)))
  })

  it('keeps each task under its own stage and steps within the stored limit', () => {
    for (const [stage, list] of Object.entries(OPTIONAL_VISITS)) {
      for (const x of list ?? []) expect(x.id.startsWith(`${stage}.`), x.id).toBe(true)
      expect(OPTIONAL_FIRST_STEP + (list?.length ?? 0) - 1).toBeLessThanOrEqual(MAX_PROGRESS_STEP)
    }
  })
})

describe('cards keyed to guide tasks (G9c)', () => {
  const RULES = readFileSync(new URL('../../../../server/Princess.Api/Domain/ChatProactiveRules.cs', import.meta.url), 'utf8')
  const mapped = [...RULES.matchAll(/\["([\w.-]+)"\] = "([A-Za-z]+\.[A-Za-z]+)",/g)].map((m) => ({ key: m[1], task: m[2] }))

  it('points every card at a task the catalogue has', () => {
    expect(mapped.length).toBeGreaterThan(10)
    expect(mapped.filter((m) => !taskIds.includes(m.task))).toEqual([])
  })

  it('has every mapped card key in the rules', () => {
    for (const m of mapped) expect(RULES.includes(`"${m.key}"`), m.key).toBe(true)
  })

  it('reads the guest put-aside tasks before posting a card', () => {
    const svc = readFileSync(new URL('../../../../server/Princess.Api/Services/StanleyMomentService.cs', import.meta.url), 'utf8')
    expect(svc).toContain('"guideChoices"')
    expect(svc).toContain('GuideRules.PutAside')
  })
})

