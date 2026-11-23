import { describe, expect, it } from 'vitest'
import { shipExplorerRows } from '../../../../scripts/ship-explorer-data'
import { Dices, Martini, UtensilsCrossed, Waves } from '../../../shared/ui/icons'
import { venueIcon } from './venueIcon'

describe('venueIcon', () => {
  it('suits the kind of venue and falls back on its Explorer', () => {
    expect(venueIcon('dining', 'bar')).toBe(Martini)
    expect(venueIcon('entertainment', 'casino')).toBe(Dices)
    expect(venueIcon('entertainment', 'deck', 'SeaView and Wake View Terraces')).toBe(Waves)
    expect(venueIcon('dining', 'something-new')).toBe(UtensilsCrossed)
  })
  it('gives every venue on the ships an icon', () => {
    for (const ship of Object.values(shipExplorerRows())) for (const v of ship.venues) expect(venueIcon(v.explorer, v.kind, v.title), `${v.explorer}/${v.kind}`).toBeDefined()
  })
})
