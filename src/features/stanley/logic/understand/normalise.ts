/**
 * Step 1 of understanding a question (docs/stanley-answers-plan.md, 5.1): turn what a guest typed into plain lower-case words. No model, no network: the same text always gives the same words.
 * Accents go, contractions are spelled out, British spellings become American (so the lexicon is written once), text-speak is expanded and a few compounds are made one word.
 */

/** Most characters and words read from one question, so a paste cannot slow the engine down. */
export const MAX_CHARS = 2000
export const MAX_WORDS = 120

const SPELLING: Readonly<Record<string, string>> = {
  colour: 'color', colours: 'colors', favourite: 'favorite', favourites: 'favorites', centre: 'center', centres: 'centers', theatre: 'theater', theatres: 'theaters', programme: 'program', programmes: 'programs',
  organise: 'organize', organised: 'organized', jewellery: 'jewelry', grey: 'gray', cheque: 'check', licence: 'license', neighbour: 'neighbor', travelling: 'traveling', traveller: 'traveler', travellers: 'travelers',
  snorkelling: 'snorkeling', cancelled: 'canceled', cancelling: 'canceling', labelled: 'labeled', harbour: 'harbor', harbours: 'harbors', pyjamas: 'pajamas', aeroplane: 'airplane', holiday: 'vacation', holidays: 'vacations',
  mum: 'mom', mummy: 'mommy', trolley: 'cart', lift: 'elevator', lifts: 'elevators', loo: 'toilet', lorry: 'truck', biscuit: 'cookie', biscuits: 'cookies', chips: 'fries', fortnight: 'two weeks', mobile: 'phone', mobiles: 'phones', speciality: 'specialty',
}

const TEXT_SPEAK: Readonly<Record<string, string>> = {
  pls: 'please', plz: 'please', thx: 'thanks', tx: 'thanks', tix: 'tickets', u: 'you', r: 'are', ur: 'your', wat: 'what', wut: 'what', abt: 'about', b4: 'before', bc: 'because', cuz: 'because', cos: 'because',
  '2nite': 'tonight', '2night': 'tonight', tonite: 'tonight', tmrw: 'tomorrow', tmr: 'tomorrow', tomorow: 'tomorrow', tomoro: 'tomorrow', '2morrow': 'tomorrow', '2moro': 'tomorrow', rm: 'room', msg: 'message', info: 'information',
  wanna: 'want to', gonna: 'going to', gotta: 'got to', lemme: 'let me', gimme: 'give me', dunno: 'do not know', kinda: 'kind of', sorta: 'sort of', ya: 'you', yall: 'you', hrs: 'hours', hr: 'hour', mins: 'minutes', min: 'minute', ok: 'okay',
  whats: 'what is', wheres: 'where is', whens: 'when is', hows: 'how is', whos: 'who is', thats: 'that is', theres: 'there is', heres: 'here is', whered: 'where did', whatre: 'what are', whereabouts: 'where',
  cant: 'cannot', wont: 'will not', dont: 'do not', doesnt: 'does not', didnt: 'did not', isnt: 'is not', arent: 'are not', wasnt: 'was not', havent: 'have not', hasnt: 'has not', couldnt: 'could not', shouldnt: 'should not', wouldnt: 'would not',
  im: 'i am', ive: 'i have', id: 'i would', ill: 'i will', youre: 'you are', youve: 'you have', weve: 'we have', theyre: 'they are', itll: 'it will', thatll: 'that will',
}

const COMPOUNDS: readonly (readonly [RegExp, string])[] = [
  [/\bwi fi\b/g, 'wifi'], [/\bwi-fi\b/g, 'wifi'], [/\bcheck in\b/g, 'checkin'], [/\bcheck-in\b/g, 'checkin'], [/\bcheck out\b/g, 'checkout'], [/\bduty free\b/g, 'dutyfree'], [/\bmini golf\b/g, 'minigolf'],
  [/\be ticket\b/g, 'eticket'], [/\bwork out\b/g, 'workout'], [/\bsail away\b/g, 'sailaway'], [/\bturn down\b/g, 'turndown'], 
]

/** What it was typed as, folded to plain a to z, digits and spaces (times keep their colon). */
export function normalise(input: string): string {
  let s = String(input ?? '').slice(0, MAX_CHARS).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  s = s.replace(/[‘’ʼ`´]/g, "'")
  // Contractions with an apostrophe.
  s = s.replace(/\bcan't\b/g, 'cannot').replace(/\bwon't\b/g, 'will not').replace(/\bshan't\b/g, 'shall not').replace(/\bain't\b/g, 'is not')
    .replace(/n't\b/g, ' not').replace(/'re\b/g, ' are').replace(/'ve\b/g, ' have').replace(/'ll\b/g, ' will').replace(/'m\b/g, ' am').replace(/\bi'd\b/g, 'i would').replace(/'d\b/g, ' would')
    .replace(/\b(what|where|when|who|how|that|there|here|it|why)'s\b/g, '$1 is').replace(/'s\b/g, '').replace(/s'/g, 's')
  // Symbols that mean words.
  s = s.replace(/&/g, ' and ').replace(/\+/g, ' plus ').replace(/@/g, ' at ').replace(/%/g, ' percent ')
  // Hyphens join compounds ("wi-fi"), then everything that is not a letter, digit, colon between digits or dollar goes.
  for (const [re, to] of COMPOUNDS) s = s.replace(re, to)
  s = s.replace(/-/g, ' ').replace(/(?<!\d):|:(?!\d)/g, ' ').replace(/[^a-z0-9:$ ]+/g, ' ')
  const words = s.split(/\s+/).filter(Boolean).slice(0, MAX_WORDS)
  const out: string[] = []
  for (const w of words) {
    const speak = TEXT_SPEAK[w]
    const fixed = speak ?? SPELLING[w] ?? w
    out.push(...fixed.split(' '))
  }
  let joined = out.join(' ')
  for (const [re, to] of COMPOUNDS) joined = joined.replace(re, to)
  return joined.replace(/\bwi fi\b/g, 'wifi')
}

/** The words of a question, already normalised. */
export const wordsOf = (input: string): string[] => normalise(input).split(' ').filter(Boolean)
