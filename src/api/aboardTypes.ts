import type { Cents } from '../domain/pricing'
import type { Selection } from '../domain/catalogue'
import type { GameState } from '../domain/games'
import type { Friend, ChatReportReason, GratuityChoice, PartyInput, ReportKind, RequestStage } from '../domain/services'
import type { PersonaId } from '../domain/personas'

/** Shapes for the Phase 12 groups: bookings and orders on board, requests, reports, drinks, money, parties, games and the TV. */
export interface SelectionView extends Selection {
  id: string
  at: number
  total: Cents
}

export interface SelectionsApi {
  list(): Promise<SelectionView[]>
  /** Rejects `invalid` (the reason is the message: `unknown`, `badDay`, `badTime`, `badQty`, `age`, `notBookable`), `conflict` (`soldOut`, `closed`, `past`), `forbidden` for a supervised account. */
  add(s: Selection): Promise<SelectionView[]>
  remove(id: string): Promise<SelectionView[]>
}

export interface RequestRow {
  id: string
  item: string
  qty: number
  note: string
  placedAt: number
  etaAt: number
  stage: RequestStage
  canCancel: boolean
}

export interface RequestsApi {
  list(): Promise<RequestRow[]>
  /** Rejects `invalid` for an unknown item or quantity, `conflict` (`closed` before boarding, `tooMany` open requests, `duplicate` of one still open). */
  create(item: string, qty: number, note: string): Promise<RequestRow[]>
  /** Rejects `conflict` (`tooLate`) once the crew is on the way. */
  cancel(id: string): Promise<RequestRow[]>
}

export interface ReportRow { id: string; kind: ReportKind; where: string; note: string; anonymous: boolean; at: number; reference: string }

export interface ReportsApi {
  list(): Promise<ReportRow[]>
  /** Rejects `invalid` with `badKind`, `noWhere`, `noNote` or `tooLong`. Needs no sign-in rights beyond being aboard; supervised accounts may report. */
  create(input: { kind: ReportKind; where: string; note: string; anonymous: boolean }): Promise<ReportRow[]>
}

export interface DrinkRow { id: string; drinkId: string; at: number }
export interface DrinksView {
  capUsd: number
  logs: DrinkRow[]
  summary: import('../domain/services').DrinkSummary
  adult: boolean
}
export interface DrinksApi {
  view(): Promise<DrinksView>
  /** Rejects `invalid` for an unknown drink, `forbidden` for alcohol under 21. */
  log(drinkId: string): Promise<DrinksView>
  undo(id: string): Promise<DrinksView>
}

export interface TopUp { id: string; dollars: number; source: 'card' | 'cash'; at: number; settledAt: number | null; reference: string }
export interface GratuityView {
  due: Cents
  choice: GratuityChoice
  reason: string
  /** Whether the choice can still change. */
  canChange: boolean
  paidAt: number | null
}
export interface MoneyView {
  currency: string
  topUps: TopUp[]
  topUpTotal: number
  hasCard: boolean
  pinSet: boolean
  gratuity: GratuityView
  canEdit: boolean
}
export interface MoneyApi {
  view(): Promise<MoneyView>
  /** Rejects `invalid` (`badAmount`), `conflict` (`tooMuch`, `noCard`, `closed`). Cash waits for the desk. */
  topUp(dollars: number, source: 'card' | 'cash'): Promise<MoneyView>
  /** Rejects `invalid` (`format`, `weak`), `forbidden` with a wrong current PIN. */
  setPin(next: string, current?: string): Promise<MoneyView>
  /** Forgotten PIN: asks Guest Services to reset it in person. */
  forgotPin(): Promise<MoneyView>
  /** Rejects `conflict` (`closed`, `already`) or `invalid` (`noReason`) for a removal request without a reason. */
  gratuity(choice: GratuityChoice, reason?: string): Promise<MoneyView>
  setCurrency(code: string): Promise<MoneyView>
}

export interface PartyRow {
  id: string
  title: string
  day: number
  time: string
  invited: { cabin: string; answer: 'yes' | 'maybe' | 'no' }[]
}
export interface PartiesApi {
  list(): Promise<PartyRow[]>
  /** Rejects `invalid` with the reason from `partyProblem`, `conflict` (`closed`). */
  create(input: PartyInput): Promise<PartyRow[]>
  cancel(id: string): Promise<PartyRow[]>
}

export interface GroupTable { friends: Friend[]; split: 'mine' | 'even' }
export interface GroupApi {
  get(reservationId: string): Promise<GroupTable>
  /** Rejects `invalid` (`noName`, `badCabin`, `duplicate`) or `conflict` (`full`). */
  addFriend(reservationId: string, friend: Friend, partySize: number): Promise<GroupTable>
  removeFriend(reservationId: string, index: number): Promise<GroupTable>
  setSplit(reservationId: string, split: GroupTable['split']): Promise<GroupTable>
}

export interface GamesApi {
  get(): Promise<GameState>
  find(clueId: string, on: boolean): Promise<GameState>
  answer(questionId: string, option: number): Promise<GameState>
  mark(n: number, on: boolean): Promise<GameState>
}

export interface TvState { on: boolean; channel: number; volume: number; muted: boolean; casting: string | null; vod: string | null }
export interface TvApi {
  get(): Promise<TvState>
  /** Rejects `invalid` for a channel, volume, device name or title that is not valid, `forbidden` for a title the guest is too young for. */
  set(patch: Partial<TvState>): Promise<TvState>
}

export interface LastMinuteTour {
  excursionId: string
  start: string
  leaves: number
  left: number
  /** Price per adult. */
  price: Cents
  /** Why it cannot be booked now, or null. */
  closed: 'started' | 'tooLate' | 'soldOut' | 'booked' | null
}
export interface LastMinuteView { port: string | null; tours: LastMinuteTour[]; guests: { id: PersonaId; name: string; age: number }[] }
export interface LastMinuteApi {
  list(): Promise<LastMinuteView>
  /** Charges the onboard account. Rejects `conflict` (`closed`, `soldOut`, `tooLate`, `started`, `duplicate`), `invalid`, `forbidden`. */
  book(excursionId: string, guests: PersonaId[]): Promise<LastMinuteView>
}

export interface ReadyApi {
  /** The ticked items for today. */
  get(): Promise<string[]>
  set(id: string, on: boolean): Promise<string[]>
}

export interface ChatSafeApi {
  blocked(): Promise<PersonaId[]>
  /** Hides their messages from you. Rejects `invalid` for someone who is not on your booking or chat. */
  block(id: PersonaId, on: boolean): Promise<PersonaId[]>
  report(messageId: string, reason: ChatReportReason): Promise<void>
  /** A photo as a data URL under the size limit. Rejects `invalid` (`type`, `size`, `empty`) or `forbidden` (`age`). */
  sendPhoto(input: { type: string; bytes: number; dataUrl: string; caption: string }): Promise<void>
}

export type FeedbackKind = 'bug' | 'idea' | 'praise'
export interface FeedbackRow { id: string; kind: FeedbackKind; text: string; at: number; log: string[]; reference: string; screenshot: boolean }
export interface FeedbackApi {
  list(): Promise<FeedbackRow[]>
  /** Rejects `invalid` for text under 5 characters or over 1000. `log` is the recent problem log the guest chose to attach. */
  send(input: { kind: FeedbackKind; text: string; log: string[]; screenshot: string | null }): Promise<FeedbackRow[]>
}

export interface AboardApi {
  selections: SelectionsApi
  requests: RequestsApi
  reports: ReportsApi
  drinks: DrinksApi
  money: MoneyApi
  parties: PartiesApi
  groups: GroupApi
  games: GamesApi
  tv: TvApi
  lastMinute: LastMinuteApi
  ready: ReadyApi
  chat: ChatSafeApi
  feedback: FeedbackApi
}
