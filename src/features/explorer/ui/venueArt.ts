import type { PoseId } from '../../../shared/art/manifest'
import type { ExplorerKind } from '../domain/types'

/** The Stanley pose of an Explorer's page. */
export const EXPLORER_POSE: Record<ExplorerKind, PoseId> = {
  dining: 'dining', spa: 'spa', entertainment: 'theatre', exercise: 'exercise', shopping: 'shopping', activities: 'pirate',
}

/** The pose that suits one venue: the bar, the casino, the pool, the dance floor or the stage, falling back on its Explorer's pose. Decorative only; the venue's name and kind say the same in words. */
export function venuePose(explorer: ExplorerKind, kind: string, title = ''): PoseId {
  const t = title.toLowerCase()
  if (kind === 'casino') return 'casino'
  if (kind === 'bar') return 'bar'
  if (kind === 'pool' || /pool|lido|seaview|neptune/.test(t)) return 'poolside'
  if (explorer === 'entertainment' && (kind === 'music' || /club|nightclub|disco|fusion|crooners|take five/.test(t))) return 'dancing'
  if (kind === 'desk') return 'checklist'
  if (kind === 'family') return 'pirate'
  if (kind === 'deck' && explorer === 'activities') return 'binoculars'
  if (kind === 'gallery') return 'camera'
  return EXPLORER_POSE[explorer]
}
