/**
 * Screens that need a ship at `aboard` depth (its deck plan, cabins by number, muster stations, venues and menus). A ship at `browse` depth has facts, highlights,
 * sailings and sample room prices but not these, so when the sailing in focus runs on one of those ships, the screen says so plainly and points to what is
 * available instead (`docs/catalogue-plan.md` section 5). The ship in focus is the sailing's ship, so the demo personas, who sail Sun Princess, never see it.
 */
export type AboardFeature = 'deckPlan' | 'cabins' | 'venues' | 'muster' | 'order'

const SCREENS: readonly { path: string; feature: AboardFeature }[] = [
  { path: '/ship/map', feature: 'deckPlan' },
  { path: '/home/cabins', feature: 'cabins' },
  { path: '/ship/venues', feature: 'venues' },
  { path: '/plan/dining', feature: 'venues' },
  { path: '/ship/muster', feature: 'muster' },
  { path: '/ship/order', feature: 'order' },
]

/** What the screen at this path needs from the ship, or null when any ship will do. A path matches itself and anything under it. */
export function aboardFeatureAt(pathname: string): AboardFeature | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return SCREENS.find((s) => path === s.path || path.startsWith(`${s.path}/`))?.feature ?? null
}

/** Whether the ship's depth is enough for the feature (`aboard` has everything; a ship not yet loaded is not judged). */
export const hasDepthFor = (depth: 'browse' | 'aboard' | undefined): boolean => depth !== 'browse'
