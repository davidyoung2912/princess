import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PlaceMap } from './PlaceMap'

const pins = [
  { id: 'a', label: 'Old Town', at: { lat: 42.4251, lng: 18.7712 }, note: 'Walk-off' },
  { id: 'b', label: 'Fortress', at: { lat: 42.4207, lng: 18.7703 } },
  { id: 'c', label: 'Market', at: { lat: 42.4235, lng: 18.769 } },
]

describe('PlaceMap', () => {
  it('draws numbered pins and lists the same places as text', () => {
    const html = renderToString(<PlaceMap title="Things to do" pins={pins} />)
    expect(html).toContain('role="img"')
    expect(html).toContain('Map with 3 numbered places')
    for (const p of pins) expect(html).toContain(p.label)
    expect(html).toContain('<ol class="place-map__list">')
    expect(html).not.toContain('place-map__route')
  })
  it('shows the walking route with times for each leg and the total', () => {
    const html = renderToString(<PlaceMap title="My walk" pins={pins} route startLabel="the ship" />)
    expect(html).toContain('place-map__route')
    expect(html).toContain('Start at the ship')
    expect(html).toMatch(/\d+ min walk, \d+ m/)
    expect(html).toContain('Walking time in all')
    expect(html).toContain('travelmode=walking')
  })
  it('never embeds Google without a key and sends nothing on load', () => {
    const html = renderToString(<PlaceMap title="x" pins={pins} route />)
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('Show the Google map here')
  })
  it('says the times are rough and renders nothing for no places', () => {
    expect(renderToString(<PlaceMap title="x" pins={pins} />)).toContain('Times are rough')
    expect(renderToString(<PlaceMap title="x" pins={[]} />)).toBe('')
  })
})
