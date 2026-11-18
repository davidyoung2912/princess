import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DIRECTORY } from '../../domain/menus'
import { EXCURSIONS } from '../../domain/excursions'
import { searchOffers } from '../../domain/explorer/excursionDay'
import { PORTS } from '../../domain/sailings'
import { askBefore } from '../../domain/chatStanley'
import { readUrlFilter } from '../../domain/explorer/urlFilter'
import { routeForPath } from '../../routes/nav'
import { entityIndex, findEntities } from './entities'
import { portDays } from './portDays'
import { readQuestion, composeReply } from './index'
import { understand } from './understand'

const label = (d: string) => d

beforeAll(() => { PORTS['zzcoz'] = { id: 'zzcoz', name: 'Cozumel', zone: 'America/Cancun', tender: false } as (typeof PORTS)[string] })
afterAll(() => { delete PORTS['zzcoz'] })

describe('entities', () => {
  it('every entity opens a real page', () => {
    for (const e of entityIndex().entities) expect(routeForPath(e.path.split('?')[0]!), `${e.id} ${e.path}`).toBeTruthy()
  })
  it('finds a venue by its full name, by one distinctive word and with a typo', () => {
    const v = DIRECTORY[0]!
    expect(findEntities(`where is ${v.name}`)[0]?.entity.id).toBe(`venue:${v.id}`)
    const words = v.name.split(' ').filter((w) => w.length >= 5)
    if (words[0]) expect(findEntities(`when does ${words[0].slice(0, -1)}${words[0].slice(-1)} open`).map((m) => m.entity.id)).toContain(`venue:${v.id}`)
  })
  it('finds a port, and reads a slip in its name', () => {
    expect(findEntities('any tours in cozumel')[0]?.entity.id).toBe('port:zzcoz')
    expect(findEntities('tours in cozumle')[0]?.entity.id).toBe('port:zzcoz')
  })
  it('finds a tour by name', () => {
    const x = EXCURSIONS[0]!
    expect(findEntities(`tell me about ${x.name}`).map((m) => m.entity.id)).toContain(`tour:${x.id}`)
  })
  it('does not turn ordinary words into places', () => {
    for (const q of ['where can i get dinner', 'what is for lunch', 'i want a drink', 'the']) expect(findEntities(q), q).toEqual([])
  })
  it('returns at most two', () => {
    expect(findEntities(DIRECTORY.map((v) => v.name).join(' ')).length).toBeLessThanOrEqual(2)
  })
})

describe('entity pills', () => {
  it('"tours in cozumel" opens that port day\'s tours, named', () => {
    const u = understand('any tours in cozumel', { portDays: { zzcoz: 4 } }, label, (k, n, v) => `${v}:${k}:${n}`)
    expect(u.pills[0]).toMatchObject({ path: '/excursions-explorer?day=4', label: 'tours:port:Cozumel' })
    expect(u.entities[0]?.name).toBe('Cozumel')
  })
  it('without a known day a port opens its own page', () => {
    const u = understand('any tours in cozumel', {}, label)
    expect(u.pills[0]?.path).toBe('/home/ports/zzcoz')
  })
  it('a name alone is understood and answered with the thing itself', () => {
    const v = DIRECTORY[0]!
    const u = readQuestion(v.name, {})
    expect(u.outcome).toBe('confident')
    const c = composeReply(u, { kind: 'offtopic', existing: [] })
    expect(c.replaced).toBe(true)
    expect(c.actions[0]?.path).toBe(`/ship/venues/${v.id}`)
    expect(c.text).toContain(v.name)
  })
  it('never more than three pills', () => {
    expect(readQuestion('tours in cozumel and the spa', { portDays: { zzcoz: 2 } }).pills.length).toBeLessThanOrEqual(3)
  })
})

describe('port days', () => {
  it('keeps the first visit', () => { expect(portDays([{ day: 1, port: 'a' }, { day: 2, port: 'b' }, { day: 5, port: 'a' }])).toEqual({ a: 1, b: 2 }) })
})

describe('group answers', () => {
  const msg = (text: string, o: object = {}) => ({ text, ...o }) as Parameters<typeof askBefore>[0][number]
  it('finds the question behind a Stanley answer', () => {
    const list = [msg('hi'), msg('@Stanley where can I book a massage?'), msg('lol'), msg('Try the spa.', { stanley: true })]
    expect(askBefore(list, 3)).toBe('where can I book a massage?')
  })
  it('gives nothing for a person, a notice or a question too far back', () => {
    const far = [msg('@Stanley spa'), ...Array.from({ length: 6 }, () => msg('x')), msg('answer', { stanley: true })]
    expect(askBefore(far, far.length - 1)).toBeNull()
    expect(askBefore([msg('@Stanley spa'), msg('hello')], 1)).toBeNull()
    expect(askBefore([msg('@Stanley spa'), msg('n', { stanley: true, notice: {} })], 1)).toBeNull()
    expect(askBefore([msg('@Stanley'), msg('a', { stanley: true })], 1)).toBeNull()
  })
})

describe('address filters', () => {
  it('reads and bounds q and type', () => {
    expect(readUrlFilter(new URLSearchParams('q=%20vegetarian%20%20food&type=bar'))).toEqual({ q: 'vegetarian food', type: 'bar', diet: null, age: null })
    expect(readUrlFilter(new URLSearchParams('')).type).toBeNull()
    expect(readUrlFilter(new URLSearchParams(`q=${'a'.repeat(500)}`)).q.length).toBe(60)
  })
})

describe('tour search', () => {
  it('keeps offers holding every word, and all with no words', () => {
    const x = EXCURSIONS[0]!
    const offers = [{ item: x }] as unknown as Parameters<typeof searchOffers>[0]
    expect(searchOffers(offers, '')).toHaveLength(1)
    expect(searchOffers(offers, x.name.split(' ')[0]!)).toHaveLength(1)
    expect(searchOffers(offers, 'zzzqqq')).toHaveLength(0)
  })
})
