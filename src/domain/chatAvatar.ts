import type { AvatarChoice, AvatarGroup } from '../api/chatTypes'

export type { AvatarChoice, AvatarGroup }

/**
 * Chat avatars (phase 9c): a guest picks one of about 50 cartoon pictures (people, sketch people, robots, critters) in their welcome, and can change it in Settings.
 * The pictures are drawn once by DiceBear, stored in the database (`dbo.ChatAvatars`, by `scripts/seed_avatars.py`) and served by the API; the app never calls DiceBear.
 * The choice is the picture's id, for example `bottts-31`. A guest who has not chosen shows their initials.
 */

export const AVATAR_GROUPS: readonly AvatarGroup[] = ['people', 'sketch', 'robots', 'critters']

/** The shape the server accepts, checked here so a bad value never becomes part of an address. */
export const isAvatarId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9-]{1,30}$/.test(v)

/** Where a picture is served (no sign-in needed, because an image tag cannot send one). Null for anything that is not a well-formed id. */
export const avatarImageUrl = (apiBase: string, id: string | null | undefined): string | null => (isAvatarId(id) ? `${apiBase}/public/avatars/${id}` : null)

/** The catalogue split by group, in the order the groups are shown; a group with nothing in it is left out, and anything with an unknown group is ignored. */
export function groupAvatars(choices: readonly AvatarChoice[]): { group: AvatarGroup; choices: AvatarChoice[] }[] {
  return AVATAR_GROUPS.map((group) => ({ group, choices: choices.filter((c) => c.group === group && isAvatarId(c.id)) })).filter((g) => g.choices.length > 0)
}
