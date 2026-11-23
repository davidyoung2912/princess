/**
 * The screens the guest has moved through in this visit, so Back can return to the previous screen without leaving the app.
 * It is in memory only: a refresh starts a new trail and Back then falls back to Home. Framework-free; the Shell feeds it.
 */
export type NavigationKind = 'PUSH' | 'REPLACE' | 'POP'

let trail: string[] = []

/** Records arriving at an address. A new screen is added, a replacement swaps the current one, and moving back or forward in the browser follows the trail. */
export function recordVisit(address: string, kind: NavigationKind): void {
  if (trail[trail.length - 1] === address && kind !== 'PUSH') return
  if (kind === 'REPLACE' && trail.length > 0) trail[trail.length - 1] = address
  else if (kind === 'POP' && trail.length > 1 && trail[trail.length - 2] === address) trail.pop()
  else trail.push(address)
  if (trail.length > 50) trail = trail.slice(-50)
}

/** Whether there is an earlier screen in this visit to go back to. */
export const canGoBack = (): boolean => trail.length > 1

export const resetTrail = (): void => { trail = [] }
