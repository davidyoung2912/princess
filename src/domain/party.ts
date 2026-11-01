import { isEmail } from './signup'

/** Travel party coordination (MNG-16): invitations to co-travellers and notes the party shares. Kept on this device, under the booker. */
export const MAX_INVITES = 8
export const MAX_NOTES = 50
export const MAX_NOTE_LENGTH = 280

export interface PartyInvite { id: string; email: string; at: number }
export interface PartyNote { id: string; by: string; text: string; at: number }
export interface PartyState { invites: PartyInvite[]; notes: PartyNote[] }

export const EMPTY_PARTY: PartyState = { invites: [], notes: [] }

export type InviteProblem = 'email' | 'duplicate' | 'tooMany'
export type NoteProblem = 'empty' | 'tooLong' | 'tooMany'
export type Change<P> = { state: PartyState; problem: null } | { state: PartyState; problem: P }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Reads a saved record, dropping anything malformed and anything over the limits. */
export function normalizePartyState(raw: unknown): PartyState {
  if (!isObj(raw)) return EMPTY_PARTY
  const invites = (Array.isArray(raw.invites) ? raw.invites : []).flatMap((x): PartyInvite[] =>
    isObj(x) && typeof x.id === 'string' && typeof x.email === 'string' && isEmail(x.email) && typeof x.at === 'number' ? [{ id: x.id, email: x.email.trim().toLowerCase(), at: x.at }] : [])
  const notes = (Array.isArray(raw.notes) ? raw.notes : []).flatMap((x): PartyNote[] =>
    isObj(x) && typeof x.id === 'string' && typeof x.by === 'string' && typeof x.text === 'string' && x.text.trim() && typeof x.at === 'number' ? [{ id: x.id, by: x.by, text: x.text.slice(0, MAX_NOTE_LENGTH), at: x.at }] : [])
  return { invites: invites.slice(0, MAX_INVITES), notes: notes.slice(-MAX_NOTES) }
}

/** Invites someone by email: a valid address, once, up to the limit. */
export function addInvite(state: PartyState, email: string, at: number, id: string): Change<InviteProblem> {
  const clean = email.trim().toLowerCase()
  if (!isEmail(clean)) return { state, problem: 'email' }
  if (state.invites.some((i) => i.email === clean)) return { state, problem: 'duplicate' }
  if (state.invites.length >= MAX_INVITES) return { state, problem: 'tooMany' }
  return { state: { ...state, invites: [...state.invites, { id, email: clean, at }] }, problem: null }
}

export const removeInvite = (state: PartyState, id: string): PartyState => ({ ...state, invites: state.invites.filter((i) => i.id !== id) })

/** Adds a note. The oldest note goes when the shared list is full, so a note is never refused for room. */
export function addNote(state: PartyState, by: string, text: string, at: number, id: string): Change<NoteProblem> {
  const clean = text.trim()
  if (!clean) return { state, problem: 'empty' }
  if (clean.length > MAX_NOTE_LENGTH) return { state, problem: 'tooLong' }
  return { state: { ...state, notes: [...state.notes, { id, by, text: clean, at }].slice(-MAX_NOTES) }, problem: null }
}

/** Takes a note away, only for the person who wrote it. */
export const removeNote = (state: PartyState, id: string, by: string): PartyState => ({ ...state, notes: state.notes.filter((n) => !(n.id === id && n.by === by)) })

export interface PartyCheckin { done: number; total: number; waiting: string[] }

/** Who has finished their own check-in steps and who is still waiting. */
export function partyCheckin(guests: readonly { first: string; progress: { complete: boolean } }[]): PartyCheckin {
  const waiting = guests.filter((g) => !g.progress.complete).map((g) => g.first)
  return { done: guests.length - waiting.length, total: guests.length, waiting }
}
