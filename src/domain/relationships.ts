import type { AccessItem } from './access'

/**
 * One vocabulary over the separate ways a guest lets someone in (IDN-04, IDN-05). The stores stay as they are (helper in
 * `account.ts`, family link in `homeLink.ts`, party in `party.ts`); this names the relationship each one is and the task
 * each permission amounts to, so one screen can say who may do what. Framework-free.
 *
 * Household, cabin party, linked group and shipmate are not separate things the app records yet, so they are not listed here.
 */
export const RELATIONSHIPS = ['helper', 'household', 'party', 'invite'] as const
export type RelationshipKind = (typeof RELATIONSHIPS)[number]

/** The tasks a person can be given, in the order of IDN-05. */
export const TASKS = ['itinerary', 'checkin', 'pay', 'editBooking', 'folio', 'documents', 'message', 'location'] as const
export type Task = (typeof TASKS)[number]

/** Tasks the app can never or does not yet hand to anyone, so a screen can say so rather than leave them out. */
export const TASKS_NOT_OFFERED: readonly Task[] = ['editBooking', 'message']
/** Never shared, from any list. */
export const TASKS_NEVER_SHARED: readonly Task[] = ['location']

const TASK_OF: Record<AccessItem, Task | null> = {
  view: 'itinerary', trip: 'itinerary', checkin: 'checkin', payments: 'pay', folio: 'folio', documents: 'documents', profile: null, stanley: null,
  shipFacts: 'itinerary', 'share.plans': 'itinerary', 'share.status': 'checkin', 'share.spending': 'folio', 'share.photos': null,
}

/** The task one permission amounts to, or null when it is not one of the eight (a profile edit, shared photos). */
export const taskOf = (item: AccessItem): Task | null => TASK_OF[item]

/** The distinct tasks a set of permissions gives, in the fixed order of `TASKS`. */
export const tasksFor = (items: readonly AccessItem[]): Task[] => {
  const got = new Set(items.map(taskOf))
  return TASKS.filter((t) => got.has(t))
}
