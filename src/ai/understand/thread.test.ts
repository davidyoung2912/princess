import { describe, expect, it } from 'vitest'
import { EMPTY_THREAD, MAX_LEANS, THREAD_MINUTES, choiceOf, previousOf, remember, type Thread } from './thread'
import { DIRECTORY } from '../../domain/menus'
import { composeReply, missPills, readQuestion } from './index'

const T0 = 1_000_000
const stage = 'sea' as const
const where = { stage, hasBooking: true }

/** Plays a conversation: each question is read against what the earlier ones left, as the hook does. */
function converse(questions: string[], gap = 1000) {
  let thread: Thread = EMPTY_THREAD
  let now = T0
  const out = []
  for (const q of questions) {
    const u = readQuestion(q, { ...where, previous: previousOf(thread, now, stage) })
    thread = remember(thread, u, now, stage)
    out.push({ u, thread })
    now += gap
  }
  return out
}

describe('carry-over', () => {
  it('"and how much?" leans on the last topic', () => {
    const [first, second] = converse(['where can I book a massage', 'and how much?'])
    expect(first!.u.carried).toBe(false)
    expect(second!.u.carried).toBe(true)
    expect(second!.u.topics[0]!.id).toBe(first!.u.topics[0]!.id)
    expect(second!.u.acts).toContain('PRICE')
  })
  it('"what about {name}?" keeps the topic and changes the thing named', () => {
    const [one, two] = DIRECTORY.filter((v) => v.name.length > 6)
    const [first, second] = converse([`what time does ${one!.name} open`, `what about ${two!.name}?`])
    expect(second!.u.carried || second!.u.entities.length > 0).toBe(true)
    expect(second!.u.entities.map((e) => e.id)).toContain(`venue:${two!.id}`)
    expect(second!.u.entities.map((e) => e.id)).not.toContain(`venue:${one!.id}`)
    if (second!.u.carried) expect(second!.u.topics[0]!.id).toBe(first!.u.topics[0]!.id)
  })
  it('a name alone with no "what about" is not a follow-up', () => {
    const v = DIRECTORY[0]!
    const [, second] = converse(['where can I book a massage', v.name])
    expect(second!.u.carried).toBe(false)
  })
  it('"is it open" points back at the thing named', () => {
    const v = DIRECTORY[0]!
    const [, second] = converse([`where is ${v.name}`, 'is it open now?'])
    expect(second!.u.carried).toBe(true)
    expect(second!.u.entities.map((e) => e.id)).toEqual([`venue:${v.id}`])
  })
  it('a question with its own topic is never carried', () => {
    const [, second] = converse(['where can I book a massage', 'how do I connect to the wifi'])
    expect(second!.u.carried).toBe(false)
    expect(second!.u.topics[0]!.id).not.toBe(converse(['where can I book a massage'])[0]!.u.topics[0]!.id)
  })
  it('a long question stands on its own', () => {
    const [, second] = converse(['where can I book a massage', 'and I was wondering whether somebody could possibly tell me something about the thing that happened earlier'])
    expect(second!.u.carried).toBe(false)
  })
  it('stops after two follow-ups', () => {
    const [, a, b, c] = converse(['where can I book a massage', 'and how much?', 'and when?', 'and how much?'])
    expect(a!.u.carried && b!.u.carried).toBe(true)
    expect(c!.u.carried).toBe(false)
    expect(MAX_LEANS).toBe(2)
  })
  it('is forgotten after ten minutes and in another stage', () => {
    const [, second] = converse(['where can I book a massage', 'and how much?'], (THREAD_MINUTES * 60_000) + 1)
    expect(second!.u.carried).toBe(false)
    const [first] = converse(['where can I book a massage'])
    expect(previousOf(first!.thread, T0 + 1, 'port')).toBeUndefined()
    expect(previousOf(first!.thread, T0 + 1, stage)).toBeDefined()
  })
  it('a miss does not lose the thread', () => {
    const [, miss, third] = converse(['where can I book a massage', 'asdfgh qwerty zxcv bnm lkj hgf dsa', 'and how much?'])
    expect(miss!.u.carried).toBe(false)
    expect(third!.u.carried).toBe(true)
  })
})

describe('clarification', () => {
  it('an ambiguous question names its options, in the order of its pills', () => {
    const q = 'massage and dinner'
    const u = readQuestion(q, where)
    expect(u.outcome).toBe('ambiguous')
    expect(u.options).toEqual(['spa', 'dining'])
    const c = composeReply(u, { kind: 'offtopic', existing: [] }, { text: q, stage })
    expect(c.text).toMatch(/^Do you mean .+, or .+\?$/)
    expect(c.actions.length).toBeGreaterThanOrEqual(2)
    // Answering "the first one" opens the first option, remembered from the turn before.
    const [turn] = converse([q])
    expect(turn!.thread.options).toEqual(['spa', 'dining'])
    expect(choiceOf('the first one', turn!.thread, T0 + 1, stage)).toEqual({ pick: 'spa' })
  })
  it('reads "the first one", "second", "2", "yes" and "no" against the options', () => {
    const t: Thread = { ...EMPTY_THREAD, options: ['dining', 'order', 'spa'], at: T0, stage }
    expect(choiceOf('the first one', t, T0 + 1, stage)).toEqual({ pick: 'dining' })
    expect(choiceOf('yes', t, T0 + 1, stage)).toEqual({ pick: 'dining' })
    expect(choiceOf('Second please', t, T0 + 1, stage)).toEqual({ pick: 'order' })
    expect(choiceOf('3', t, T0 + 1, stage)).toEqual({ pick: 'spa' })
    expect(choiceOf('no', t, T0 + 1, stage)).toEqual({ declined: true })
  })
  it('anything else is a new question, and nothing waiting means nothing to choose', () => {
    const t: Thread = { ...EMPTY_THREAD, options: ['dining', 'order'], at: T0, stage }
    expect(choiceOf('where is the spa', t, T0 + 1, stage)).toBeNull()
    expect(choiceOf('fourth', t, T0 + 1, stage)).toBeNull()
    expect(choiceOf('yes', EMPTY_THREAD, T0, stage)).toBeNull()
    expect(choiceOf('yes', t, T0 + THREAD_MINUTES * 60_000 + 1, stage)).toBeNull()
  })
  it('choosing an option reads as that topic', () => {
    const u = readQuestion('the first one', { ...where, previous: { topic: 'spa', acts: [], entities: [], force: true } })
    expect(u.carried).toBe(true)
    expect(u.topics[0]!.id).toBe('spa')
    expect(u.pills.length).toBeGreaterThan(0)
  })
})

describe('the honest miss', () => {
  it('offers search with the guest words, browse by stage, and a person', () => {
    const pills = missPills({ text: 'purple   giraffe tango', stage: 'sea' })
    expect(pills.map((p) => p.id)).toEqual(['search', 'browse', 'contact'])
    expect(pills[0]!.path).toBe('/ship/search?q=purple%20giraffe%20tango')
    expect(pills[0]!.label).toContain('purple giraffe tango')
    expect(pills[1]!.path).toBe('/')
    expect(pills[2]!.path).toBe('/me/contact')
  })
  it('shortens long words on the label and the link, and with no words searches plainly', () => {
    const long = 'x'.repeat(200)
    const [s] = missPills({ text: long })
    expect(s!.label.length).toBeLessThan(80)
    expect(decodeURIComponent(s!.path.split('q=')[1]!).length).toBe(80)
    expect(missPills({ text: '  ' })[0]!.path).toBe('/ship/search')
    expect(missPills({ text: 'x' })[1]!.path).toBe('/')
  })
  it('a miss replaces a server no-answer with one sentence and the three pills', () => {
    const c = composeReply(readQuestion('asdfgh', where), { kind: 'unavailable', existing: [] }, { text: 'asdfgh', stage })
    expect(c.replaced).toBe(true)
    expect(c.actions.map((a) => a.id)).toEqual(['search', 'browse', 'contact'])
  })
})
