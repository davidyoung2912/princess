import type { JourneyStage } from '../routes/hubs'

/**
 * The optional guide tasks only a visit can finish, by stage, in order, with the screen each one opens (docs/next-steps-guidance-plan.md, G9b). They are remembered in the same
 * `stageProgress` document as the welcome page's visits, under the step numbers after the welcome page's three (4, 5, 6...), so no new data or server limit is needed.
 * Each id must match a task the server catalogue marks optional and `visit`; a test reads the catalogue to check.
 */
export const OPTIONAL_VISITS: Readonly<Partial<Record<JourneyStage, readonly { id: string; to: string }[]>>> = {
  dream: [{ id: 'dream.trial', to: '/trial-day' }],
  discover: [{ id: 'discover.fare', to: '/plan/fare-check' }, { id: 'discover.compare', to: '/home/saved/compare' }],
  book: [{ id: 'book.policy', to: '/plan/contract' }],
  manage: [{ id: 'manage.insurance', to: '/plan/health-prep' }, { id: 'manage.phone', to: '/plan/phone' }, { id: 'manage.family', to: '/plan/family-link' }],
  prebook: [{ id: 'prebook.clubs', to: '/plan/clubs' }, { id: 'prebook.solo', to: '/ship/solo' }, { id: 'prebook.meet', to: '/chat/rooms' }],
  getToShip: [{ id: 'getToShip.delayed', to: '/home/delayed' }],
  embark: [{ id: 'embark.room', to: '/ship/room' }, { id: 'embark.key', to: '/home/medallion' }],
  sea: [{ id: 'sea.spend', to: '/me/bill' }, { id: 'sea.family', to: '/ship/family' }, { id: 'sea.help', to: '/ship/help-now' }],
  port: [{ id: 'port.late', to: '/home/delayed' }],
  disembark: [{ id: 'disembark.onward', to: '/home/disembark/onward' }, { id: 'disembark.lost', to: '/ship/lost-found' }],
  remember: [{ id: 'remember.history', to: '/me/history' }, { id: 'remember.memories', to: '/me/memories' }, { id: 'remember.followup', to: '/me/follow-up' }],
}

/** Where the optional steps start: after the welcome page's three. */
export const OPTIONAL_FIRST_STEP = 4

/** The step each optional visit task is remembered under, from its place in its stage's list. */
export const OPTIONAL_STEP: Readonly<Record<string, number>> = Object.fromEntries(
  Object.values(OPTIONAL_VISITS).flatMap((list) => (list ?? []).map((x, i) => [x.id, OPTIONAL_FIRST_STEP + i] as const)),
)
