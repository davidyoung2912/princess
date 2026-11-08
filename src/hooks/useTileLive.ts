import { useMemo } from 'react'
import { api } from '../runtime'
import { tileValues } from '../domain/tileLive'
import { t } from '../i18n'
import { useMine } from './useMine'

/** Live values for the tiles of a tab, by screen path. Loads only what the tab's screens need; a failed or slow load just leaves the tile plain. */
export function useTileLive(paths: readonly string[], enabled: boolean): Record<string, string> {
  const wantChecklist = enabled && paths.includes('/plan/checklist')
  const wantPacking = enabled && paths.includes('/plan/packing')
  const checklist = useMine(() => (wantChecklist ? api.plan.checklist.get() : Promise.resolve(null)), [wantChecklist])
  const packing = useMine(() => (wantPacking ? api.plan.packing.get() : Promise.resolve(null)), [wantPacking])
  const wantDinners = enabled && paths.includes('/plan/reservations')
  const wantDocs = enabled && paths.includes('/me/documents')
  const plan = useMine(() => (wantDinners ? api.plan.overview() : Promise.resolve(null)), [wantDinners])
  const trips = useMine(() => (wantDocs ? api.trips.list() : Promise.resolve(null)), [wantDocs])
  const c = checklist.data
  const p = packing.data
  const dinners = plan.data ? plan.data.days.reduce((n, d) => n + d.entries.filter((e) => e.kind === 'dinner').length, 0) : null
  const documents = trips.data?.upcoming.find((x) => x.kind === 'current')?.documents ?? null
  return useMemo(() => tileValues(
    { checklist: c ? c.progress : null, packing: p ? { ticked: p.ticked.length, total: p.items.length } : null, dinners, documents },
    { checklist: (done, total) => t('tile.checklist', { done, total }), packing: (done, total) => t('tile.packing', { done, total }),
      dinners: (count) => t('tile.dinners', { count }), docsReady: t('tile.docsReady'), docsMissing: (count) => t('tile.docsMissing', { count }), docsPassport: (count) => t('tile.docsPassport', { count }) },
  ), [c, p, dinners, documents])
}
