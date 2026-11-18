/** The cruise day each port is visited (the first, when it is visited twice), so a pill for "tours in Cozumel" can open that day's tours. */
export function portDays(days: readonly { day: number; port: string }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const d of days) if (!(d.port in out)) out[d.port] = d.day
  return out
}
