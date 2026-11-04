/**
 * Placeholder art ids (catalogue plan, section 8; the ART0 plan in `docs/experience-extension-ideas.md` 16.6). The art itself is not drawn yet: a screen asks for
 * the id of the picture it would show, and until the art exists every id falls back to the plain card. Tier A ports get a postcard, every other port the
 * scene of its region, ships their own picture, and regions a scene.
 */
export type ArtKind = 'ship' | 'region' | 'postcard' | 'regionScene'

export interface ArtRef { id: string; kind: ArtKind }

export const shipArt = (shipId: string): ArtRef => ({ id: `ship.${shipId}`, kind: 'ship' })
export const regionArt = (regionId: string): ArtRef => ({ id: `region.${regionId}`, kind: 'region' })

/** A Tier A port has its own postcard; any other port shows the scene of its region (or the generic scene when the region is not known). */
export function portArt(portId: string, tier: 'A' | 'B' | 'C', regionId?: string): ArtRef {
  if (tier === 'A') return { id: `port.${portId}`, kind: 'postcard' }
  return { id: `region.${regionId ?? 'generic'}`, kind: 'regionScene' }
}

/** Every id the catalogue needs art for: each ship, each region and each Tier A port. */
export function artManifest(c: { ships: readonly { id: string }[]; regions: readonly { id: string }[]; ports: readonly { id: string; tier: 'A' | 'B' | 'C'; region?: string }[] }): ArtRef[] {
  const out: ArtRef[] = [...c.ships.map((s) => shipArt(s.id)), ...c.regions.map((r) => regionArt(r.id))]
  for (const p of c.ports) if (p.tier === 'A') out.push(portArt(p.id, 'A'))
  return out
}
