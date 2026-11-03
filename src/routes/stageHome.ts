import type { JourneyStage } from './hubs'
import { SCREEN_BY_ID, STAGE_TABS, type ScreenDef } from './screens'

/** What Home can tell about the guest without more calls: saved sailings and the booking they have started. */
export interface HomeFacts {
  savedSailings: number
  draft: { id: string; categoryChosen: boolean; started: boolean } | null
}

export interface NextStepItem { key: string; to: string; done: boolean }

/** The stages whose Home is rebuilt as Next steps plus six tiles (the later stages follow in P6 to P8). */
export const TILE_STAGES: readonly JourneyStage[] = ['dream', 'discover', 'book']

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
    default:
      return []
  }
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
