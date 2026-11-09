import { en } from '../i18n/locales/en'
import { JOURNEY_STAGES, type JourneyStage } from './hubs'
import { nextSteps, type HomeFacts } from './stageHome'

/**
 * The welcome page a guest sees once on entering a stage (docs/stage-welcome-plan.md). Which welcomes are done is one small document on the server
 * (`stageWelcome`), so a guest who has seen a stage's welcome on one device is not shown it again on another. Framework-free so it is tested in node.
 */
export interface StageWelcomeState { seen: Record<string, number> }

export const EMPTY_WELCOME: StageWelcomeState = { seen: {} }

/** Mirrors the server's limits (StateRules.StageWelcomeMaxEntries and MaxSailingId). */
export const MAX_WELCOME_ENTRIES = 100
export const MAX_WELCOME_SAILING_ID = 64

/** The stages that belong to one sailing: a guest who sails again meets each of them again. The earlier stages (the dreaming and booking) are met once. */
export const SAILING_STAGES: readonly JourneyStage[] = ['manage', 'prebook', 'getToShip', 'embark', 'sea', 'port', 'disembark', 'remember']

const SAILING_ID = /^[A-Za-z0-9._-]+$/
const isStage = (s: string): s is JourneyStage => (JOURNEY_STAGES as readonly string[]).includes(s)

/** What a welcome is remembered under: the stage, plus the sailing for the stages that belong to one. An id the server would refuse is left out. */
export function welcomeKey(stage: JourneyStage, sailingId: string | null | undefined): string {
  if (SAILING_STAGES.includes(stage) && sailingId && sailingId.length <= MAX_WELCOME_SAILING_ID && SAILING_ID.test(sailingId)) return `${stage}:${sailingId}`
  return stage
}

function validKey(key: string): boolean {
  const colon = key.indexOf(':')
  if (colon < 0) return isStage(key)
  const sailing = key.slice(colon + 1)
  return isStage(key.slice(0, colon)) && sailing.length > 0 && sailing.length <= MAX_WELCOME_SAILING_ID && SAILING_ID.test(sailing)
}

/** The newest entries, at most the server's limit. */
function newest(seen: Record<string, number>): Record<string, number> {
  const entries = Object.entries(seen)
  if (entries.length <= MAX_WELCOME_ENTRIES) return seen
  return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_WELCOME_ENTRIES))
}

/** Reads a stored or server document safely: unknown stages, odd sailing ids and non-numbers are dropped. */
export function normalizeWelcome(raw: unknown): StageWelcomeState {
  const rows = raw && typeof raw === 'object' ? (raw as { seen?: unknown }).seen : null
  if (!rows || typeof rows !== 'object' || Array.isArray(rows)) return EMPTY_WELCOME
  const seen: Record<string, number> = {}
  for (const [key, at] of Object.entries(rows)) if (validKey(key) && typeof at === 'number' && Number.isFinite(at)) seen[key] = at
  return Object.keys(seen).length === 0 ? EMPTY_WELCOME : { seen: newest(seen) }
}

/** Both devices dismissed welcomes: keep every one, the earliest time for a stage both saw. */
export function mergeWelcome(remote: unknown, local: unknown): StageWelcomeState {
  const seen: Record<string, number> = { ...normalizeWelcome(remote).seen }
  for (const [key, at] of Object.entries(normalizeWelcome(local).seen)) seen[key] = key in seen ? Math.min(seen[key], at) : at
  return Object.keys(seen).length === 0 ? EMPTY_WELCOME : { seen: newest(seen) }
}

/** Records a welcome as seen. The same state comes back when it already was (so nothing is saved twice). */
export function markWelcomeSeen(state: StageWelcomeState, key: string, now: number): StageWelcomeState {
  if (key in state.seen || !validKey(key)) return state
  return { seen: newest({ ...state.seen, [key]: now }) }
}

/** Forgets one welcome so it shows again (a demo account moving to a stage again). The same state comes back when it was not seen. */
export function unmarkWelcome(state: StageWelcomeState, key: string): StageWelcomeState {
  if (!(key in state.seen)) return state
  const { [key]: _gone, ...rest } = state.seen
  return Object.keys(rest).length === 0 ? EMPTY_WELCOME : { seen: rest }
}

/**
 * Whether to send the guest to the welcome page now: the server has named a stage, the welcome documents have arrived (before that every stage
 * would look new) and this stage's welcome has not been seen.
 */
export function shouldShowWelcome(stage: JourneyStage | null, sailingId: string | null | undefined, state: StageWelcomeState, loaded: boolean): boolean {
  if (!stage || !loaded) return false
  return !(welcomeKey(stage, sailingId) in state.seen)
}

export interface WelcomeStep { key: string; to: string }

/** Something to have ready for a stage. `to` is the screen that holds the details, when there is one (the app points to where the rules are; it does not state them). */
export interface WelcomeNeed { key: string; to: string | null }

/** What to have ready, per stage, in the order shown. The words are `welcome.<stage>.need.<n>`; a guest ticks them off on their own device. */
const NEED_LINKS: Record<JourneyStage, readonly (string | null)[]> = {
  dream: ['/home/sailings', '/plan/party', '/home/quiz'],
  discover: ['/home/sailings', '/plan/party', '/home/cruise/cost'],
  book: ['/plan/party', '/me/payments', '/me/documents'],
  manage: ['/me/documents', '/plan/access', '/me/payments'],
  prebook: ['/plan/excursions', '/plan/dining', '/plan/packing'],
  getToShip: ['/me/documents', '/home/boarding-pass', '/plan/getting-there', null],
  embark: ['/home/boarding-pass', '/home/luggage', '/ship/muster'],
  sea: ['/plan/dining', '/plan/day', '/home/disembark/bags'],
  port: ['/ship/port', null, null],
  disembark: ['/home/disembark/bags', '/home/disembark/customs', '/home/disembark/onward'],
  remember: ['/me/memories', '/me/recap', '/me/feedback'],
}

/** A tick is remembered as `<stage>.<n>`. */
export const needId = (stage: JourneyStage, n: number): string => `${stage}.${n}`

/** Reads the stored ticks safely: only ids of real needs, each true. */
export function normalizeTicks(raw: unknown): Readonly<Record<string, true>> {
  const out: Record<string, true> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [id, v] of Object.entries(raw)) {
    const m = /^([A-Za-z]+)\.(\d+)$/.exec(id)
    if (v === true && m && isStage(m[1]!) && Number(m[2]) >= 1 && Number(m[2]) <= NEED_LINKS[m[1] as JourneyStage].length) out[id] = true
  }
  return out
}

/** What the page shows for a stage. Text is looked up from these locale keys; the first stage has no earlier one, so it has an intro in place of the transition. */
export interface WelcomeContent {
  stage: JourneyStage
  previous: JourneyStage | null
  next: JourneyStage | null
  titleKey: string
  /** How the guest got here (every stage but the first). */
  transitionKey: string | null
  /** A first welcome (the first stage only). */
  introKey: string | null
  focusKey: string
  /** How this stage helps the guest into the next one (the last stage says what happens after the journey). */
  leadKey: string
  steps: WelcomeStep[]
  /** One line on what to have ready, and the list. */
  needIntroKey: string
  needs: WelcomeNeed[]
}

/** Every step a stage can offer, so the page shows the full list whatever the guest has done. */
const ALL_STEPS: HomeFacts = { savedSailings: 0, draft: null, aboard: { musterDone: false, lastFullDay: true } }

export function welcomeContent(stage: JourneyStage): WelcomeContent {
  const at = JOURNEY_STAGES.indexOf(stage)
  const first = at === 0
  return {
    stage,
    previous: first ? null : JOURNEY_STAGES[at - 1],
    next: at === JOURNEY_STAGES.length - 1 ? null : JOURNEY_STAGES[at + 1],
    titleKey: `welcome.${stage}.title`,
    transitionKey: first ? null : `welcome.${stage}.transition`,
    introKey: first ? `welcome.${stage}.intro` : null,
    focusKey: `welcome.${stage}.focus`,
    leadKey: `welcome.${stage}.lead`,
    needIntroKey: `welcome.${stage}.needIntro`,
    needs: NEED_LINKS[stage].map((to, i) => ({ key: `welcome.${stage}.need.${i + 1}`, to })),
    steps: nextSteps(stage, ALL_STEPS).map((s, i) => ({ key: `welcome.${stage}.step.${i + 1}`, to: s.to })),
  }
}

/** Every locale key the page needs for a stage, for the test that checks the copy is complete. */
export function welcomeKeys(stage: JourneyStage): string[] {
  const c = welcomeContent(stage)
  return [c.titleKey, c.transitionKey ?? c.introKey, c.focusKey, c.needIntroKey, ...c.needs.map((n) => n.key), c.leadKey, ...c.steps.map((s) => s.key)].filter((k): k is string => k !== null)
}

/** True when the English text for every key of a stage's welcome exists, so a page is never shown with bare keys. */
export const hasWelcomeCopy = (stage: JourneyStage): boolean => welcomeKeys(stage).every((k) => k in en)
