import type { ComponentType, SVGProps } from 'react'
import type { ExplorerKind } from '../../domain/explorer/types'
import {
  Activity, Baby, Binoculars, BookOpen, ChefHat, ClipboardCheck, Clapperboard, Dices, Exercise, Footprints, Frame, Martini, Music, Palette, Presentation, Sandwich, Scissors, ShoppingBag, Spa,
  Sun, Tag, ThermometerSun, Trophy, UtensilsCrossed, Users, Waves, Activities, Drama,
} from '../icons'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

const BY_KIND: Record<ExplorerKind, Readonly<Record<string, Icon>>> = {
  dining: { bar: Martini, casual: Sandwich, main: UtensilsCrossed, specialty: ChefHat },
  spa: { salon: Scissors, sanctuary: Spa, spa: Spa, thermal: ThermometerSun },
  entertainment: { casino: Dices, deck: Sun, music: Music, show: Drama, studio: Clapperboard },
  exercise: { court: Trophy, gym: Exercise, pool: Waves, studio: Activity, track: Footprints },
  shopping: { gallery: Frame, popup: Tag, shop: ShoppingBag },
  activities: { community: Users, deck: Binoculars, desk: ClipboardCheck, family: Baby, quiet: BookOpen, talks: Presentation, workshop: Palette },
}

const FALLBACK: Record<ExplorerKind, Icon> = { dining: UtensilsCrossed, spa: Spa, entertainment: Drama, exercise: Exercise, shopping: ShoppingBag, activities: Activities }

/** The icon that suits one venue (a bar, a casino, a pool, a stage, a salon), falling back on its Explorer's icon. Decorative only; the venue's name says the same in words. */
export function venueIcon(explorer: ExplorerKind, kind: string, title = ''): Icon {
  if (explorer === 'entertainment' && /pool|lido|seaview|neptune/i.test(title)) return Waves
  return BY_KIND[explorer][kind] ?? FALLBACK[explorer]
}
