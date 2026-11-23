/**
 * Step 3 (plan 5.3): a small, deterministic stemmer. It is not Porter: it strips the plural, -ing, -ed and the final e, turns a final y into i, and has a table for the irregular words that matter. The lexicon
 * and the typed words go through the same function, so authors write ordinary words and "bookings", "booked" and "booking" all meet at "book".
 */

const IRREGULAR: Readonly<Record<string, string>> = {
  ate: 'eat', eaten: 'eat', went: 'go', goes: 'go', paid: 'pay', bought: 'buy', swam: 'swim', drank: 'drink', drunk: 'drink', slept: 'sleep', lost: 'lose', found: 'find', got: 'get', gotten: 'get',
  brought: 'bring', took: 'take', taken: 'take', saw: 'see', seen: 'see', did: 'do', done: 'do', does: 'do', had: 'have', has: 'have', was: 'be', were: 'be', been: 'be', am: 'be', is: 'be', are: 'be', said: 'say',
  told: 'tell', gave: 'give', given: 'give', made: 'make', met: 'meet', ran: 'run', sat: 'sit', stood: 'stand', wore: 'wear', worn: 'wear', children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth', wives: 'wife',
  better: 'good', best: 'good', cheaper: 'cheap', cheapest: 'cheap', bigger: 'big', biggest: 'big', larger: 'large', largest: 'large', later: 'late', earlier: 'early', nicer: 'nice', closer: 'close',
}

/** Words the suffix rules must never touch. */
const KEEP = new Set(['shows', 'evening', 'morning', 'during', 'nothing', 'something', 'anything', 'everything', 'king', 'ring', 'bring', 'spring', 'string', 'thing', 'things', 'sing', 'wing', 'swing', 'sling', 'ceiling', 'building', 'wedding', 'bed', 'red', 'its', 'this', 'his', 'bus', 'gas', 'pass', 'class', 'glass', 'dress', 'press', 'access', 'princess', 'across', 'miss', 'kiss', 'cross', 'always', 'perhaps', 'yes', 'us', 'plus', 'is', 'as', 'was', 'does', 'has', 'canvas', 'bonus', 'status', 'focus', 'campus', 'virus', 'chorus', 'circus', 'famous', 'previous', 'serious', 'various', 'delicious', 'nervous', 'jealous', 'fabulous', 'generous', 'tennis', 'iris', 'series', 'species', 'news', 'physics', 'mathematics', 'ethics', 'athletics', 'billiards', 'darts', 'cards', 'lessons', 'ties'])

const isVowel = (c: string | undefined): boolean => c !== undefined && 'aeiou'.includes(c)
const hasVowel = (s: string): boolean => /[aeiouy]/.test(s)

function undouble(s: string): string {
  const n = s.length
  return n >= 3 && s[n - 1] === s[n - 2] && !'aeiouslz'.includes(s[n - 1]!) ? s.slice(0, -1) : s
}

/** The stem of one lower-case word. Words of three letters or fewer are left as they are. */
export function stem(word: string): string {
  const w = word
  if (w.length <= 3 || /\d/.test(w)) return w
  const irregular = IRREGULAR[w]
  if (irregular) return fold(irregular)
  if (KEEP.has(w)) return w
  let s = w
  if (s.endsWith('ies') && s.length > 4) s = s.slice(0, -3) + 'i'
  else if (s.endsWith('ied') && s.length > 4) s = s.slice(0, -3) + 'i'
  else if (/(ss|us|is)$/.test(s)) { /* glass, bus, tennis: leave */ }
  else if (/(sses|shes|ches|xes|zes)$/.test(s)) s = s.slice(0, -2)
  else if (s.endsWith('s') && !s.endsWith('ss') && s.length > 3) s = s.slice(0, -1)
  if (s.endsWith('ing') && s.length > 5 && hasVowel(s.slice(0, -3))) s = undouble(s.slice(0, -3))
  else if (s.endsWith('ed') && s.length > 4 && hasVowel(s.slice(0, -2)) && !s.endsWith('eed')) s = undouble(s.slice(0, -2))
  return fold(s)
}

/** The final e and y fold so that "dance" and "dancing", "movie" and "movies", "activity" and "activities" meet. */
function fold(word: string): string {
  let s = word
  if (s.length > 3 && s.endsWith('e')) s = s.slice(0, -1)
  if (s.length > 2 && s.endsWith('y') && !isVowel(s[s.length - 2])) s = s.slice(0, -1) + 'i'
  return s
}
