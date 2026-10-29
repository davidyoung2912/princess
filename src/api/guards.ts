import type { BoardingView, EmbarkView, ReceiptView } from './types'

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
