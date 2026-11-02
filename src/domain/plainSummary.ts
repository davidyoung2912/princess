import type { PlanRow } from './planChange'

/**
 * Plain-English summaries (XA-05) of the day plan, the bill and a long notice, at one of three levels.
 * These are rules over the original, not a model: a summary line is built only from the original's own facts and sentences,
 * and every summary comes back with the original beside it. Pure.
 */
export const SUMMARY_LEVELS = ['short', 'plain', 'steps'] as const
export type SummaryLevel = (typeof SUMMARY_LEVELS)[number]
export const isSummaryLevel = (v: unknown): v is SummaryLevel => SUMMARY_LEVELS.some((l) => l === v)

export interface Summary {
  level: SummaryLevel
  /** One line of the summary each; at the steps level they are numbered by the screen. */
  lines: string[]
  /** The original, line by line, unchanged. */
  original: string[]
  source: { label: string; path: string }
}

export interface BillCharge { label: string; cents: number; reason: string }

const usd = (cents: number): string => `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`
const byStart = (a: PlanRow, b: PlanRow): number => a.entry.start.localeCompare(b.entry.start)

/** The day plan, without anything dropped, in time order. */
export function summarisePlan(rows: readonly PlanRow[], level: SummaryLevel): Summary {
  const live = rows.filter((r) => r.state !== 'dropped').slice().sort(byStart)
  const source = { label: 'Your day', path: '/plan/day' }
  const original = live.map((r) => `${r.entry.start} ${r.entry.title} (${r.entry.minutes} min)`)
  if (live.length === 0) return { level, lines: ['Nothing is planned for today.'], original, source }
  if (level === 'short') {
    const dinner = live.find((r) => r.entry.kind === 'dinner')
    const lines = [`${live.length === 1 ? '1 thing' : `${live.length} things`} planned. The first is ${live[0].entry.title} at ${live[0].entry.start}.`]
    if (dinner) lines.push(`Dinner is at ${dinner.entry.start}.`)
    return { level, lines, original, source }
  }
  if (level === 'plain') return { level, lines: live.map((r) => `At ${r.entry.start}: ${r.entry.title}.`), original, source }
  return {
    level,
    lines: live.map((r, i) => `${r.entry.title} at ${r.entry.start}, about ${r.entry.minutes} minutes${r.was ? `. You moved it from ${r.was}` : ''}${i === 0 ? '. This is first' : ''}.`),
    original, source,
  }
}

/** The bill: what was charged, biggest first at the longer levels, with the plain reason the app already gives for each. */
export function summariseBill(charges: readonly BillCharge[], level: SummaryLevel): Summary {
  const list = charges.filter((c) => c.cents > 0)
  const source = { label: 'Your bill', path: '/me/bill' }
  const original = list.map((c) => `${c.label}: ${usd(c.cents)}`)
  if (list.length === 0) return { level, lines: ['There are no charges on your bill.'], original, source }
  const total = list.reduce((s, c) => s + c.cents, 0)
  const big = list.slice().sort((a, b) => b.cents - a.cents)
  if (level === 'short') return { level, lines: [`${list.length === 1 ? '1 charge' : `${list.length} charges`}, ${usd(total)} in all.`, `The biggest is ${big[0].label}: ${usd(big[0].cents)}.`], original, source }
  if (level === 'plain') return { level, lines: list.map((c) => `${c.label}: ${usd(c.cents)}. ${c.reason}`), original, source }
  return { level, lines: [...big.map((c) => `${c.label} is ${usd(c.cents)}. ${c.reason}`), `Add them up: ${usd(total)}.`], original, source }
}

const RULE = /\d|\b(must|cannot|can not|need|needs|required|due|bring|tell|only|at least)\b/i

/** Splits text into its own sentences, keeping the full stop. */
export const sentences = (text: string): string[] => (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter(Boolean)

/**
 * A long notice or policy. Nothing is reworded: short keeps the sentences that carry a number or a rule, plain keeps every sentence on its own line,
 * and steps does the same in order, to be numbered. When no sentence carries a rule, short keeps the first of each paragraph.
 */
export function summariseNotice(title: string, path: string, paragraphs: readonly string[], level: SummaryLevel): Summary {
  const all = paragraphs.flatMap(sentences)
  const source = { label: title, path }
  let lines = all
  if (level === 'short') {
    const keep = all.filter((s) => RULE.test(s))
    lines = keep.length > 0 ? keep : paragraphs.map((p) => sentences(p)[0]).filter((s): s is string => !!s)
  }
  return { level, lines, original: [...paragraphs], source }
}

const NUMBER = /\$\d[\d,]*(?:\.\d+)?|\d{1,2}:\d{2}|\d+/g

/** Every number, time and amount in the summary that the original does not contain: should always be empty. A count of the original's lines is allowed, and so is anything in `extra`. */
export function unsupportedNumbers(summary: Summary, extra: readonly string[] = []): string[] {
  const pool = new Set([...summary.original, ...extra, String(summary.original.length)].join(' ').match(NUMBER) ?? [])
  return (summary.lines.join(' ').match(NUMBER) ?? []).filter((n) => !pool.has(n))
}

/** The summary as spoken or copied text. */
export const summaryText = (s: Summary, title: string, numbered: boolean): string =>
  [title, ...s.lines.map((l, i) => (numbered ? `${i + 1}. ${l}` : l))].join('\n')
