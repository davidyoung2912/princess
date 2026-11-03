import type { JourneyStage } from './hubs'
import { SCREEN_BY_ID, STAGE_TABS, type ScreenDef } from './screens'

/** What Home can tell about the guest without more calls: saved sailings and the booking they have started. */
export interface HomeFacts {
  savedSailings: number
  draft: { id: string; categoryChosen: boolean; started: boolean } | null
  /** The guest's confirmed trip, for the stages from Manage to Get to the ship. */
  trip?: {
    number: string; paid: boolean; documentsOk: boolean; checkinDone: boolean; agent: boolean
    /** Days to the final payment date (negative once past) and to departure, and whether online check-in is open. Left out: nothing is urgent. */
    daysToFinal?: number; daysToDeparture?: number; checkinOpen?: boolean
  } | null
  /** On board (P7): the muster drill is done, and it is the last full day (or later), when bag night and the exit time matter. */
  aboard?: { musterDone: boolean; lastFullDay: boolean } | null
}

export interface NextStepItem { key: string; to: string; done: boolean }

/** The stages whose Home is rebuilt as Next steps plus six tiles for a guest with no trip (P5). */
export const TILE_STAGES: readonly JourneyStage[] = ['dream', 'discover', 'book']

/** The stages whose Home is also built on a confirmed trip (P6). */
export const TRIP_STAGES: readonly JourneyStage[] = ['manage', 'prebook', 'getToShip']

/** The stages whose Home is built for a guest on board (P7). */
export const ABOARD_STAGES: readonly JourneyStage[] = ['embark', 'sea', 'port', 'disembark']

/** The stage whose Home is built for a guest who has sailed (P8). */
export const REMEMBER_STAGES: readonly JourneyStage[] = ['remember']

/** The three Next steps of a stage (plan section 8): actions, not screens. A step is done only when the data shows it. */
export function nextSteps(stage: JourneyStage, f: HomeFacts): NextStepItem[] {
  const resume = f.draft ? `/book/resume/${f.draft.id}` : '/book'
  switch (stage) {
    case 'dream':
      return [
        { key: 'stage.next.dream.1', to: '/home/quiz', done: false },
        { key: 'stage.next.dream.2', to: '/home/sailings', done: f.savedSailings > 0 },
        { key: 'stage.next.dream.3', to: '/plan/group-poll', done: false },
      ]
    case 'discover':
      return [
        { key: 'stage.next.discover.1', to: '/home/cabins', done: !!f.draft?.categoryChosen },
        { key: 'stage.next.discover.2', to: '/home/cruise/cost', done: false },
        { key: 'stage.next.discover.3', to: '/book', done: false },
      ]
    case 'book':
      return [
        { key: 'stage.next.book.1', to: resume, done: false },
        { key: 'stage.next.book.2', to: f.draft ? `/book/pay/${f.draft.id}` : '/book', done: false },
        { key: 'stage.next.book.3', to: '/plan/party', done: false },
      ]
    case 'manage':
      return [
        { key: 'stage.next.manage.1', to: f.trip && !f.trip.agent ? `/book/pay/${f.trip.number}` : '/me/payments', done: !!f.trip?.paid },
        { key: 'stage.next.manage.2', to: '/me/documents', done: !!f.trip?.documentsOk },
        { key: 'stage.next.manage.3', to: '/plan/readiness', done: false },
      ]
    case 'prebook':
      return [
        { key: 'stage.next.prebook.1', to: '/plan/excursions', done: false },
        { key: 'stage.next.prebook.2', to: '/plan/dining', done: false },
        { key: 'stage.next.prebook.3', to: '/plan/packing', done: false },
      ]
    case 'getToShip':
      return [
        { key: 'stage.next.getToShip.1', to: f.trip?.checkinDone ? '/home/boarding-pass' : '/home/check-in', done: !!f.trip?.checkinDone },
        { key: 'stage.next.getToShip.2', to: '/plan/getting-there', done: false },
        { key: 'stage.next.getToShip.3', to: '/me/documents', done: !!f.trip?.documentsOk },
      ]
    case 'embark':
      return [
        { key: 'stage.next.embark.1', to: '/home/embarkation/steps', done: false },
        { key: 'stage.next.embark.2', to: '/home/meeting-point', done: false },
        { key: 'stage.next.embark.3', to: '/ship/muster', done: !!f.aboard?.musterDone },
      ]
    case 'sea': {
      const steps: NextStepItem[] = [
        { key: 'stage.next.sea.1', to: '/plan/day', done: false },
        { key: 'stage.next.sea.2', to: '/plan/dining', done: false },
      ]
      if (f.aboard?.lastFullDay) steps.push({ key: 'stage.next.sea.3', to: '/home/disembark/bags', done: false })
      return steps
    }
    case 'port':
      return [
        { key: 'stage.next.port.1', to: '/ship/port', done: false },
        { key: 'stage.next.port.2', to: '/plan/excursions', done: false },
        { key: 'stage.next.port.3', to: '/ship/safe-ashore', done: false },
      ]
    case 'disembark':
      return [
        { key: 'stage.next.disembark.1', to: '/home/disembark', done: false },
        { key: 'stage.next.disembark.2', to: '/home/disembark/bags', done: false },
        { key: 'stage.next.disembark.3', to: '/me/bill', done: false },
      ]
    case 'remember':
      return [
        { key: 'stage.next.remember.1', to: '/me/recap', done: false },
        { key: 'stage.next.remember.2', to: '/me/feedback', done: false },
        { key: 'stage.next.remember.3', to: '/home/sailings', done: f.savedSailings > 0 },
      ]
    default:
      return []
  }
}

export type UrgentReason = 'payment' | 'checkin' | 'documents' | 'muster' | 'bags'

/** Why Next steps should lead Home (and its first undone step get the primary button), or null when the recent card leads (docs/returning-home-plan.md, "Urgent"). */
export function urgentStep(stage: JourneyStage, f: HomeFacts): UrgentReason | null {
  const trip = f.trip
  if (trip) {
    if (!trip.paid && trip.daysToFinal !== undefined && trip.daysToFinal <= 14) return 'payment'
    if (trip.checkinOpen && !trip.checkinDone && trip.daysToDeparture !== undefined && trip.daysToDeparture <= 3) return 'checkin'
    if (!trip.agent && !trip.documentsOk && trip.daysToDeparture !== undefined && trip.daysToDeparture <= 30) return 'documents'
  }
  if (stage === 'embark' && f.aboard && !f.aboard.musterDone) return 'muster'
  if (stage === 'sea' && f.aboard?.lastFullDay) return 'bags'
  return null
}

/** Where a tile opens, or null when it needs an id Home does not have. */
export function tileLink(screen: ScreenDef, ids: { sailingId: string | null; draftId: string | null }): string | null {
  if (!screen.path.includes(':')) return screen.path
  if (screen.path === '/home/sailings/:id') return ids.sailingId ? `/home/sailings/${ids.sailingId}` : '/home/sailings'
  if (screen.path === '/book/resume/:id' || screen.path === '/book/:id') return ids.draftId ? screen.path.replace(':id', ids.draftId) : '/book'
  return null
}

/** The six tiles of a stage, each with its address. */
export function stageTiles(stage: JourneyStage, ids: { sailingId: string | null; draftId: string | null }): { screen: ScreenDef; to: string }[] {
  const out: { screen: ScreenDef; to: string }[] = []
  for (const id of STAGE_TABS[stage].tiles) {
    const screen = SCREEN_BY_ID.get(id)
    const to = screen ? tileLink(screen, ids) : null
    if (screen && to) out.push({ screen, to })
  }
  return out
}
