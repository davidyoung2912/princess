import { Anchor, ArrowRight, Backpack, Compass, Globe, ListChecks, MapPin, Route, Theater, Users } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { pillIcon } from './pillIcons'

describe('pillIcon', () => {
  it('gives the stage welcome pills their own icons by id, whatever the next stage is called', () => {
    expect(pillIcon('Welcome aboard', 'welcome-before')).toBe(Anchor)
    expect(pillIcon('What this stage is about', 'welcome-focus')).toBe(Compass)
    expect(pillIcon('What you’ll need', 'welcome-need')).toBe(Backpack)
    expect(pillIcon('How this prepares you for Back aboard', 'welcome-lead')).toBe(Route)
    expect(pillIcon('Your progress in this stage', 'welcome-steps')).toBe(ListChecks)
    expect(pillIcon('How to move on to Boarding', 'welcome-moveon')).toBe(ArrowRight)
  })
  it('chooses by the words when there is no id, the specific rule before the general', () => {
    expect(pillIcon('What you’ll need')).toBe(Backpack)
    expect(pillIcon('Port facts')).toBe(Globe)
    expect(pillIcon('Ports that call here')).toBe(MapPin)
    expect(pillIcon('Culture and fun facts')).toBe(Theater)
    expect(pillIcon('People to know')).toBe(Users)
  })
  it('falls back to the compass for words it does not know', () => {
    expect(pillIcon('Zzz qqq')).toBe(Compass)
  })
})
