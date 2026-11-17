/**
 * Standing rules, the availability watch, practice mode and plain-words control as the server returns them (`/me/stanley/rules`, `/me/stanley/control`, phase P9a). The server works out every word; the device keeps the agreed
 * shape and in-app routes only. A rule only notices or lines something up: nothing here books, holds or sends anything. Framework-free, so it is tested in node.
 */
export type RuleParam = 'none' | 'time' | 'day' | 'table' | 'tour'
export interface StandingTemplate { id: string; wording: string; trigger: string; rung: number; param: RuleParam }
export interface StandingRule { id: string; template: string; wording: string; rung: number; practice: boolean; state: 'on' | 'practice' | 'needsPermission' }
export interface StandingItem { id: string; ruleId: string; template: string; kind: 'notice' | 'prepared' | 'would'; critical: boolean; title: string; detail: string; route: string }
export interface Choice { id: string; name: string }
export interface Standing {
  enabled: boolean; hasTrip: boolean; templates: StandingTemplate[]; rules: StandingRule[]; items: StandingItem[]; practice: StandingItem[]
  rolled: number; maxRules: number; notChecked: string[]; tables: Choice[]; tours: Choice[]; nights: number; times: string[]
}
export interface ControlProposal { understood: boolean; id: string; label: string; detail: string; needsConfirm: boolean; route: string | null; examples: string[] }
export interface ControlResult { applied: boolean; message: string; route: string | null }
export type Pace = 'more' | 'same' | 'less'
export const PACES: readonly Pace[] = ['more', 'same', 'less']

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown, max = 100000): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), max) : 0)
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' ? (v as Record<string, unknown>) : null)
const strings = (v: unknown, max: number, len: number): string[] => list(v, max).filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, len))

/** An in-app path only: never a full address and never a path that starts a second slash. */
export const safeRoute = (v: unknown): string => {
  const r = str(v, 120)
  return /^\/[A-Za-z0-9/_-]*$/.test(r) && !r.startsWith('//') ? r : ''
}

const PARAMS: readonly string[] = ['none', 'time', 'day', 'table', 'tour']

function template(raw: unknown): StandingTemplate | null {
  const o = obj(raw)
  if (!o) return null
  const id = str(o.id, 20), wording = str(o.wording, 200), param = str(o.param, 10)
  if (!id || !wording || !PARAMS.includes(param)) return null
  return { id, wording, trigger: str(o.trigger, 200), rung: num(o.rung, 4), param: param as RuleParam }
}

function rule(raw: unknown): StandingRule | null {
  const o = obj(raw)
  if (!o) return null
  const id = str(o.id, 40), template = str(o.template, 20), state = str(o.state, 20)
  if (!id || !template || !['on', 'practice', 'needsPermission'].includes(state)) return null
  return { id, template, wording: str(o.wording, 200), rung: num(o.rung, 4), practice: o.practice === true, state: state as StandingRule['state'] }
}

function item(raw: unknown): StandingItem | null {
  const o = obj(raw)
  if (!o) return null
  const id = str(o.id, 80), title = str(o.title, 200), kind = str(o.kind, 10)
  if (!id || !title || !['notice', 'prepared', 'would'].includes(kind)) return null
  return { id, ruleId: str(o.ruleId, 40), template: str(o.template, 20), kind: kind as StandingItem['kind'], critical: o.critical === true, title, detail: str(o.detail, 500), route: safeRoute(o.route) }
}

function choice(raw: unknown): Choice | null {
  const o = obj(raw)
  const id = o ? str(o.id, 60) : '', name = o ? str(o.name, 120) : ''
  return id && name ? { id, name } : null
}

const keep = <T,>(raw: unknown, max: number, f: (x: unknown) => T | null): T[] => list(raw, max).flatMap((x) => { const r = f(x); return r ? [r] : [] })

/** The rules screen's answer, or null when it is not the agreed shape. */
export function normalizeStanding(raw: unknown): Standing | null {
  const o = obj(raw)
  if (!o || typeof o.enabled !== 'boolean' || typeof o.hasTrip !== 'boolean') return null
  return {
    enabled: o.enabled, hasTrip: o.hasTrip, templates: keep(o.templates, 12, template), rules: keep(o.rules, 10, rule), items: keep(o.items, 40, item), practice: keep(o.practice, 40, item),
    rolled: num(o.rolled), maxRules: num(o.maxRules, 50) || 10, notChecked: strings(o.notChecked, 8, 300), tables: keep(o.tables, 20, choice), tours: keep(o.tours, 60, choice),
    nights: num(o.nights, 60), times: strings(o.times, 12, 5).filter((x) => /^\d\d:\d\d$/.test(x)),
  }
}

/** A sentence read as a control, or null when it is not the agreed shape. */
export function normalizeProposal(raw: unknown): ControlProposal | null {
  const o = obj(raw)
  if (!o || typeof o.understood !== 'boolean') return null
  return { understood: o.understood, id: str(o.id, 30), label: str(o.label, 200), detail: str(o.detail, 400), needsConfirm: o.needsConfirm === true, route: safeRoute(o.route) || null, examples: strings(o.examples, 8, 100) }
}

export function normalizeControlResult(raw: unknown): ControlResult | null {
  const o = obj(raw)
  if (!o || typeof o.applied !== 'boolean') return null
  return { applied: o.applied, message: str(o.message, 300), route: safeRoute(o.route) || null }
}

/** What to send to make a rule: only the fields its template takes, so a stale field never reaches the server. */
export function ruleBody(param: RuleParam, template: string, f: { target: string; day: string; time: string; practice: boolean }) {
  const body: { template: string; practice: boolean; target?: string; day?: number; time?: string } = { template, practice: f.practice }
  if (param === 'time') body.time = f.time
  if (param === 'day') body.day = Number(f.day)
  if (param === 'table') { body.target = f.target; body.day = Number(f.day); if (f.time) body.time = f.time }
  if (param === 'tour') body.target = f.target
  return body
}

/** Whether the form for this template has what it needs. */
export function ruleReady(param: RuleParam, f: { target: string; day: string; time: string }): boolean {
  const day = Number(f.day)
  const dayOk = Number.isInteger(day) && day >= 1
  switch (param) {
    case 'none': return true
    case 'time': return f.time.length > 0
    case 'day': return dayOk
    case 'table': return f.target.length > 0 && dayOk
    case 'tour': return f.target.length > 0
  }
}
