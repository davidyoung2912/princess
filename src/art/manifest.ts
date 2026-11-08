/**
 * The pictures the app draws, by id (experience-extension-ideas.md, 14 and 16.6). Screens ask for art by id, never by file name; the files come from
 * `npm run art` (originals in `art/source`, small WebP in `src/assets/art`). Art is decorative, so it carries no alt text; anything it says is in words too.
 */
import { JOURNEY_STAGES, type JourneyStage } from '../routes/hubs'

export type HeroId = JourneyStage
export const HERO_IDS: readonly HeroId[] = JOURNEY_STAGES

/** The sixteen full-body Stanley poses and what each is for (14.2). */
export const POSES = {
  wave: 'greeting', think: 'searching', thumbs: 'success', lifebuoy: 'help', sleep: 'quiet', point: 'look here', binoculars: 'port and search', clipboard: 'checklists',
  suitcase: 'packing and boarding', cheer: 'moments', oops: 'errors and offline', map: 'navigation', tray: 'dining', lifejacket: 'muster practice', umbrella: 'weather', camera: 'photos and diary',
} as const
export type PoseId = keyof typeof POSES

/** The head-and-shoulders moods. */
export const HEADS = ['stanley', 'confused', 'congratulations', 'excited', 'idea', 'proud', 'sailor-salute', 'sunglasses', 'surprised'] as const
export type HeadId = (typeof HEADS)[number]

export type ArtFile = { kind: 'hero'; id: HeroId; size: 'wide' | 'narrow' } | { kind: 'pose'; id: PoseId } | { kind: 'head'; id: HeadId }

/** The path under `src/assets/art` of a picture. */
export function artPath(f: ArtFile): string {
  if (f.kind === 'hero') return `heroes/${f.id}${f.size === 'narrow' ? '-sm' : ''}.webp`
  return f.kind === 'pose' ? `stanley/${f.id}.webp` : `heads/${f.id}.webp`
}

/** Every file the manifest expects, for the drop-in check. */
export function allArtPaths(): string[] {
  return [
    ...HERO_IDS.flatMap((id) => [artPath({ kind: 'hero', id, size: 'wide' }), artPath({ kind: 'hero', id, size: 'narrow' })]),
    ...(Object.keys(POSES) as PoseId[]).map((id) => artPath({ kind: 'pose', id })),
    ...HEADS.map((id) => artPath({ kind: 'head', id })),
  ]
}
