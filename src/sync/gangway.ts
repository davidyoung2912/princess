import { portRows } from './portRows'

/**
 * The gangway reader (a Medallion read as a guest steps on or off the ship). With a real reader the ship's own system tells the server and the app only has to
 * pick up the guest's presence row; until then the server's demo route stands in for it. The app does not know which: it asks the server to record a scan and,
 * when that is done, takes the rows back so the screen follows. Framework-free.
 */
export type GangwayDirection = 'on' | 'off'

export interface GangwayRemote {
  /** Resolves to the server's answer, or undefined when the account has no such route (a real account). */
  scan(direction: GangwayDirection): Promise<unknown>
}

let remote: GangwayRemote | null = null
export const setGangwayRemote = (r: GangwayRemote | null): void => { remote = r }

/** True when the server recorded the scan and the rows were taken back; false when there is no server route, it refused, or it could not be reached (so the caller does the same thing by hand). */
export async function gangwayScan(direction: GangwayDirection, pull: () => Promise<void> = () => portRows.pull()): Promise<boolean> {
  if (!remote) return false
  try {
    if ((await remote.scan(direction)) === undefined) return false
    await pull()
    return true
  } catch {
    return false
  }
}
