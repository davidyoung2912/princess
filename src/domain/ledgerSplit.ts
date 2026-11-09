import type { StringKey } from '../i18n'
import { normalizeContributions, type ContributionPlan } from './contributions'

/**
 * The split ledger (XG-03, S6A-06): a running tally of who paid what for shared things across families, with a fair settle-up at the end.
 * No money moves inside the app and nothing here charges anyone: it only works out who owes whom. Amounts are whole cents.
 */
export const MAX_PARTIES = 6
export const MAX_ITEMS = 200
export const MAX_TITLE = 80

export interface SplitParty { id: string; name: string; /** People in the family, for splitting by head. */ people: number }
export type SplitMode = 'equal' | 'byPeople'
export type SplitKind = 'taxi' | 'tour' | 'meal' | 'cabin' | 'other'
export const SPLIT_KINDS: readonly SplitKind[] = ['taxi', 'tour', 'meal', 'cabin', 'other']

export interface SplitItem {
  id: string
  title: string
  kind: SplitKind
  cents: number
  paidBy: string
  /** The families that share it. */
  among: string[]
  mode: SplitMode
  at: number
  /** Port-day date it belongs to, if any. */
  date: string | null
}

export interface SplitState {
  parties: SplitParty[]
  items: SplitItem[]
  /** When the guests last marked the tally settled. */
  settledAt: number | null
  /** The booking split among invited payers (BOK-10), if the organiser has set one up. */
  contributions: ContributionPlan | null
}
export const EMPTY_SPLIT: SplitState = { parties: [], items: [], settledAt: null, contributions: null }

export interface Transfer { from: string; to: string; cents: number }

/** Dollars as typed ("12.50", "$12", "1,200.5") to cents, or null when it is not a positive amount. */
export function parseCents(text: string): number | null {
  const clean = text.replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  const cents = Math.round(Number(clean) * 100)
  return cents > 0 && cents <= 100_000_00 ? cents : null
}

export const formatCents = (cents: number): string => `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** What each sharing family owes for one item. The leftover cents go to the first families, so the shares always add up to the total. */
export function shares(item: SplitItem, parties: readonly SplitParty[]): Record<string, number> {
  const among = item.among.filter((id) => parties.some((p) => p.id === id))
  if (among.length === 0) return {}
  const weights = among.map((id) => (item.mode === 'byPeople' ? Math.max(1, parties.find((p) => p.id === id)!.people) : 1))
  const total = weights.reduce((a, b) => a + b, 0)
  const base = weights.map((w) => Math.floor((item.cents * w) / total))
  let left = item.cents - base.reduce((a, b) => a + b, 0)
  const out: Record<string, number> = {}
  among.forEach((id, i) => { out[id] = base[i] + (left > 0 ? 1 : 0); if (left > 0) left-- })
  return out
}

/** Each family's balance: positive means the others owe them, negative means they owe. The balances add up to zero. */
export function balances(state: SplitState): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(state.parties.map((p) => [p.id, 0]))
  for (const item of state.items) {
    const owed = shares(item, state.parties)
    if (Object.keys(owed).length === 0 || !(item.paidBy in out)) continue
    out[item.paidBy] += item.cents
    for (const [id, c] of Object.entries(owed)) out[id] -= c
  }
  return out
}

/** The fewest payments that settle everything: the biggest debtor pays the biggest creditor, and so on. */
export function settleUp(state: SplitState): Transfer[] {
  const b = balances(state)
  const debtors = Object.entries(b).filter(([, c]) => c < 0).map(([id, c]) => ({ id, c: -c })).sort((x, y) => y.c - x.c || x.id.localeCompare(y.id))
  const creditors = Object.entries(b).filter(([, c]) => c > 0).map(([id, c]) => ({ id, c })).sort((x, y) => y.c - x.c || x.id.localeCompare(y.id))
  const out: Transfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const cents = Math.min(debtors[i].c, creditors[j].c)
    if (cents > 0) out.push({ from: debtors[i].id, to: creditors[j].id, cents })
    debtors[i].c -= cents
    creditors[j].c -= cents
    if (debtors[i].c === 0) i++
    if (creditors[j].c === 0) j++
  }
  return out
}

export const totalShared = (state: SplitState): number => state.items.reduce((a, x) => a + x.cents, 0)

export const FAMILY_PROBLEM_KEY: Record<SplitProblem, StringKey> = {
  name: 'split.problem.family.name', duplicate: 'split.problem.family.duplicate', tooMany: 'split.problem.family.tooMany', people: 'split.problem.family.people',
}
export const ITEM_PROBLEM_KEY: Record<ItemProblem, StringKey> = {
  title: 'split.problem.item.title', amount: 'split.problem.item.amount', payer: 'split.problem.item.payer', among: 'split.problem.item.among', tooMany: 'split.problem.item.tooMany',
}

export type SplitProblem = 'name' | 'duplicate' | 'tooMany' | 'people'

export function addParty(state: SplitState, name: string, people: number, id: string): { state: SplitState; problem: SplitProblem | null } {
  const clean = name.trim().slice(0, 40)
  if (!clean) return { state, problem: 'name' }
  if (!Number.isFinite(people) || people < 1 || people > 12) return { state, problem: 'people' }
  if (state.parties.some((p) => p.name.toLowerCase() === clean.toLowerCase())) return { state, problem: 'duplicate' }
  if (state.parties.length >= MAX_PARTIES) return { state, problem: 'tooMany' }
  return { state: { ...state, parties: [...state.parties, { id, name: clean, people: Math.round(people) }] }, problem: null }
}

/** A family leaves the tally only when nothing refers to it; otherwise the balances would stop adding up. */
export function removeParty(state: SplitState, id: string): SplitState {
  return state.items.some((x) => x.paidBy === id || x.among.includes(id)) ? state : { ...state, parties: state.parties.filter((p) => p.id !== id) }
}

export type ItemProblem = 'title' | 'amount' | 'payer' | 'among' | 'tooMany'

export function addItem(state: SplitState, input: { title: string; kind: SplitKind; amount: string; paidBy: string; among: string[]; mode: SplitMode; date: string | null }, at: number, id: string): { state: SplitState; problem: ItemProblem | null } {
  const title = input.title.trim().slice(0, MAX_TITLE)
  const cents = parseCents(input.amount)
  const among = input.among.filter((a) => state.parties.some((p) => p.id === a))
  if (!title) return { state, problem: 'title' }
  if (cents === null) return { state, problem: 'amount' }
  if (!state.parties.some((p) => p.id === input.paidBy)) return { state, problem: 'payer' }
  if (among.length === 0) return { state, problem: 'among' }
  if (state.items.length >= MAX_ITEMS) return { state, problem: 'tooMany' }
  return { state: { ...state, settledAt: null, items: [...state.items, { id, title, kind: input.kind, cents, paidBy: input.paidBy, among, mode: input.mode, at, date: input.date }] }, problem: null }
}

export const removeItem = (state: SplitState, id: string): SplitState => ({ ...state, items: state.items.filter((x) => x.id !== id) })
export const markSettled = (state: SplitState, at: number): SplitState => ({ ...state, settledAt: at })

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

export function normalizeSplit(raw: unknown): SplitState {
  if (!isObj(raw)) return EMPTY_SPLIT
  const parties = (Array.isArray(raw.parties) ? raw.parties : []).flatMap((x): SplitParty[] =>
    isObj(x) && typeof x.id === 'string' && typeof x.name === 'string' && x.name.trim() && typeof x.people === 'number' && x.people >= 1 ? [{ id: x.id, name: x.name.slice(0, 40), people: Math.min(12, Math.round(x.people)) }] : []).slice(0, MAX_PARTIES)
  const items = (Array.isArray(raw.items) ? raw.items : []).flatMap((x): SplitItem[] => {
    if (!isObj(x) || typeof x.id !== 'string' || typeof x.title !== 'string' || typeof x.cents !== 'number' || !Number.isInteger(x.cents) || x.cents <= 0 || typeof x.paidBy !== 'string' || !Array.isArray(x.among)) return []
    if (!parties.some((p) => p.id === x.paidBy)) return []
    const among = x.among.filter((a): a is string => typeof a === 'string' && parties.some((p) => p.id === a))
    if (among.length === 0) return []
    return [{
      id: x.id, title: x.title.slice(0, MAX_TITLE), kind: SPLIT_KINDS.includes(x.kind as SplitKind) ? (x.kind as SplitKind) : 'other', cents: x.cents, paidBy: x.paidBy, among,
      mode: x.mode === 'byPeople' ? 'byPeople' : 'equal', at: typeof x.at === 'number' ? x.at : 0, date: typeof x.date === 'string' ? x.date : null,
    }]
  }).slice(0, MAX_ITEMS)
  return { parties, items, settledAt: typeof raw.settledAt === 'number' ? raw.settledAt : null, contributions: normalizeContributions(raw.contributions) }
}
