import type { DiningView } from '../../api/types'
import type { StringKey } from '../../i18n/locales/en'
import { actionGate, type GateStatus } from './actionGate'
import type { TileLine } from './lens'
import type { ExplorerStage } from './stage'

/** What a booking card shows, worked out from the server's view so the component only presents it. */
export interface BookingCardModel {
  status: GateStatus
  /** The one sentence that says whether the guest can reserve, with its reason. */
  headline: TileLine
  /** Extra lines under the headline that say why, with the date where there is one. */
  detail: TileLine | null
  /** The main dining plan, the specialty meals still covered, and the like. */
  facts: TileLine[]
  /** The Reserve button is only ever offered when the gate is open; every other state gives its reason instead. */
  canReserve: boolean
  /** A single line is enough: aboard, with nothing needing attention. */
  compact: boolean
  /** The loyalty and payments link goes with a window that has not opened. */
  paymentsLink: boolean
}

const HEADLINE: Record<GateStatus, StringKey> = {
  open: 'dine.open', opensOn: 'dine.closed', needsBooking: 'bk.dining.needsBooking', readOnly: 'plan.readOnly.title', closed: 'explorers.closed', finished: 'bk.dining.finished',
}

/** The dining booking card (window, plan, seating, meals left, read only). `view` is null while the server has not answered. */
export function diningBookingCard(view: DiningView | null, stage: ExplorerStage): BookingCardModel {
  const gate = actionGate('dining', { hasBooking: true, finished: stage === 'after', canBook: view ? view.canBook : null, window: view ? { open: view.window.open, opensOn: view.window.opensOn } : null })
  const facts: TileLine[] = []
  if (view) {
    facts.push(view.seating ? { key: 'bk.dining.fixed', params: { time: view.seating } } : { key: 'bk.dining.anytime' })
    if (view.mealsLeft > 0) facts.push({ key: 'bk.dining.mealsLeft', params: { count: view.mealsLeft } })
  }
  const detail: TileLine | null = gate.status === 'opensOn' ? { key: 'dine.closedBody', params: { date: gate.opensOn ?? '' } }
    : gate.status === 'readOnly' ? { key: 'plan.readOnly.body' }
    : gate.status === 'needsBooking' ? { key: 'explorers.afterBooking' }
    : null
  return {
    status: gate.status, headline: { key: HEADLINE[gate.status] }, detail, facts, canReserve: gate.status === 'open',
    compact: stage === 'aboard' && gate.status === 'open', paymentsLink: gate.status === 'opensOn',
  }
}
