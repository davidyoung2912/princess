// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { applyPatterns, applyRegions, applyShips, normalizeEntries, normalizePatterns, normalizeRegions, normalizeShips, setSailingEntries } from '../../domain/shipCatalogue'
import { SailingsScreen } from './SailingsScreen'
import { ShipsScreen } from './ShipsScreen'
import { CompareShipsScreen } from './CompareShipsScreen'
import { ExploreScreen } from './ExploreScreen'
import { ShipScreen } from './ShipScreen'

const ship = (id: string, name: string, depth: string) => ({ id, name, class: 'Class', depth, decks: 17, tonnage: 100000, capacity: 3000, intro: `About ${name}.` })

beforeAll(() => {
  applyShips(normalizeShips({ version: 'v', items: [ship('sky-princess', 'Sky Princess', 'browse'), ship('sun-princess', 'Sun Princess', 'aboard')] })!)
  applyRegions(normalizeRegions({ version: 'v', items: [{ id: 'caribbean', name: 'Caribbean' }, { id: 'med', name: 'Mediterranean' }] })!)
  applyPatterns(normalizePatterns({ version: 'v', items: [] })!)
})
beforeEach(() => {
  setSailingEntries(normalizeEntries([
    { id: 'a1', ship: 'sky-princess', departure: '2027-03-01', nights: 7, title: 'Sky Caribbean', region: 'caribbean', legs: [], holiday: false, bookingOpen: false, dataStatus: 'sample', fromCents: 70_000 },
    { id: 'a2', ship: 'sun-princess', departure: '2027-04-05', nights: 10, title: 'Sun Med', region: 'med', legs: [], holiday: false, bookingOpen: false, dataStatus: 'sample' },
  ]))
})
afterEach(() => { cleanup(); setSailingEntries([]) })

const at = (path: string, ui: React.ReactNode) => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>)

describe('catalogue screens', () => {
  it('lists every sailing grouped by month and filters from the address', () => {
    const v = at('/home/sailings', <SailingsScreen />)
    expect(v.getByRole('heading', { name: 'March 2027' })).toBeTruthy()
    expect(v.getByRole('heading', { name: 'April 2027' })).toBeTruthy()
    expect(v.getByText('2 sailings')).toBeTruthy()
    v.unmount()
    const f = at('/home/sailings?region=med', <SailingsScreen />)
    expect(f.queryByText('Sky Caribbean')).toBeNull()
    expect(f.getAllByText(/Sun Med/).length).toBeGreaterThan(0)
  })
  it('lists ships and compares them', () => {
    const l = at('/home/ships', <ShipsScreen />)
    expect(l.getByText('Sky Princess')).toBeTruthy()
    l.unmount()
    const c = at('/home/ships/compare?a=sky-princess&b=sun-princess', <CompareShipsScreen />)
    expect(c.getByRole('table')).toBeTruthy()
    expect(c.getAllByRole('columnheader').length).toBe(3)
  })
  it('shows the region and month grid with links', () => {
    const v = at('/home/explore', <ExploreScreen />)
    expect(v.getByRole('table')).toBeTruthy()
    expect(v.container.querySelector('a[href="/home/sailings?region=med&month=2027-04"]')).toBeTruthy()
  })
  it('tells the truth about a ship the app has no deck plan for', () => {
    const v = render(<MemoryRouter initialEntries={['/home/ships/sky-princess']}><ShipRoute /></MemoryRouter>)
    expect(v.getByText(/deck plan and room list for Sky Princess are not in the app yet/)).toBeTruthy()
  })
})

import { Route, Routes } from 'react-router'
const ShipRoute = () => <Routes><Route path="/home/ships/:id" element={<ShipScreen />} /></Routes>
