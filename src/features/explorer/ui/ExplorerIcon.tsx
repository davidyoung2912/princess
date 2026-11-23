import type { ExplorerKind } from '../domain/types'
import { Activities, Drama, Exercise, ShoppingBag, Spa, UtensilsCrossed } from '../../../shared/ui/icons'

/** The one icon for each kind of event or place, so a dinner, a show or a spa slot looks the same on every screen. */
const ICONS = { dining: UtensilsCrossed, entertainment: Drama, shopping: ShoppingBag, spa: Spa, exercise: Exercise, activities: Activities } as const satisfies Record<ExplorerKind, unknown>

/** Decorative: the title beside it says what the item is. */
export function ExplorerIcon({ kind }: { kind: ExplorerKind }) {
  const Icon = ICONS[kind]
  return <Icon className="explorer-icon" aria-hidden="true" focusable="false" />
}
