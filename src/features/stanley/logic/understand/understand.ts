/**
 * Understanding a question with no model (docs/stanley-answers-plan.md, section 5). Pure and deterministic: the same words and the same situation always give the same result.
 * Steps: normalise, stem, correct typos, match phrases to concepts, read the frame (what they want to do, about what), score the topics, check each pill makes sense for this guest, and decide how sure to be.
 */
import type { JourneyStage } from '../../../../app/routes/hubs'
import { COMMON_WORDS, CONCEPTS, DROP_WORDS, NEVER_WORDS, STOP_WORDS, ACTS, type Act } from './lexicon'
import { DESTINATIONS, type Need } from './destinations'
import { MAX_AGE } from '../../../explorer/domain/urlFilter'
import { findEntities, type EntityKind } from './entities'
import { normalise, wordsOf } from './normalise'
import { makeSpeller, type Speller } from './spell'
import { stem } from './stem'
import { SCREEN_SPECS } from './screenSpec'
import { TOPICS, type TopicDef } from './topics'

/** Where the guest is and what they have, as far as the device knows. Hints, never facts about anyone else. */
export interface UnderstandContext {
  stage?: JourneyStage
  hasBooking?: boolean
  /** The screen id the guest is on, for a small lean towards that screen's topic. */
  screenId?: string
  /** The cruise day each port is visited, so "tours in Cozumel" can open the tours of that day. */
  portDays?: Readonly<Record<string, number>>
  /** What the last turn was about (thread.ts), so a short follow-up ("and how much?", "what about Belize?", "book it") can lean on it. */
  previous?: Previous
}

/** The last topic, what was asked of it, and the things named. `force` is set when the guest answered a clarifying question, so the topic is taken whatever else the words say. */
export interface Previous { topic: string; acts: readonly Act[]; entities: readonly Named[]; force?: boolean }

/** A thing the guest named that the app holds. */
export interface Named { id: string; kind: EntityKind; name: string; path: string }

export interface Pill { id: string; label: string; path: string }

export type Outcome = 'confident' | 'ambiguous' | 'miss' | 'empty'

export interface Understood {
  outcome: Outcome
  /** Ranked topics that scored, best first (at most three). */
  topics: { id: string; score: number }[]
  /** What they want to do, the most specific act first. */
  acts: Act[]
  /** The pills to offer, already checked against the guest's situation (at most three). */
  pills: Pill[]
  /** Whether the words say it is about the guest's own trip ("my", "our"). */
  personal: boolean
  /** The venues, tours, ports and so on the question names, best first (at most two). */
  entities: Named[]
  /** Set when the topic or the things named came from the last turn, because this question leaned on it. */
  carried: boolean
  /** When the outcome is ambiguous, the topics to choose between (two or three, best first); empty otherwise. */
  options: string[]
}

/** At most this many pills are ever offered under one reply. */
export const MAX_PILLS = 3
/** Scores (the sum of evidence, act and stage lean) that make a topic a confident, a possible or no match, and the lead the best must have over the next. */
export const T_HIGH = 4
export const T_LOW = 2.6
export const MARGIN = 1
/** A topic needs at least this much from the words themselves; a request word alone ("how much") never makes a topic. */
export const MIN_EVIDENCE = 2

const ABOARD: readonly JourneyStage[] = ['embark', 'sea', 'port', 'disembark']
const NEGATORS = new Set(['not', 'no', 'never', 'without'])
const QUESTION_WORDS = new Set(['what', 'where', 'when', 'who', 'why', 'how', 'which'])
/** Words that start a question that leans on the one before, and words that point back at it. */
const FOLLOW_ON = /^(and|also|then|or|so|what about|how about|same for|what of)\b/
const POINTERS = new Set(['it', 'its', 'there', 'that', 'this', 'one', 'them', 'those', 'these'])
/** A follow-up is short; a long question stands on its own. */
const MAX_FOLLOW_WORDS = 7
const AUX_WORDS = new Set(['can', 'could', 'do', 'does', 'did', 'is', 'are', 'will', 'would', 'should', 'may', 'am', 'was'])

interface Engine {
  phrases: Map<string, string[]>
  longest: number
  /** Typo repair on the word as typed, and on its stem. */
  surface: Speller
  speller: Speller
  mult: Map<string, number>
  topics: readonly TopicDef[]
}

let engine: Engine | null = null

const keyOf = (text: string): string => wordsOf(text).filter((w) => !DROP_WORDS.has(w)).map(stem).join(' ')

function build(): Engine {
  const phrases = new Map<string, string[]>()
  const vocabulary = new Set<string>()
  const surfaceWords = new Set<string>()
  let longest = 1
  for (const concept of CONCEPTS) {
    for (const word of concept.words) {
      const key = keyOf(word)
      if (!key) continue
      const list = phrases.get(key)
      if (!list) phrases.set(key, [concept.id])
      else if (!list.includes(concept.id)) list.push(concept.id)
      const parts = key.split(' ')
      longest = Math.max(longest, parts.length)
      for (const p of parts) vocabulary.add(p)
      for (const w of wordsOf(word)) if (!DROP_WORDS.has(w)) surfaceWords.add(w)
    }
  }
  const known = new Set<string>([...STOP_WORDS, ...COMMON_WORDS].map((w) => stem(normalise(w))))
  const never = new Set([...NEVER_WORDS].map((w) => stem(w)))
  // How many topics lean on each concept: a concept only one topic uses says more than one every topic uses.
  const df = new Map<string, number>()
  for (const t of TOPICS) for (const c of Object.keys(t.evidence)) df.set(c, (df.get(c) ?? 0) + 1)
  // Weighted over the base topics only, so adding long tail screens (screenSpec.ts) never shifts how an ordinary word is weighed.
  const n = TOPICS.length - SCREEN_SPECS.length
  const mult = new Map<string, number>()
  for (const [c, d] of df) mult.set(c, 0.8 + 0.4 * (1 - (d - 1) / Math.max(1, n - 1)))
  return { phrases, longest, surface: makeSpeller(surfaceWords, new Set([...STOP_WORDS, ...COMMON_WORDS]), NEVER_WORDS), speller: makeSpeller(vocabulary, known, never), mult, topics: TOPICS }
}

const get = (): Engine => (engine ??= build())

interface Hit { concept: string; start: number; negated: boolean }

/** The stem of a typed word, with a typo put right: as typed first (so "decied" is read as "decide"), then in stem form. */
function fix(word: string, e: Engine): string {
  const s = stem(word)
  if (e.speller.has(s)) return s
  const typed = e.surface.correct(word)
  return typed !== word ? stem(typed) : e.speller.correct(s)
}

/**
 * Words to concepts: stems, typo fixes, then every phrase the lexicon knows. A phrase is dropped only when a longer one covers it completely, so "my room key" is read as both "my room" and "room key" and neither
 * swallows the other. A "not", "no", "never" or "without" marks the next word or two as negated, unless it is itself part of a phrase ("do not want").
 */
function hitsOf(tokens: readonly string[], e: Engine): Hit[] {
  const stems = tokens.filter((w) => !DROP_WORDS.has(w)).map((w) => fix(w, e))
  type Found = { i: number; len: number; concepts: string[]; act: boolean }
  const found: Found[] = []
  for (let i = 0; i < stems.length; i++) {
    for (let len = Math.min(e.longest, stems.length - i); len >= 1; len--) {
      const concepts = e.phrases.get(stems.slice(i, i + len).join(' '))
      if (!concepts) continue
      // What a phrase means as a thing and what it means as a request are kept apart, so "book a tour" is both a tour and a booking.
      const acts = concepts.filter((c) => c.startsWith('a.'))
      const things = concepts.filter((c) => !c.startsWith('a.'))
      if (acts.length) found.push({ i, len, concepts: acts, act: true })
      if (things.length) found.push({ i, len, concepts: things, act: false })
    }
  }
  const covered = (a: Found, b: Found) => b.act === a.act && b.len > a.len && b.i <= a.i && b.i + b.len >= a.i + a.len
  const kept = found.filter((a) => !found.some((b) => b !== a && covered(a, b)))
  const negators = stems.flatMap((w, i) => (NEGATORS.has(w) && !kept.some((k) => k.len > 1 && i >= k.i && i < k.i + k.len) ? [i] : []))
  return kept.flatMap((k) => k.concepts.map((concept) => ({ concept, start: k.i, negated: negators.some((n) => k.i - n === 1) })))
}

const actOf = (id: string): Act | null => (id.startsWith('a.') ? (id.slice(2) as Act) : null)

/** Whether a destination makes sense for this guest now. */
function allowed(need: Need | undefined, ctx: UnderstandContext): boolean {
  switch (need) {
    case undefined: return true
    case 'booking': return ctx.hasBooking === true
    case 'aboard': return ctx.stage !== undefined && ABOARD.includes(ctx.stage)
    case 'ashore': return ctx.stage === 'port'
    case 'beforeSailing': return ctx.stage === undefined || !ABOARD.includes(ctx.stage)
  }
}

/** The screen offered for a destination, or the one that stands in for it, or nothing. */
function resolve(id: string, ctx: UnderstandContext, depth = 0): string | null {
  const d = DESTINATIONS[id]
  if (!d) return null
  if (allowed(d.needs, ctx)) return id
  return d.instead && depth < 3 ? resolve(d.instead, ctx, depth + 1) : null
}

/** The pills for one topic: the ones that match what was asked first, then the general ones. */
function pillsFor(topic: TopicDef, acts: readonly Act[], ctx: UnderstandContext): string[] {
  const out: string[] = []
  const push = (dest: string) => { const r = resolve(dest, ctx); if (r && !out.some((o) => DESTINATIONS[o]!.path === DESTINATIONS[r]!.path) && !out.includes(r)) out.push(r) }
  for (const r of topic.pills) if (r.when?.some((a) => acts.includes(a))) push(r.dest)
  for (const r of topic.pills) if (!r.when) push(r.dest)
  return out
}

/** Turns a destination id into the words on its pill. The UI passes the locale file; tests pass the English table. */
export type Labeller = (destination: string) => string

/** The words on the pill for a named thing: `tours` is for a port's tours of the day, `open` for its own page. */
export type EntityLabeller = (kind: EntityKind, name: string, variant: 'open' | 'tours') => string
const plainEntity: EntityLabeller = (_kind, name) => name

/** The ship's own diet marks a question may ask for ("vegan options"); gluten, allergies and the rest have no mark and get no filter. */
const DIET_WORDS: readonly (readonly [string, RegExp])[] = [['vegan', /\bvegan/], ['vegetarian', /\b(vegetarian|veggie)/], ['nas', /\b(sugar free|no added sugar|diabetic|low sugar)/]]
/** The youngest guest's age when the question names a child's age ("my 5 year old", "aged 7"). */
const AGE_WORDS = /\b(?:aged?|ages) (\d{1,2})\b|\b(\d{1,2}) ?(?:years? old|yrs? old|year olds?|yo)\b/

/** A filter the question asks for, as a pill that opens the explorer already narrowed: a diet on dining, a child's age on tours. Never for an allergy question, and never for a topic the filter does not fit. */
function qualifier(topic: string, raw: readonly string[], present: ReadonlySet<string>): { id: string; path: string } | null {
  const said = raw.join(' ')
  if ((topic === 'dining' || topic === 'dining.diet') && !present.has('n.allergy')) {
    const diet = DIET_WORDS.find(([, re]) => re.test(said))?.[0]
    if (diet) return { id: `dining.${diet}`, path: `${DESTINATIONS[`dining.${diet}`]!.path}` }
  }
  if (topic === 'excursions') {
    const m = AGE_WORDS.exec(said)
    const age = m ? Number(m[1] ?? m[2]) : NaN
    if (age >= 0 && age <= MAX_AGE) return { id: 'excursions.age', path: `/excursions-explorer?age=${age}` }
  }
  return null
}

/** Reads a question. `label` turns a destination id into the words on its pill (the locale file). */
export function understand(text: string, ctx: UnderstandContext, label: Labeller, entityLabel: EntityLabeller = plainEntity): Understood {
  const empty: Understood = { outcome: 'empty', topics: [], acts: [], pills: [], personal: false, entities: [], carried: false, options: [] }
  const raw = wordsOf(text)
  if (raw.length === 0) return empty
  const e = get()
  const personal = raw.some((w) => w === 'my' || w === 'mine' || w === 'our' || w === 'ours')
  const hits = hitsOf(raw, e)
  const matches = findEntities(text)
  const entities: Named[] = matches.map(({ entity: x }) => ({ id: x.id, kind: x.kind, name: x.name, path: x.path }))

  const present = new Set<string>()
  const actSet = new Set<Act>()
  for (const h of hits) {
    const act = actOf(h.concept)
    if (act) {
      // "I do not want to book": a refused booking or order is a cancel; any other act stays as it was.
      if (h.negated && (act === 'BOOK' || act === 'ORDER')) actSet.add('CANCEL')
      else actSet.add(act)
      present.add(h.concept)
    } else if (!h.negated) present.add(h.concept)
  }
  const acts = ACTS.filter((a) => actSet.has(a))
  const first = raw[0]!
  const fragment = raw.length <= 3 && acts.length === 0 && !QUESTION_WORDS.has(first) && !AUX_WORDS.has(first)

  const scored: { id: string; score: number; topic: TopicDef }[] = []
  for (const topic of e.topics) {
    let evidence = 0
    for (const c of present) { const w = topic.evidence[c]; if (w) evidence += w * (e.mult.get(c) ?? 1) }
    if (evidence < MIN_EVIDENCE) continue
    const bonuses = acts.map((a) => topic.acts[a]).filter((v): v is number => v !== undefined)
    let act = 0
    if (bonuses.length > 0) act = Math.max(...bonuses) > 0 ? Math.max(...bonuses) : Math.min(...bonuses)
    else if (fragment) act = topic.acts.LIST ?? 0
    const lean = ctx.stage ? topic.stages[ctx.stage] ?? 0 : 0
    scored.push({ id: topic.id, score: Math.round((evidence + act + lean) * 100) / 100, topic })
  }
  scored.sort((a, b) => b.score - a.score || (a.topic.risk === b.topic.risk ? 0 : a.topic.risk === 'low' ? -1 : 1) || (a.id < b.id ? -1 : 1))
  const prev = ctx.previous
  const prevTopic = prev ? e.topics.find((t) => t.id === prev.topic) : undefined
  const ownEntities = entities.length > 0
  const marker = FOLLOW_ON.test(raw.join(' '))
  const pointer = raw.some((w) => POINTERS.has(w))
  // The question has no topic of its own, and leans on the last one: it opens with "and", "what about", points back ("it", "there") or only asks something about the thing ("how much", "book").
  const weak = !scored[0] || scored[0].score < T_LOW
  const leans = !!prevTopic && !!prev && raw.length <= MAX_FOLLOW_WORDS && weak && (ownEntities ? marker : marker || pointer || (acts.length > 0 && raw.length <= 3))
  const carry = !!prevTopic && !!prev && (prev.force === true || leans)
  if (carry && prevTopic && prev) {
    const carriedActs = acts.length > 0 ? acts : ACTS.filter((a) => prev.acts.includes(a))
    const named: Named[] = ownEntities ? entities : [...prev.entities].slice(0, 2)
    const topicPills: Pill[] = []
    for (const dest of pillsFor(prevTopic, carriedActs, ctx)) { const d = DESTINATIONS[dest]!; if (!topicPills.some((p) => p.path === d.path)) topicPills.push({ id: dest, label: label(dest), path: d.path }) }
    const ports = new Map(matches.map((m) => [m.entity.id, m.entity.port]))
    const toursAsked = prevTopic.id === 'excursions' || prevTopic.id === 'excursions.mine'
    const pills: Pill[] = []
    for (const n of named) {
      const port = ports.get(n.id)
      const day = n.kind === 'port' && port ? ctx.portDays?.[port] : undefined
      const tours = toursAsked && day !== undefined
      pills.push({ id: `entity.${n.id}`, label: entityLabel(n.kind, n.name, tours ? 'tours' : 'open'), path: tours ? `/excursions-explorer?day=${day}` : n.path })
    }
    const out: Pill[] = []
    for (const p of [...pills, ...topicPills]) if (out.length < MAX_PILLS && !out.some((o) => o.path === p.path)) out.push(p)
    return { outcome: 'confident', topics: [{ id: prevTopic.id, score: T_HIGH }], acts: carriedActs, pills: out, personal, entities: named, carried: true, options: [] }
  }
  const top = scored[0]
  const ports = new Map(matches.map((m) => [m.entity.id, m.entity.port]))
  const toursAsked = top?.id === 'excursions' || top?.id === 'excursions.mine'
  /** One pill per thing named: a port asked about with tours goes to that day's tours, anything else to its own page. */
  const entityPills = (): Pill[] => {
    const out: Pill[] = []
    for (const n of entities) {
      const port = ports.get(n.id)
      const day = n.kind === 'port' && port ? ctx.portDays?.[port] : undefined
      const tours = toursAsked && day !== undefined
      out.push({ id: `entity.${n.id}`, label: entityLabel(n.kind, n.name, tours ? 'tours' : 'open'), path: tours ? `/excursions-explorer?day=${day}` : n.path })
    }
    return out
  }
  const withEntities = (topicPills: Pill[]): Pill[] => {
    const out: Pill[] = []
    for (const p of [...entityPills(), ...topicPills]) if (out.length < MAX_PILLS && !out.some((o) => o.path === p.path)) out.push(p)
    return out
  }
  if (!top) {
    // Nothing but a name: the thing itself is the answer.
    if (entities.length > 0) return { outcome: 'confident', topics: [], acts, pills: withEntities([]), personal, entities, carried: false, options: [] }
    return { outcome: 'miss', topics: [], acts, pills: [], personal, entities, carried: false, options: [] }
  }
  const second = scored[1]
  // A long ramble needs a stronger match than a short, direct question.
  const stretch = raw.length > 14 ? 1.25 : 1
  // Dining and special diets are one place to go: a diet the ship marks, asked for with dining words, settles it.
  const dishes = !!second && top.id.startsWith('dining') && second.id.startsWith('dining') && qualifier('dining', raw, present) !== null
  const confident = top.score >= T_HIGH * stretch && (!second || top.score - second.score >= MARGIN || dishes)
  const ranked = scored.slice(0, 3).map(({ id, score }) => ({ id, score }))
  if (!confident && top.score < T_LOW * stretch) {
    if (entities.length > 0) return { outcome: 'confident', topics: ranked, acts, pills: withEntities([]), personal, entities, carried: false, options: [] }
    return { outcome: 'miss', topics: ranked, acts, pills: [], personal, entities, carried: false, options: [] }
  }

  const topicPills: Pill[] = []
  let options: string[] = []
  const add = (dest: string) => { const d = DESTINATIONS[dest]!; if (!topicPills.some((p) => p.path === d.path)) topicPills.push({ id: dest, label: label(dest), path: d.path }) }
  if (confident) {
    const q = qualifier(top.id.startsWith('dining') ? 'dining' : top.id, raw, present)
    if (q) topicPills.push({ id: q.id, label: label(q.id), path: q.path })
    for (const dest of pillsFor(top.topic, acts, ctx)) add(dest)
  } else {
    // Not sure: one screen from each of the likeliest topics, so the guest can pick.
    const close = scored.filter((s) => s.score >= T_LOW * stretch && s.score >= top.score - MARGIN * 2).slice(0, MAX_PILLS)
    options = close.map((s) => s.id)
    for (const s of close) { const [first] = pillsFor(s.topic, acts, ctx); if (first) add(first) }
    for (const s of close) for (const dest of pillsFor(s.topic, acts, ctx)) add(dest)
  }
  // A thing the guest named settles which topic was meant, so the question is understood even when the topic alone was a toss-up.
  const sure = confident || entities.length > 0
  return { outcome: sure ? 'confident' : 'ambiguous', topics: ranked, acts, pills: withEntities(topicPills), personal, entities, carried: false, options: sure ? [] : options.length >= 2 ? options : [] }
}

/** For tests and tools: the concepts a question was read as. */
export function conceptsOf(text: string): string[] {
  const e = get()
  return [...new Set(hitsOf(wordsOf(text), e).map((h) => h.concept))]
}

/** For tests: the word a typo is read as. */
export const correctWord = (word: string): string => fix(word, get())
