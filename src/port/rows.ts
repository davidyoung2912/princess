import { ALERT_CHOICES, EMPTY_PORT_PARTY, MAX_RENDEZVOUS, type MeetState } from '../domain/portParty'
import { MAX_ITEMS, MAX_PARTIES } from '../domain/ledgerSplit'
import { IDEAS_MAX, POLLS_MAX } from '../domain/board'
import { normalizePort, type PortState } from './store'

/**
 * The port day's shared record as rows (multi-device plan 2, Phase 6). The screens keep working on `PortState`; this module turns it into rows and back so
 * that each person's "I'm back", each expense and each meeting place is saved on its own, with the time it was changed. A delete is a row that stays
 * (`deleted`), so a device that still has the old copy cannot bring it back. Framework-free; the server keeps the later change of each row.
 */
export type RowKind = 'presence' | 'plan' | 'planB' | 'setting' | 'meet' | 'meetState' | 'party' | 'item' | 'poll' | 'vote' | 'idea' | 'heart'

export interface PortRow { kind: RowKind; key: string; data: unknown; /** Milliseconds, from the device that made the change. */ at: number; deleted: boolean }

const KINDS: readonly RowKind[] = ['presence', 'plan', 'planB', 'setting', 'meet', 'meetState', 'party', 'item', 'poll', 'vote', 'idea', 'heart']
const MAX_KEY = 90

export const rowId = (r: Pick<PortRow, 'kind' | 'key'>): string => `${r.kind}/${r.key}`

/** A part of a key with anything but letters, digits, `_` and `-` written as `:` and four hex digits, so `|` can separate parts and the server's key rule holds. */
const enc = (s: string): string => s.replace(/[^A-Za-z0-9_-]/g, (c) => `:${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
const dec = (s: string): string => s.replace(/:([0-9a-f]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
const DATE = /^\d{4}-\d{2}-\d{2}$/

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** What a state holds, one entry for each row it would have. */
export function valuesOf(state: PortState): Map<string, { kind: RowKind; key: string; data: unknown }> {
  const out = new Map<string, { kind: RowKind; key: string; data: unknown }>()
  const put = (kind: RowKind, key: string, data: unknown) => { if (key.length <= MAX_KEY) out.set(`${kind}/${key}`, { kind, key, data }) }
  for (const [date, day] of Object.entries(state.party.days)) {
    for (const [who, entry] of Object.entries(day.presence)) put('presence', `${date}|${enc(who)}`, entry)
    if (day.plan) put('plan', date, day.plan)
    if (day.planB) put('planB', date, day.planB)
  }
  if (state.party.alertBefore !== EMPTY_PORT_PARTY.alertBefore) put('setting', 'alertBefore', state.party.alertBefore)
  for (const r of state.party.rendezvous) {
    put('meet', enc(r.id), { place: r.place, at: r.at, by: r.by, fallback: r.fallback, fallbackAfter: r.fallbackAfter })
    for (const [who, s] of Object.entries(r.members)) put('meetState', `${enc(r.id)}|${enc(who)}`, s)
  }
  for (const p of state.split.parties) put('party', enc(p.id), { name: p.name, people: p.people })
  for (const i of state.split.items) put('item', enc(i.id), i)
  if (state.split.settledAt !== null) put('setting', 'settledAt', state.split.settledAt)
  // The group poll and dream board: one row for each poll, idea, vote and heart, so two people acting at once never overwrite each other.
  for (const p of state.board.polls) {
    put('poll', enc(p.id), { question: p.question, options: p.options })
    for (const [who, option] of Object.entries(p.votes)) put('vote', `${enc(p.id)}|${enc(who)}`, option)
  }
  for (const i of state.board.ideas) {
    put('idea', enc(i.id), { text: i.text })
    for (const who of i.hearts) put('heart', `${enc(i.id)}|${enc(who)}`, true)
  }
  return out
}

/** The changes that turn `prev` into `next`: every row that is new or different, and a deleted row for each that is gone. */
export function diffState(prev: PortState, next: PortState, now: number): PortRow[] {
  const before = valuesOf(prev)
  const after = valuesOf(next)
  const ops: PortRow[] = []
  for (const [id, v] of after) if (JSON.stringify(before.get(id)?.data) !== JSON.stringify(v.data) || !before.has(id)) ops.push({ ...v, at: now, deleted: false })
  for (const [id, v] of before) if (!after.has(id)) ops.push({ kind: v.kind, key: v.key, data: null, at: now, deleted: true })
  return ops
}

/**
 * A state's rows for a first upload (a record from before rows existed). Nothing has a time of its own except presence and expenses, so the rest get a small
 * counting number: any real change, and any delete, is later than that, and the order things were added in is kept.
 */
export function legacyRows(state: PortState): PortRow[] {
  let n = 0
  const rows: PortRow[] = []
  for (const v of valuesOf(state).values()) {
    n++
    const own = v.kind === 'item' && isObj(v.data) && typeof v.data.at === 'number' && v.data.at > 0 ? v.data.at
      : v.kind === 'presence' && isObj(v.data) && typeof v.data.at === 'number' && v.data.at > 0 ? v.data.at : n
    rows.push({ ...v, at: own, deleted: false })
  }
  return rows
}

/** The later change wins; a tie keeps `stored` (the same rule as the server). */
export const winner = (stored: PortRow | undefined, incoming: PortRow): PortRow => (!stored || incoming.at > stored.at ? incoming : stored)

/** `base` with `ops` laid over it. */
export function layer(base: readonly PortRow[], ops: readonly PortRow[]): PortRow[] {
  const map = new Map(base.map((r) => [rowId(r), r]))
  for (const o of ops) map.set(rowId(o), winner(map.get(rowId(o)), o))
  return [...map.values()]
}

/** Reads rows from the server, dropping any that are malformed. */
export function normalizeRows(raw: unknown): PortRow[] {
  const list = isObj(raw) && Array.isArray(raw.rows) ? raw.rows : []
  return list.flatMap((x): PortRow[] => {
    if (!isObj(x) || !KINDS.includes(x.kind as RowKind) || typeof x.key !== 'string' || typeof x.at !== 'number') return []
    return [{ kind: x.kind as RowKind, key: x.key, data: x.data ?? null, at: x.at, deleted: x.deleted === true }]
  })
}

/** The state the live rows describe. */
export function stateOfRows(rows: readonly PortRow[]): PortState {
  const live = rows.filter((r) => !r.deleted && r.data !== null)
  const days: Record<string, { presence: Record<string, unknown>; plan: unknown; planB: unknown }> = {}
  const day = (date: string) => (days[date] ??= { presence: {}, plan: null, planB: null })
  let alertBefore: number = EMPTY_PORT_PARTY.alertBefore
  let settledAt: number | null = null
  const meets: { id: string; at: number; data: Record<string, unknown> }[] = []
  const meetStates: { id: string; who: string; state: unknown }[] = []
  const parties: { at: number; id: string; data: Record<string, unknown> }[] = []
  const items: { at: number; id: string; data: Record<string, unknown> }[] = []
  const polls: { at: number; id: string; data: Record<string, unknown> }[] = []
  const votes: { poll: string; who: string; option: unknown }[] = []
  const ideas: { at: number; id: string; data: Record<string, unknown> }[] = []
  const hearts: { idea: string; who: string }[] = []
  for (const r of live) {
    const parts = r.key.split('|')
    if (r.kind === 'presence' && parts.length === 2 && DATE.test(parts[0])) day(parts[0]).presence[dec(parts[1])] = r.data
    else if (r.kind === 'plan' && DATE.test(r.key)) day(r.key).plan = r.data
    else if (r.kind === 'planB' && DATE.test(r.key)) day(r.key).planB = r.data
    else if (r.kind === 'setting' && r.key === 'alertBefore' && ALERT_CHOICES.includes(r.data as 45)) alertBefore = r.data as number
    else if (r.kind === 'setting' && r.key === 'settledAt' && typeof r.data === 'number') settledAt = r.data
    else if (r.kind === 'meet' && isObj(r.data)) meets.push({ id: dec(r.key), at: r.at, data: r.data })
    else if (r.kind === 'meetState' && parts.length === 2) meetStates.push({ id: dec(parts[0]), who: dec(parts[1]), state: r.data })
    else if (r.kind === 'party' && isObj(r.data)) parties.push({ at: r.at, id: dec(r.key), data: r.data })
    else if (r.kind === 'item' && isObj(r.data)) items.push({ at: r.at, id: dec(r.key), data: r.data })
    else if (r.kind === 'poll' && isObj(r.data)) polls.push({ at: r.at, id: dec(r.key), data: r.data })
    else if (r.kind === 'vote' && parts.length === 2) votes.push({ poll: dec(parts[0]), who: dec(parts[1]), option: r.data })
    else if (r.kind === 'idea' && isObj(r.data)) ideas.push({ at: r.at, id: dec(r.key), data: r.data })
    else if (r.kind === 'heart' && parts.length === 2) hearts.push({ idea: dec(parts[0]), who: dec(parts[1]) })
  }
  const byAge = <T extends { at: number; id: string }>(list: T[]): T[] => [...list].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  const rendezvous = byAge(meets).slice(-MAX_RENDEZVOUS).map((m) => ({
    ...m.data, id: m.id,
    members: Object.fromEntries(meetStates.filter((s) => s.id === m.id).map((s): [string, MeetState] => [s.who, s.state as MeetState])),
  }))
  return normalizePort({
    party: { days, alertBefore, rendezvous },
    split: {
      parties: byAge(parties).slice(0, MAX_PARTIES).map((p) => ({ ...p.data, id: p.id })),
      items: byAge(items).slice(0, MAX_ITEMS).map((i) => ({ ...i.data, id: i.id })),
      settledAt,
    },
    board: {
      polls: byAge(polls).slice(0, POLLS_MAX).map((p) => ({ ...p.data, id: p.id, votes: Object.fromEntries(votes.filter((v) => v.poll === p.id).map((v) => [v.who, v.option])) })),
      ideas: byAge(ideas).slice(0, IDEAS_MAX).map((i) => ({ ...i.data, id: i.id, hearts: hearts.filter((h) => h.idea === i.id).map((h) => h.who) })),
    },
  })
}
