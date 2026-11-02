import { createSync, type Remote } from './sync'

let remote: Remote | null = null

/** The one sync manager the stores tell about changes. The runtime gives it a remote only when the app talks to the real API. */
export const sync = createSync({ remote: () => remote })
export const setRemote = (r: Remote | null): void => { remote = r }
