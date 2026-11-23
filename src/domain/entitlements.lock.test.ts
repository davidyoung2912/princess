import { describe, expect, it } from 'vitest'
import { lockedPerks } from './entitlements'

describe('perks a guest does not have yet', () => {
  it('names the level that unlocks each, lowest first', () => {
    const l = lockedPerks([], 'none')
    expect(l.find((x) => x.perk === 'memberEvents')?.unlock).toEqual({ by: 'tier', tier: 'gold' })
    expect(l.find((x) => x.perk === 'welcomeGift')?.unlock).toEqual({ by: 'tier', tier: 'ruby' })
    expect(l.find((x) => x.perk === 'priorityEmbarkation')?.unlock).toEqual({ by: 'tier', tier: 'platinum' })
    expect(l.find((x) => x.perk === 'suiteLounge')?.unlock).toEqual({ by: 'suite' })
  })
  it('leaves out what the guest already has', () => {
    const l = lockedPerks(['memberEvents', 'welcomeGift', 'priorityEmbarkation', 'priorityDisembarkation', 'freeLaundry'], 'platinum')
    expect(l).toEqual([{ perk: 'suiteLounge', unlock: { by: 'suite' } }])
  })
  it('has nothing locked at the top with a suite perk held', () => {
    expect(lockedPerks(['memberEvents', 'welcomeGift', 'priorityEmbarkation', 'priorityDisembarkation', 'freeLaundry', 'suiteLounge'], 'elite')).toEqual([])
  })
})
