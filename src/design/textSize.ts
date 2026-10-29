/** Text-size choices. The root font size is a percentage of the browser's own setting, so a guest's device preference still counts. */

export type TextSize = 'standard' | 'large' | 'xlarge'

export const TEXT_SIZES: readonly TextSize[] = ['standard', 'large', 'xlarge']

/** Root size as a percentage of the browser default (16px): 18px, 22px and 26px at the default. */
export const ROOT_PERCENT: Record<TextSize, number> = { standard: 112.5, large: 137.5, xlarge: 162.5 }

export const DEFAULT_TEXT_SIZE: TextSize = 'standard'

export const isTextSize = (v: unknown): v is TextSize => typeof v === 'string' && (TEXT_SIZES as readonly string[]).includes(v)

/** The root pixel size for a text size at the browser's default of 16px. */
export const rootPixels = (size: TextSize, browserDefault = 16): number => (ROOT_PERCENT[size] / 100) * browserDefault
