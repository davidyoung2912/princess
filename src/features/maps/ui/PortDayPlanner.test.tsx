import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GuideAttraction } from '../../../domain/portGuide'
import { PortDayPlanner } from './PortDayPlanner'

const a = (name: string, tier: string, lat: number, lng: number): GuideAttraction => ({ name, aka: '', tier, logistics: [], why: '', links: [], map: { lat, lng } })
const walkable = [a('Old Town', 'Walk-Off / Independent', 42.4251, 18.7712), a('Fortress', 'Walk-Off / Independent', 42.4207, 18.7703), a('Market', 'Walk-Off / Independent', 42.4235, 18.769)]

describe('PortDayPlanner', () => {
  it('shows a timed plan with the return time and the caveat', () => {
    const html = renderToString(<PortDayPlanner attractions={walkable} arrive="08:00" allAboard="16:30" tender={false} date="2027-03-24" port="kotor" />)
    expect(html).toContain('Plan my port day')
    expect(html).toMatch(/\d stops, about \d+ min of walking/)
    expect(html).toContain('Head back to the ship')
    expect(html).toContain('last word')
    expect(html).toContain('travelmode=walking')
  })
  it('explains when there is too little time or too few walking places', () => {
    expect(renderToString(<PortDayPlanner attractions={walkable} arrive="12:00" allAboard="13:00" tender={false} date="2027-03-24" port="kotor" />)).toContain('not enough time')
    const far = [a('Beach', 'Local Transit / Independent', 20.4, -86.9), a('Ruins', 'Local Transit / Independent', 20.5, -86.8)]
    expect(renderToString(<PortDayPlanner attractions={far} arrive="08:00" allAboard="16:30" tender={false} date="2027-03-24" port="kotor" />)).toContain('too few places')
  })
  it('draws nothing for a port with fewer than two places on the map', () => {
    expect(renderToString(<PortDayPlanner attractions={walkable.slice(0, 1)} arrive="08:00" allAboard="16:30" tender={false} date="2027-03-24" port="kotor" />)).toBe('')
  })
})
