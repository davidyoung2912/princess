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

/** How many pictures the picker shows at once. */
export const AVATAR_PAGE_SIZE = 4

/** The number of pages for `count` pictures (at least one). */
export const avatarPageCount = (count: number, size = AVATAR_PAGE_SIZE): number => Math.max(1, Math.ceil(count / size))

/** Moves a page by `delta` and wraps round at both ends, so Next on the last page goes back to the first. */
export const stepAvatarPage = (page: number, pages: number, delta: number): number => (((page + delta) % pages) + pages) % pages

/** The page that holds the picture with `id`, or the first page when it is not in the list. */
export function avatarPageOf(choices: readonly { id: string }[], id: string | null | undefined, size = AVATAR_PAGE_SIZE): number {
  const at = choices.findIndex((c) => c.id === id)
  return at < 0 ? 0 : Math.floor(at / size)
}

/** The pictures on one page, in catalogue order (people, sketch, robots, then critters). */
export const avatarPage = <T,>(choices: readonly T[], page: number, size = AVATAR_PAGE_SIZE): T[] => choices.slice(page * size, page * size + size)
