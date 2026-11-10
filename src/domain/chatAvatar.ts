/** Chat avatars (phase 9c): a colour and a ship icon, with the guest's initials as the fallback. No photo is ever uploaded. Stored on the account as `colour:icon`, the same text the server checks (`ChatAvatarRules`). */

export const AVATAR_COLOURS = ['sea', 'teal', 'coral', 'gold', 'plum', 'green'] as const
export type AvatarColour = (typeof AVATAR_COLOURS)[number]

/** `initials` is no icon: the letters of the name. */
export const AVATAR_ICONS = ['initials', 'anchor', 'wheel', 'lifebuoy', 'wave', 'star', 'compass', 'funnel'] as const
export type AvatarIcon = (typeof AVATAR_ICONS)[number]

/** The picture for each icon; decorative only, the name is always spoken from the words in `en.ts`. */
export const AVATAR_GLYPHS: Record<Exclude<AvatarIcon, 'initials'>, string> = { anchor: '⚓', wheel: '☸️', lifebuoy: '🛟', wave: '🌊', star: '⭐', compass: '🧭', funnel: '🚢' }

export interface Avatar { colour: AvatarColour; icon: AvatarIcon }

export const DEFAULT_AVATAR: Avatar = { colour: 'sea', icon: 'initials' }

const isColour = (v: string): v is AvatarColour => (AVATAR_COLOURS as readonly string[]).includes(v)
const isIcon = (v: string): v is AvatarIcon => (AVATAR_ICONS as readonly string[]).includes(v)

/** A stored `colour:icon`, or null for anything else (a missing, old or tampered value shows the plain initials). */
export function parseAvatar(value: string | null | undefined): Avatar | null {
  const parts = (value ?? '').split(':')
  return parts.length === 2 && isColour(parts[0]) && isIcon(parts[1]) ? { colour: parts[0], icon: parts[1] } : null
}

export const avatarText = (a: Avatar): string => `${a.colour}:${a.icon}`

/** What a round avatar shows: the icon's picture, or the initials when there is no icon. */
export const avatarFace = (a: Avatar | null, initials: string): string => (a && a.icon !== 'initials' ? AVATAR_GLYPHS[a.icon] : initials)
