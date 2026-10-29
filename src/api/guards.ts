import type { BoardingView, DiningView, EmbarkView, FamilyView, FolioView, HealthView, MusterView, OnboardToday, PhotosView, PortDayView, ProgramView, ReceiptView, RoomView } from './types'

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

/** A boarding pass read back from the phone's saved copy: only trusted if it still has the shape the screens rely on. */
export function asBoardingView(raw: unknown): BoardingView | null {
  const o = obj(raw)
  if (!o || typeof o.number !== 'string' || typeof o.departure !== 'string' || typeof o.checkinDone !== 'boolean' || !Array.isArray(o.passes) || !obj(o.terminal)) return null
  const ok = o.passes.every((p) => {
    const x = obj(p)
    return !!x && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.printed === 'string' && typeof x.code === 'string' && typeof x.ready === 'boolean' && typeof x.cabin === 'string' && typeof x.group === 'string'
  })
  return ok ? (raw as BoardingView) : null
}

export function asReceiptView(raw: unknown): ReceiptView | null {
  const o = obj(raw)
  if (!o || typeof o.number !== 'string' || !Array.isArray(o.guests) || !Array.isArray(o.booking)) return null
  return o.guests.every((g) => !!obj(g) && Array.isArray(obj(g)!.items)) ? (raw as ReceiptView) : null
}

export function asEmbarkView(raw: unknown): EmbarkView | null {
  const o = obj(raw)
  if (!o || !asBoardingView(o.boarding) || !Array.isArray(o.companion) || !Array.isArray(o.carryOn) || !Array.isArray(o.afternoon)) return null
  return raw as EmbarkView
}

export function asOnboardToday(raw: unknown): OnboardToday | null {
  const o = obj(raw)
  if (!o || typeof o.aboard !== 'boolean' || typeof o.date !== 'string' || typeof o.shipZone !== 'string' || typeof o.port !== 'string' || !obj(o.muster)) return null
  return raw as OnboardToday
}

export function asProgramView(raw: unknown): ProgramView | null {
  const o = obj(raw)
  if (!o || typeof o.day !== 'number' || typeof o.date !== 'string' || !Array.isArray(o.events) || !Array.isArray(o.mine)) return null
  const ok = o.events.every((e) => {
    const x = obj(e)
    return !!x && typeof x.id === 'string' && typeof x.title === 'string' && typeof x.startAt === 'number' && typeof x.endAt === 'number' && typeof x.placeId === 'string' && typeof x.status === 'string'
  })
  return ok ? (raw as ProgramView) : null
}

export function asDiningView(raw: unknown): DiningView | null {
  const o = obj(raw)
  if (!o || !Array.isArray(o.reservations) || !obj(o.window) || !Array.isArray(o.party)) return null
  return o.reservations.every((r) => !!obj(r) && typeof obj(r)!.id === 'string' && typeof obj(r)!.venueId === 'string') ? (raw as DiningView) : null
}

export function asFolioView(raw: unknown): FolioView | null {
  const o = obj(raw)
  if (!o || !Array.isArray(o.lines) || !obj(o.totals) || !Array.isArray(o.guests)) return null
  return o.lines.every((l) => !!obj(l) && typeof obj(l)!.id === 'string' && typeof obj(l)!.cents === 'number') ? (raw as FolioView) : null
}

export function asPortDayView(raw: unknown): PortDayView | null {
  const o = obj(raw)
  if (!o || !obj(o.day) || !Array.isArray(o.tours)) return null
  return raw as PortDayView
}

/** The port day as kept on the phone. "No more port days" is a real answer, so it is wrapped: a bare null would look like "nothing saved". */
export interface PortDayCopy { view: PortDayView | null }

export function asPortDayCopy(raw: unknown): PortDayCopy | null {
  const o = obj(raw)
  if (!o || !('view' in o)) return null
  return o.view === null ? { view: null } : asPortDayView(o.view) ? (raw as PortDayCopy) : null
}

export function asMusterView(raw: unknown): MusterView | null {
  const o = obj(raw)
  if (!o || typeof o.station !== 'string' || typeof o.at !== 'number' || !Array.isArray(o.guests)) return null
  return raw as MusterView
}

export function asFamilyView(raw: unknown): FamilyView | null {
  const o = obj(raw)
  return o && Array.isArray(o.kids) && Array.isArray(o.adults) && obj(o.reunion) && Array.isArray(o.log) ? (raw as FamilyView) : null
}

export function asHealthView(raw: unknown): HealthView | null {
  const o = obj(raw)
  return o && typeof o.day === 'string' && typeof o.open === 'boolean' && Array.isArray(o.reports) && Array.isArray(o.requests) && Array.isArray(o.guests) ? (raw as HealthView) : null
}

export function asRoomView(raw: unknown): RoomView | null {
  const o = obj(raw)
  return o && typeof o.number === 'string' && typeof o.steward === 'string' && Array.isArray(o.amenities) && obj(o.housekeeping) && obj(o.devices) ? (raw as RoomView) : null
}

export function asPhotosView(raw: unknown): PhotosView | null {
  const o = obj(raw)
  return o && Array.isArray(o.photos) && Array.isArray(o.favourites) && Array.isArray(o.owned) && Array.isArray(o.receipts) && Array.isArray(o.people) ? (raw as PhotosView) : null
}
