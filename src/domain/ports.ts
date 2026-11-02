import type { PortId } from './sailings'

export interface Excursion {
  id: string
  name: string
  hours: number
  /** Dollars per adult; authored sample. */
  price: number
  /** How much walking, steps or uneven ground it involves. */
  access: 'easy' | 'some' | 'demanding'
}

export interface PortGuide {
  id: Exclude<PortId, 'sea'>
  short: string
  /** How the ship reaches shore. */
  landing: 'pier' | 'tender'
  blurb: string
  bestTime: string
  /** Plain statement of what getting ashore and around is like. */
  access: string
  doThis: readonly string[]
  excursions: readonly Excursion[]
}

export const PORT_GUIDES: Record<Exclude<PortId, 'sea'>, PortGuide> = {} as Record<Exclude<PortId, 'sea'>, PortGuide>

export const portGuideById = (id: unknown): PortGuide | undefined => (typeof id === 'string' ? (PORT_GUIDES as Record<string, PortGuide | undefined>)[id] : undefined)

/** Approximate longitude and latitude, for the route sketch only. */
export const PORT_COORDS: Record<Exclude<PortId, 'sea'>, [number, number]> = {} as Record<Exclude<PortId, 'sea'>, [number, number]>

/** Replaces the guides and coordinates in place (`portsServed.ts`), so earlier imports see the served values. */
export function replacePorts(next: { guides: Record<string, PortGuide>; coords: Record<string, [number, number]> }): void {
  const g = PORT_GUIDES as Record<string, PortGuide>
  for (const k of Object.keys(g)) delete g[k]
  Object.assign(g, next.guides)
  const c = PORT_COORDS as Record<string, [number, number]>
  for (const k of Object.keys(c)) delete c[k]
  Object.assign(c, next.coords)
}
