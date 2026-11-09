/**
 * Our Album (REM-04): a photo is shared by the person who owns it, only with the people on the booking, and only that person can
 * take it back. Nothing is shared until its owner chooses to, and there is no public link.
 */
export interface AlbumEntry { photoId: string; mine: boolean }

/** The photos the caller shared, which are the only ones they may take back. */
export const mySharedIds = (album: readonly AlbumEntry[]): string[] => [...new Set(album.filter((a) => a.mine).map((a) => a.photoId))]

/** Whether a photo in the album is the caller's to take back. */
export const canTakeBack = (entry: AlbumEntry): boolean => entry.mine
