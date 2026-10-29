import type { StringKey } from '../i18n'
import type { ScenarioId } from './scenarios'

/** Changes to the trip the ship or the line makes (SUP-06, SAF-06, MNG-15): what changed, what the guest can choose, what they are offered, and a record that they saw it. Texts are authored concept values. */
export type Severity = 'critical' | 'important' | 'info'

export interface DisruptionDef {
  id: ScenarioId
  severity: Severity
  title: StringKey
  /** What changed: a before and an after, in words. */
  changes: readonly { what: StringKey; before: StringKey; after: StringKey }[]
  /** The choices on offer. Seeing the notice is acknowledged by picking one (or "I understand" where there is no choice). */
  options: readonly { id: string; label: StringKey }[]
  compensation: StringKey | null
  /** Where to go next. */
  link: string | null
}

export const DISRUPTIONS: readonly DisruptionDef[] = [
  {
    id: 'portSkipped', severity: 'critical', title: 'disrupt.portSkipped.title',
    changes: [
      { what: 'disrupt.portSkipped.c1.what', before: 'disrupt.portSkipped.c1.before', after: 'disrupt.portSkipped.c1.after' },
      { what: 'disrupt.portSkipped.c2.what', before: 'disrupt.portSkipped.c2.before', after: 'disrupt.portSkipped.c2.after' },
    ],
    options: [{ id: 'credit', label: 'disrupt.portSkipped.o1' }, { id: 'talk', label: 'disrupt.portSkipped.o2' }],
    compensation: 'disrupt.portSkipped.comp', link: '/plan/excursions',
  },
  {
    id: 'belizeTender', severity: 'important', title: 'disrupt.belizeTender.title',
    changes: [
      { what: 'disrupt.belizeTender.c1.what', before: 'disrupt.belizeTender.c1.before', after: 'disrupt.belizeTender.c1.after' },
      { what: 'disrupt.belizeTender.c2.what', before: 'disrupt.belizeTender.c2.before', after: 'disrupt.belizeTender.c2.after' },
    ],
    options: [{ id: 'keep', label: 'disrupt.belizeTender.o1' }, { id: 'stay', label: 'disrupt.belizeTender.o2' }],
    compensation: null, link: '/ship/port',
  },
  {
    id: 'planChange', severity: 'info', title: 'disrupt.planChange.title',
    changes: [
      { what: 'disrupt.planChange.c1.what', before: 'disrupt.planChange.c1.before', after: 'disrupt.planChange.c1.after' },
      { what: 'disrupt.planChange.c2.what', before: 'disrupt.planChange.c2.before', after: 'disrupt.planChange.c2.after' },
    ],
    options: [{ id: 'ok', label: 'disrupt.understand' }],
    compensation: null, link: '/plan',
  },
  {
    id: 'clockChange', severity: 'important', title: 'disrupt.clockChange.title',
    changes: [{ what: 'disrupt.clockChange.c1.what', before: 'disrupt.clockChange.c1.before', after: 'disrupt.clockChange.c1.after' }],
    options: [{ id: 'ok', label: 'disrupt.understand' }],
    compensation: null, link: '/ship/port',
  },
  {
    id: 'terminalChange', severity: 'important', title: 'disrupt.terminalChange.title',
    changes: [{ what: 'disrupt.terminalChange.c1.what', before: 'disrupt.terminalChange.c1.before', after: 'disrupt.terminalChange.c1.after' }],
    options: [{ id: 'ok', label: 'disrupt.understand' }],
    compensation: null, link: '/home/embarkation',
  },
  {
    id: 'illness', severity: 'important', title: 'disrupt.illness.title',
    changes: [{ what: 'disrupt.illness.c1.what', before: 'disrupt.illness.c1.before', after: 'disrupt.illness.c1.after' }],
    options: [{ id: 'ok', label: 'disrupt.understand' }],
    compensation: null, link: '/ship/health',
  },
]

export const disruptionById = (id: unknown): DisruptionDef | undefined => DISRUPTIONS.find((d) => d.id === id)

const RANK: Record<Severity, number> = { critical: 0, important: 1, info: 2 }

/** The disruptions in force for the active scenarios, most serious first. */
export const activeDisruptions = (scenarios: readonly string[]): DisruptionDef[] =>
  DISRUPTIONS.filter((d) => scenarios.includes(d.id)).sort((a, b) => RANK[a.severity] - RANK[b.severity])

export const validOption = (def: DisruptionDef, option: unknown): boolean => def.options.some((o) => o.id === option)
