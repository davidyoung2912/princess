import { updateSettings } from '../settings/store'
import { sync } from './index'

/**
 * The guest's choice to keep private notes and health details in their account (docs/multi-device-plan.md, Phase 2).
 * On: this device's copy is sent, or the account's copy is taken if there already is one. Off: the account's copy is deleted and this device keeps its own. Resolves to false when the deletion is still waiting for the connection.
 */
export async function setKeepPrivate(on: boolean): Promise<boolean> {
  updateSettings({ syncPrivate: on })
  if (on) { await sync.pull(); return true }
  const results = await Promise.all([sync.withdraw('memory'), sync.withdraw('health'), sync.withdraw('concierge'), sync.withdraw('calm'), sync.withdraw('family'), sync.withdraw('travellers')])
  return results.every(Boolean)   // false: a copy will be deleted when the connection returns
}
