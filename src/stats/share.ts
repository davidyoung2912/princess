import type { StatItem, StatSection, StatsReport } from '../api/statsTypes'

/** Turns a screen's path into its title; the stat's value is the path itself when it names a screen. */
export type ResolveRoute = (path: string) => string

const MADE_UP = '(made up)'

/** The words a stat is shared as: "Messages sent: 1,234", with "(made up)" after a joke so nobody takes it for data. */
export function statText(item: StatItem, resolve: ResolveRoute): string {
  const value = item.route ? resolve(item.route) : item.value
  const note = item.note && !item.route ? `, ${item.note.toLowerCase().replace(/\.$/, '')}` : ''
  return `${item.label}: ${value}${note}${item.joke ? ` ${MADE_UP}` : ''}`.trim()
}

/** A section as text: its title, then a line per stat. A section of made-up stats says so in its title. */
export function sectionText(section: StatSection, resolve: ResolveRoute, includeJokes = true): string {
  const lines = section.stats.filter((s) => includeJokes || !s.joke).map((s) => `• ${statText(s, resolve)}`)
  if (lines.length === 0) return ''
  return `${section.icon} ${section.title}${section.joke ? ` ${MADE_UP}` : ''}\n${lines.join('\n')}`
}

/** The stats worth leading with, in the report's order, from the ids it names. */
export function highlightItems(report: StatsReport): StatItem[] {
  const byId = new Map(report.sections.flatMap((s) => s.stats).map((s) => [s.id, s] as const))
  return report.highlights.flatMap((id) => { const s = byId.get(id); return s ? [s] : [] })
}

/** A short card: the headline and the highlights. What most people will actually send. */
export function cardText(report: StatsReport, resolve: ResolveRoute): string {
  const lines = highlightItems(report).map((s) => `• ${statText(s, resolve)}`)
  return [`${report.name}'s cruise stats`, report.headline, ...lines].join('\n')
}

/** Every section, as text. Made-up stats can be left out. */
export function reportText(report: StatsReport, resolve: ResolveRoute, includeJokes = true): string {
  const parts = report.sections.filter((s) => includeJokes || !s.joke).map((s) => sectionText(s, resolve, includeJokes)).filter((s) => s !== '')
  return [`${report.name}'s cruise stats`, report.headline, ...parts].join('\n\n')
}

/** Which sections to show: all of them, or only the ones that are not entirely made up. */
export const visibleSections = (report: StatsReport, showJokes: boolean): StatSection[] =>
  report.sections.filter((s) => showJokes || !s.joke).map((s) => (showJokes ? s : { ...s, stats: s.stats.filter((x) => !x.joke) }))
