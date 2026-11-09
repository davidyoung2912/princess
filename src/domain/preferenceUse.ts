import type { Profile } from './account'

/**
 * Where the preferences saved on a profile are used (MNG-16), and which of them the guest keeps out of later bookings. Food and access needs are the two
 * groups carried into a new booking, so they are the two that can be left out; the saved value stays on the profile. Framework-free.
 */
export const KEEP_OUT_GROUPS = ['dietary', 'needs'] as const
export type KeepOutGroup = (typeof KEEP_OUT_GROUPS)[number]
export const canKeepOut = (g: PreferenceGroup): g is KeepOutGroup => (KEEP_OUT_GROUPS as readonly string[]).includes(g)

/** Switches one group in or out of later bookings. */
export const toggleKeepOut = (list: readonly KeepOutGroup[] | undefined, g: KeepOutGroup): KeepOutGroup[] => (list ?? []).includes(g) ? (list ?? []).filter((x) => x !== g) : [...(list ?? []), g]

export type PreferenceGroup = 'dietary' | 'needs' | 'bedding' | 'requests'
export type PreferenceUse = 'dining' | 'excursions' | 'checklist' | 'room'

export interface PreferenceLine { group: PreferenceGroup; count: number; uses: PreferenceUse[]; /** Health, access or child information. */ sensitive: boolean; /** The guest keeps it out of later bookings. */ keptOut: boolean }

/** One line for each group the guest has filled in; empty groups are left out. */
export function preferenceUse(p: Pick<Profile, 'dietary' | 'needs' | 'bedding' | 'specialRequests' | 'keepOut'>, child: boolean): PreferenceLine[] {
  const lines: PreferenceLine[] = []
  if (p.dietary.length > 0) lines.push({ group: 'dietary', count: p.dietary.length, uses: ['dining'], sensitive: true, keptOut: (p.keepOut ?? []).includes('dietary') })
  if (p.needs.length > 0) lines.push({ group: 'needs', count: p.needs.length, uses: ['excursions', 'checklist'], sensitive: true, keptOut: (p.keepOut ?? []).includes('needs') })
  if (p.bedding !== 'noPreference') lines.push({ group: 'bedding', count: 1, uses: ['room'], sensitive: child, keptOut: false })
  if (p.specialRequests.trim()) lines.push({ group: 'requests', count: 1, uses: ['room'], sensitive: child, keptOut: false })
  return lines
}
