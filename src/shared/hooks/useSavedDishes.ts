import { shortlistFrom, type SavedItem } from '../../features/explorer/domain/shortlist'
import { api } from '../../app/runtime'
import { useMine } from './useMine'
import { usePins } from './usePins'
import { useShip } from './useShipCatalogue'

/** The dishes the guest saved (to remember, never to order), named by the server, for the ship they are on. Empty until loaded, and nothing is asked when none are saved. */
export function useSavedDishes(): SavedItem[] {
  const pins = usePins()
  const ship = useShip()
  const keys = pins.keys.filter((k) => k.startsWith('dish:'))
  const served = useMine(() => (keys.length === 0 ? Promise.resolve([]) : api.discover.shortlist()), [keys.join('|')]).data
  return served ? shortlistFrom(served, ship.id).filter((i) => i.kind === 'dish') : []
}
