import { describe, expect, it } from 'vitest'
import { BASE_DESTINATION_NAMES, DESTINATIONS } from './destinations'
import { SCREEN_SPECS } from './screenSpec'
import { CONCEPTS } from './lexicon'
import { normalise } from './normalise'
import { CORPUS } from './corpus/topics'
import { composeReply, hintOf, pillLabel, readQuestion, topicName } from './index'
import { correctWord, understand } from './understand'
import { stem } from './stem'
import { distance } from './spell'
import { TOPICS } from './topics'
import { hasText } from '../../i18n'
import { routeForPath } from '../../routes/nav'
import { mentionsAI } from '../../domain/stanleyThread'
import { t } from '../../i18n'

const id = (d: string) => d

describe('normalise', () => {
  it('folds accents, case, contractions, spellings and text-speak', () => {
    expect(normalise("What's the WiFi pls?")).toBe('what is the wifi please')
    expect(normalise("Can't find the Wi-Fi")).toBe('cannot find the wifi')
    expect(normalise('Où est le café')).toBe('ou est le cafe')
    expect(normalise('favourite theatre programme')).toBe('favorite theater program')
    expect(normalise('2nite tmrw')).toBe('tonight tomorrow')
    expect(normalise('I don’t know')).toBe('i do not know')
  })
  it('is idempotent and bounded', () => {
    const once = normalise("Where's the spa? I'd like a massage 2nite!!")
    expect(normalise(once)).toBe(once)
    expect(normalise('word '.repeat(10000)).split(' ').length).toBeLessThanOrEqual(120)
  })
})

describe('stem', () => {
  it('meets inflections at one stem', () => {
    for (const g of [['book', 'booked', 'booking', 'books'], ['dance', 'dancing', 'dances', 'danced'], ['movie', 'movies'], ['activity', 'activities'], ['swim', 'swimming'], ['dish', 'dishes']]) expect(new Set(g.map(stem)).size, g.join()).toBe(1)
  })
  it('leaves short words and keeps shows apart from show', () => {
    expect(stem('spa')).toBe('spa')
    expect(stem('shows')).not.toBe(stem('show'))
  })
})

describe('typo repair', () => {
  it('measures slips of the finger as one edit and unrelated letters as two', () => {
    expect(distance('resturant', 'restaurant')).toBe(1)
    expect(distance('teh', 'the')).toBe(1)
    expect(distance('speed', 'spent')).toBeGreaterThan(1)
  })
  it('repairs a word with one clear fix', () => {
    expect(correctWord('resturant')).toBe(stem('restaurant'))
    expect(correctWord('massge')).toBe(stem('massage'))
    expect(correctWord('dogg')).toBe('dog')
  })
  it('leaves ordinary words alone', () => {
    for (const w of ['speed', 'light', 'tokyo', 'football', 'weekend', 'happy', 'sunshine', 'bitcoin', 'camera', 'dolphin']) expect(correctWord(w), w).toBe(stem(w))
  })
})

describe('the data', () => {
  it('sends every pill to a real screen', () => {
    for (const [name, d] of Object.entries(DESTINATIONS)) {
      expect(routeForPath(d.path.split('?')[0]!), `${name} ${d.path}`).not.toBeNull()
      if (d.instead) expect(DESTINATIONS[d.instead], `${name} instead ${d.instead}`).toBeDefined()
    }
  })
  it('has words for every pill, topic and sentence, and none say "AI"', () => {
    for (const name of Object.keys(DESTINATIONS)) { expect(pillLabel(name).startsWith('understand.'), name).toBe(false); expect(mentionsAI(pillLabel(name))).toBe(false) }
    for (const tp of TOPICS) { expect(topicName(tp.id).length, tp.id).toBeGreaterThan(0); expect(topicName(tp.id).startsWith('understand.'), tp.id).toBe(false) }
    for (const a of ['BOOK', 'CHANGE', 'CANCEL', 'FIND', 'WHEN', 'PRICE', 'PROBLEM', 'LOST', 'ALLOWED', 'REQUIRE', 'ORDER', 'REMIND', 'COMPARE', 'default']) expect(hasText(`understand.say.${a}`), a).toBe(true)
  })
  it('gives every long tail destination a name of its own, one that no base destination uses', () => {
    const seen = new Map<string, string>()
    for (const x of SCREEN_SPECS) for (const d of x.dests.split(' ')) {
      const [name, id] = d.split('=')
      expect(BASE_DESTINATION_NAMES.has(name!), `${name} is already a base destination`).toBe(false)
      expect(seen.get(name!) ?? id, `${name} names two screens`).toBe(id)
      seen.set(name!, id!)
    }
  })
  it('uses only concepts that exist, and every concept is used', () => {
    const known = new Set(CONCEPTS.map((c) => c.id))
    const used = new Set<string>()
    for (const tp of TOPICS) for (const c of Object.keys(tp.evidence)) { expect(known.has(c), `${tp.id} ${c}`).toBe(true); used.add(c) }
    const neutral = new Set(['n.onboard'])
    for (const c of CONCEPTS) if (c.id.startsWith('n.') && !neutral.has(c.id)) expect(used.has(c.id), c.id).toBe(true)
  })
  it('points every topic pill at a destination and gives every topic corpus questions', () => {
    for (const tp of TOPICS) {
      expect(tp.pills.length, tp.id).toBeGreaterThan(0)
      for (const p of tp.pills) expect(DESTINATIONS[p.dest], `${tp.id} ${p.dest}`).toBeDefined()
      expect(CORPUS[tp.id]?.say.split('|').length ?? 0, `${tp.id} corpus`).toBeGreaterThanOrEqual(8)
    }
    expect(new Set(TOPICS.map((x) => x.id)).size).toBe(TOPICS.length)
  })
})

describe('pills fit the guest', () => {
  const ask = (q: string, ctx: Parameters<typeof understand>[1]) => understand(q, ctx, id).pills.map((p) => p.id)
  it('offers booking pills only to a guest with a booking, and a stand-in otherwise', () => {
    expect(ask('where can I book a massage', { stage: 'sea', hasBooking: true })).toContain('spa.book')
    const without = ask('where can I book a massage', { stage: 'discover', hasBooking: false })
    expect(without).not.toContain('spa.book')
    expect(without).toContain('spa')
  })
  it('offers aboard-only screens only aboard', () => {
    expect(ask('can I order room service', { stage: 'discover', hasBooking: false })).not.toContain('order')
    expect(ask('can I order room service', { stage: 'sea', hasBooking: true })).toContain('order')
  })
  it('leans on the stage without being ruled by it', () => {
    expect(understand('which cabin should I book', { stage: 'discover' }, id).topics[0]?.id).toBe('cabinchoose')
  })
})

describe('what the guest sees', () => {
  const facts = (over: Partial<Parameters<typeof composeReply>[1]>): Parameters<typeof composeReply>[1] => ({ kind: 'answer', source: 'trip', existing: [], ...over })
  const spa = readQuestion('where can I book a massage', { stage: 'sea', hasBooking: true })
  it('adds pills under an answer and keeps its own first', () => {
    const own = [{ label: 'Show me', path: '/own' }]
    const c = composeReply(readQuestion('where can I book a massage', { stage: 'sea', hasBooking: true }), facts({ existing: own }))
    expect(c.replaced).toBe(false)
    expect(c.actions[0]).toEqual({ label: 'Show me', path: '/own' })
    expect(c.actions.length).toBeLessThanOrEqual(3)
  })
  it('adds nothing to a safety reply', () => {
    for (const kind of ['handoff', 'blocked'] as const) expect(composeReply(readQuestion('where can I book a massage', { stage: 'sea' }), facts({ kind })).actions).toEqual([])
  })
  it('takes the place of a reply that was no answer, in words of its own', () => {
    const c = composeReply(readQuestion('where can I book a massage', { stage: 'sea', hasBooking: true }), facts({ kind: 'offtopic' }))
    expect(c.replaced).toBe(true)
    expect(c.text).toContain('book')
    expect(c.actions.length).toBeGreaterThan(0)
  })
  it('says so honestly when it cannot tell', () => {
    const c = composeReply(readQuestion('asdfgh', {}), facts({ kind: 'unavailable' }))
    expect(c.replaced).toBe(true)
    expect(c.text).toBe(t('understand.miss'))
    expect(c.actions.map((a) => a.path)).toEqual(['/ship/search', '/', '/me/contact'])
  })
  it('leaves a canned server answer in place only when it is not canned', () => {
    expect(composeReply(spa, facts({ scripted: true })).replaced).toBe(true)
    expect(composeReply(spa, facts({ scripted: false })).replaced).toBe(false)
  })
  it('hints the server only for a confident pointer question', () => {
    expect(hintOf(readQuestion('where can I book a massage', { stage: 'sea', hasBooking: true }))).toMatchObject({ confident: true, pointer: true })
    expect(hintOf(readQuestion('asdfgh', {}))).toBeUndefined()
    expect(hintOf(readQuestion('what is my massage booking', { stage: 'sea', hasBooking: true }))?.pointer ?? false).toBe(false)
  })
  it('does not replace what the device answered itself', () => {
    expect(composeReply(spa, facts({ source: 'library' })).replaced).toBe(false)
  })
})
