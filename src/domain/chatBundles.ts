/** Chat bundles (docs/chat-bundles-plan.md, phase B1): something from the app sent into a chat as a card that reads on its own. Framework-free. */
import type { ChatBundle } from '../api/chatTypes'
import type { StringKey } from '../i18n'
import { openablePath } from './chatCards'

/** The newest payload shape this app understands. A larger number is shown as its title and subtitle only. */
export const BUNDLE_VERSION = 1

export const BUNDLE_NOTE_MAX = 80

export interface BundleType {
  /** The word above the card ("Place", "Menu"). */
  label: StringKey
  /** The screen reader's name for the chat icon on this kind of thing. */
  family: 'venue' | 'menu'
  /** How a code for it is made: `direct` for public catalogue data (the address holds the ref, no signal needed), `handoff` for anything personal (a short code the server keeps for a short time). */
  qr: 'direct' | 'handoff'
}

/** The registry: every type this app can draw and open. A later phase adds a row here and the card, the dialog and the link rules follow. */
export const BUNDLE_TYPES: Readonly<Record<string, BundleType>> = {
  venue: { label: 'bundle.type.venue', family: 'venue', qr: 'direct' },
  menu: { label: 'bundle.type.menu', family: 'menu', qr: 'direct' },
}

const MAX_TEXT = 200

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.slice(0, MAX_TEXT) : undefined)
const whole = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1000 ? v : undefined)

/** A bundle from anything the server sent, or null when it is not one (no type or no title). Total: it never throws, and it keeps only the plain fields. */
export function parseBundle(raw: unknown): ChatBundle | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const type = text(r.type)
  const title = text(r.title)
  if (!type || !title) return null
  const out: ChatBundle = { type, v: whole(r.v) ?? 1, title }
  for (const key of ['subtitle', 'path', 'time', 'place', 'ref', 'note'] as const) {
    const value = text(r[key])
    if (value !== undefined) out[key] = value
  }
  const day = whole(r.day)
  if (day !== undefined) out.day = day
  return out
}

/** Whether this app can open the bundle: a type in the registry and a payload no newer than it knows. Anything else shows the title and subtitle and "Update the app to open this". */
export const isKnownBundle = (b: Pick<ChatBundle, 'type' | 'v'>): boolean => b.type in BUNDLE_TYPES && b.v <= BUNDLE_VERSION

/** Where Open goes, or null: an unknown bundle, or a path that is not one of the screens a shared item may open (the path never decides by itself, the allow-list does). */
export function bundleLink(b: Pick<ChatBundle, 'type' | 'v' | 'path'>): string | null {
  return isKnownBundle(b) ? openablePath(b.path) : null
}

/** The line a screen reader and a list preview use for a bundle: the title, its subtitle, and when and where. */
export function bundleSummary(b: ChatBundle, clock: (time: string) => string): string {
  const when = [b.day !== undefined ? `day ${b.day}` : '', b.time ? clock(b.time) : ''].filter(Boolean).join(', ')
  return [b.title, b.subtitle, when, b.place && b.place !== b.title ? b.place : ''].filter(Boolean).join(' · ')
}

/** The bundle a shared thing becomes: venue and menu refs are sent as bundles, every older ref (an excursion, a dinner, a plan) keeps its own kind so the old cards are untouched. */
export function shareInput(shareRef: string, kind: 'card' | 'plan', note?: string): { kind: 'bundle' | 'card' | 'plan'; shareRef: string; note?: string } {
  const type = shareRef.split(':')[0] ?? ''
  if (kind === 'card' && type in BUNDLE_TYPES) return { kind: 'bundle', shareRef, ...(note ? { note } : {}) }
  return kind === 'plan' ? { kind, shareRef, ...(note ? { note } : {}) } : { kind, shareRef }
}

/** Conversations that match what was typed, case and accents aside; everything when nothing was typed. */
export function matchConversations<T extends { name: string }>(rows: readonly T[], query: string): T[] {
  const plain = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const q = plain(query.trim())
  return q === '' ? [...rows] : rows.filter((r) => plain(r.name).includes(q))
}

/** The search box appears once there are more conversations than this. */
export const SEARCH_FROM = 8

export type SendOutcome = { id: string; name: string; ok: true } | { id: string; name: string; ok: false; error: unknown }

/** Sends to each chosen conversation in turn, one message each with its own client id (so a retry never doubles), and reports each one: a failure in one chat does not stop the others. */
export async function sendToMany<T extends { id: string; name: string }>(targets: readonly T[], send: (target: T) => Promise<unknown>): Promise<SendOutcome[]> {
  const out: SendOutcome[] = []
  for (const target of targets) {
    try { await send(target); out.push({ id: target.id, name: target.name, ok: true }) } catch (error) { out.push({ id: target.id, name: target.name, ok: false, error }) }
  }
  return out
}
