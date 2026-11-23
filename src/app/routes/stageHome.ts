import type { JourneyStage } from './hubs'
import { SCREEN_BY_ID, STAGE_TABS, type ScreenDef } from './screens'

/** What Home's tiles can tell about the guest without more calls: saved sailings and the booking they have started. */
export interface HomeFacts {
  savedSailings: number
  draft: { id: string; categoryChosen: boolean; started: boolean } | null
}

/** The stages whose Home is rebuilt as the guide plus six tiles for a guest with no trip (P5). */
export const TILE_STAGES: readonly JourneyStage[] = ['dream', 'discover', 'book']

/** The stages whose Home is also built on a confirmed trip (P6). */
export const TRIP_STAGES: readonly JourneyStage[] = ['manage', 'prebook', 'getToShip']

/** The stages whose Home is built for a guest on board (P7). */
export const ABOARD_STAGES: readonly JourneyStage[] = ['embark', 'sea', 'port', 'disembark']

/** The stage whose Home is built for a guest who has sailed (P8). */
export const REMEMBER_STAGES: readonly JourneyStage[] = ['remember']

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
