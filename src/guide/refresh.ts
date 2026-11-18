import { forgetSharedLoads } from '../hooks/useSharedMine'
import { sync } from '../sync'

/** The server works out the plan, so after a change it reads (a put-aside task brought back, a fit answer) save it first, then read the plan again. */
export async function refreshGuide(): Promise<void> {
  await sync.flush()
  forgetSharedLoads()
  window.dispatchEvent(new Event('guide:refresh'))
}
