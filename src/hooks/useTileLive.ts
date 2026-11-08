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
  const c = checklist.data
  const p = packing.data
  return useMemo(() => tileValues(
    { checklist: c ? c.progress : null, packing: p ? { ticked: p.ticked.length, total: p.items.length } : null },
    { checklist: (done, total) => t('tile.checklist', { done, total }), packing: (done, total) => t('tile.packing', { done, total }) },
  ), [c, p])
}
