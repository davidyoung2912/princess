import type { Profile } from './account'

/**
 * Where the preferences saved on a profile are used (MNG-16). Describes what the app already does with them; it adds no switch, because
 * keeping a preference out of a later voyage needs a field the server does not have. Framework-free.
 */
export type PreferenceGroup = 'dietary' | 'needs' | 'bedding' | 'requests'
export type PreferenceUse = 'dining' | 'excursions' | 'checklist' | 'room'

export interface PreferenceLine { group: PreferenceGroup; count: number; uses: PreferenceUse[]; /** Health, access or child information. */ sensitive: boolean }

/** One line for each group the guest has filled in; empty groups are left out. */
export function preferenceUse(p: Pick<Profile, 'dietary' | 'needs' | 'bedding' | 'specialRequests'>, child: boolean): PreferenceLine[] {
  const lines: PreferenceLine[] = []
  if (p.dietary.length > 0) lines.push({ group: 'dietary', count: p.dietary.length, uses: ['dining'], sensitive: true })
  if (p.needs.length > 0) lines.push({ group: 'needs', count: p.needs.length, uses: ['excursions', 'checklist'], sensitive: true })
  if (p.bedding !== 'noPreference') lines.push({ group: 'bedding', count: 1, uses: ['room'], sensitive: child })
  if (p.specialRequests.trim()) lines.push({ group: 'requests', count: 1, uses: ['room'], sensitive: child })
  return lines
}
