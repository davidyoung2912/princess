import { describe, expect, it } from 'vitest'
import { DIRECTORY } from './menus'
import {
  addDiaryEntry, addThanks, addWish, dressTonight, EMPTY_SEA, FAVOURITES_MAX, favouritesTonight, isFavourite, normalizeSea, onTonight, wishesFor, occasionOn, orderAgain, parkSpot, spotDue,
  spotMinutesLeft, spotPlaces, thanksText, toggleFavourite,
} from './seaDelights'

describe('dressTonight', () => {
  it('is elegant on formal nights, casual on the first and last, smart between', () => {
    expect(dressTonight(2, 7)).toBe('elegant')
    expect(dressTonight(7, 7)).toBe('elegant')
    expect(dressTonight(1, 7)).toBe('casual')
    expect(dressTonight(8, 7)).toBe('casual')
    expect(dressTonight(4, 7)).toBe('smart')
  })
  it('has no elegant night on a short cruise', () => {
    expect(dressTonight(2, 3)).toBe('smart')
  })
})

describe('favourites', () => {
  it('toggles and caps', () => {
    const a = toggleFavourite([], 'soleil', 'Shrimp cocktail')
    expect(isFavourite(a, 'soleil', 'Shrimp cocktail')).toBe(true)
    expect(toggleFavourite(a, 'soleil', 'Shrimp cocktail')).toEqual([])
    const full = Array.from({ length: FAVOURITES_MAX }, (_, i) => ({ venueId: 'x', dish: `d${i}` }))
    expect(toggleFavourite(full, 'y', 'new')).toHaveLength(FAVOURITES_MAX)
  })
  it('matches hearted dishes to rooms open for dinner', () => {
    const favs = [{ venueId: 'soleil', dish: 'Shrimp cocktail' }, { venueId: 'lido', dish: 'Fish tacos' }, { venueId: 'gone', dish: 'x' }]
    const hits = favouritesTonight(favs, DIRECTORY, 'sea')
    expect(hits.map((h) => h.venue.id)).toEqual(['soleil'])
  })
  it('rotates dining-room dishes by night and keeps counters fixed', () => {
    const nights = [1, 2, 3, 4, 5, 6, 7, 8].map((d) => onTonight('soleil', 'Shrimp cocktail', d))
    expect(nights).toContain(true)
    expect(nights).toContain(false)
    expect(nights).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((d) => onTonight('soleil', 'Shrimp cocktail', d)))
    expect([1, 2, 3, 4, 5, 6, 7, 8].every((d) => onTonight('eatery', 'Pad thai', d))).toBe(true)
    expect(onTonight('soleil', 'Shrimp cocktail', 0)).toBe(true)
  })
  it('hides a hearted dish on the night it is not served', () => {
    const favs = [{ venueId: 'soleil', dish: 'Shrimp cocktail' }]
    const off = [1, 2, 3, 4, 5, 6, 7, 8].filter((d) => !onTonight('soleil', 'Shrimp cocktail', d))[0]
    expect(favouritesTonight(favs, DIRECTORY, 'sea', off)).toEqual([])
  })
})

describe('drink diary', () => {
  const e = (id: string, name: string, verdict: 'liked' | 'ok' | 'notAgain') => ({ id, name, verdict, note: '', day: 2 })
  it('ignores empty names and duplicate ids', () => {
    expect(addDiaryEntry([], e('1', '  ', 'liked'))).toEqual([])
    expect(addDiaryEntry(addDiaryEntry([], e('1', 'Mojito', 'liked')), e('1', 'Mojito', 'liked'))).toHaveLength(1)
  })
  it('lists liked drinks once, newest first', () => {
    const list = [e('1', 'Mojito', 'liked'), e('2', 'Lager', 'ok'), e('3', 'mojito', 'notAgain'), e('4', 'Spritz', 'liked')]
    expect(orderAgain(list).map((x) => x.name)).toEqual(['Spritz'])
    expect(orderAgain([e('1', 'Mojito', 'liked'), e('2', 'Spritz', 'liked')]).map((x) => x.name)).toEqual(['Spritz', 'Mojito'])
  })
})

describe('park my spot', () => {
  it('counts down and falls due', () => {
    const spot = parkSpot('promenade', ' by the rail ', 0, 45)!
    expect(spot.note).toBe('by the rail')
    expect(spotMinutesLeft(spot, 10 * 60_000)).toBe(35)
    expect(spotDue(spot, 44 * 60_000)).toBe(false)
    expect(spotDue(spot, 46 * 60_000)).toBe(true)
  })
  it('refuses an unknown place and snaps odd minutes', () => {
    expect(parkSpot('nowhere', '', 0)).toBeNull()
    expect(parkSpot('promenade', '', 0, 7)!.minutes).toBe(45)
    expect(spotPlaces().length).toBeGreaterThan(0)
  })
})

describe('thanks', () => {
  it('names the team, or the person and the team', () => {
    expect(thanksText('Soleil Dining Room', '', '')).toBe('Thank you to the Soleil Dining Room team.')
    expect(thanksText('bar', 'Ana', 'The mojito was perfect.')).toBe('Thank you, Ana, and the bar team. The mojito was perfect.')
  })
  it('keeps nothing empty and caps the list', () => {
    expect(addThanks([], { id: '1', to: 'x', text: ' ', at: 0 })).toEqual([])
    expect(addThanks([], { id: '1', to: 'x', text: 'ok', at: 0 })).toHaveLength(1)
  })
})

describe('celebration day', () => {
  const o = { id: 'o1', label: 'Mum’s 70th', date: '2020-03-14', surprise: false }
  it('finds an occasion by month and day', () => {
    expect(occasionOn([o], '2027-03-14')).toEqual(o)
    expect(occasionOn([o], '2027-03-15')).toBeNull()
  })
  it('adds messages up to six and ignores empty ones', () => {
    let w = addWish({}, 'o1', '  ')
    expect(w).toEqual({})
    for (let i = 0; i < 8; i++) w = addWish(w, 'o1', `wish ${i}`)
    expect(w.o1).toHaveLength(6)
  })
})

describe('wishesFor', () => {
  it('keeps one celebration, oldest first', () => {
    const w = (id: string, celebrationId: string, at: number) => ({ id, celebrationId, author: 'A', text: id, at, mine: false })
    expect(wishesFor([w('b', 'o1', 2), w('x', 'o2', 1), w('a', 'o1', 1)], 'o1').map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('normalizeSea', () => {
  it('survives junk', () => {
    expect(normalizeSea(null)).toEqual(EMPTY_SEA)
    expect(normalizeSea({ favourites: 3, diary: [{}], spot: { placeId: 'nowhere', at: 1 }, thanks: 'x', wishes: [] })).toEqual(EMPTY_SEA)
  })
  it('round-trips good data', () => {
    const s = { favourites: [{ venueId: 'soleil', dish: 'Shrimp cocktail' }], diary: [{ id: '1', name: 'Mojito', verdict: 'liked' as const, note: 'less sweet', day: 3 }], spot: parkSpot('promenade', 'rail', 5, 30), thanks: [{ id: 't', to: 'bar', text: 'Thanks', at: 2 }], wishes: { o1: ['Love you'] } }
    expect(normalizeSea(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })
})
