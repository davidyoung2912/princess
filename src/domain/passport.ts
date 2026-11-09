/**
 * The accessibility passport (QOL-20): the guest's own accessibility requests, shared with each part of the trip only when they choose. Before sharing, the guest sees
 * exactly what that recipient would get; sharing can be taken back at any time, and the recipient's acknowledgement is shown once it arrives.
 * Medical card details are never part of the passport.
 */
export const RECIPIENTS = ['booking', 'transfers', 'ship', 'excursions'] as const
export type Recipient = (typeof RECIPIENTS)[number]
export const isRecipient = (v: unknown): v is Recipient => RECIPIENTS.some((r) => r === v)

export interface PassportShare {
  recipient: Recipient
  sharedAt: number
  /** Null while the share stands. */
  revokedAt: number | null
  /** When the recipient acknowledged it, if they have. */
  ackAt: number | null
}

/** What goes to each recipient: the kinds of request that matter to them. */
const SCOPE: Record<Recipient, readonly string[]> = {
  booking: ['wheelchair', 'accessibleEquipment', 'tender', 'assistiveListening', 'largePrint', 'cpap', 'oxygen', 'dietary', 'serviceAnimal'],
  transfers: ['wheelchair', 'accessibleEquipment', 'serviceAnimal'],
  ship: ['wheelchair', 'accessibleEquipment', 'tender', 'assistiveListening', 'largePrint', 'cpap', 'oxygen', 'dietary', 'serviceAnimal'],
  excursions: ['wheelchair', 'accessibleEquipment', 'tender', 'assistiveListening', 'largePrint', 'serviceAnimal'],
}

export interface PassportRequest { kind: string; guest: string }

/** The requests a recipient would see: those of a kind in their scope. Nothing outside it is sent. */
export const previewFor = <T extends PassportRequest>(recipient: Recipient, requests: readonly T[]): T[] => requests.filter((r) => SCOPE[recipient].includes(r.kind))

export const activeShare = (list: readonly PassportShare[], recipient: Recipient): PassportShare | undefined => list.find((s) => s.recipient === recipient && s.revokedAt === null)

/** Shares with a recipient (a repeat share is ignored while one stands). */
export function share(list: readonly PassportShare[], recipient: Recipient, now: number): PassportShare[] {
  if (activeShare(list, recipient)) return [...list]
  return [...list.filter((s) => s.recipient !== recipient), { recipient, sharedAt: now, revokedAt: null, ackAt: null }]
}

export const revoke = (list: readonly PassportShare[], recipient: Recipient, now: number): PassportShare[] =>
  list.map((s) => (s.recipient === recipient && s.revokedAt === null ? { ...s, revokedAt: now } : s))

export function normalizeShares(raw: unknown): PassportShare[] {
  if (!Array.isArray(raw)) return []
  const out: PassportShare[] = []
  for (const x of raw) {
    const o = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>
    if (isRecipient(o.recipient) && typeof o.sharedAt === 'number' && !out.some((s) => s.recipient === o.recipient)) {
      out.push({ recipient: o.recipient, sharedAt: o.sharedAt, revokedAt: typeof o.revokedAt === 'number' ? o.revokedAt : null, ackAt: typeof o.ackAt === 'number' ? o.ackAt : null })
    }
  }
  return out
}
