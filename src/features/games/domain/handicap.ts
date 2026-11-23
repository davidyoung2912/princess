/** How much of a head start the player gets against the computer (a handicap), or none. */
export type Handicap = 'none' | 'small' | 'large'
export const HANDICAPS: readonly Handicap[] = ['none', 'small', 'large']
/** 0, 1 or 2 extra pieces, stones or discs. */
export const stepsOf = (h: Handicap): number => (h === 'none' ? 0 : h === 'small' ? 1 : 2)
