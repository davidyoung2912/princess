/** Why a plan change was refused, as catalog keys (listed here so each one is named in the source). */
export const REFUSED = {
  missing: 'autopilot.refused.missing',
  conflict: 'autopilot.refused.conflict',
  closed: 'autopilot.refused.closed',
} as const
