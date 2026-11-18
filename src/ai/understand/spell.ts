/**
 * Step 2 (plan 5.2): typo tolerance without a model. Words are compared as stems. A word the engine does not know is looked up among the words it does know with a symmetric-delete index (fast, no scan),
 * and replaced only when exactly one known word is close enough. Guards: short words are never touched, the first letter must agree (or the first two be swapped), a tie leaves the word alone, and a
 * word that the safety words own is never produced from a typo.
 */

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const adjacent = new Map<string, Set<string>>()
ROWS.forEach((row, r) => [...row].forEach((ch, c) => {
  const set = new Set<string>()
  for (const [dr, dc] of [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, -1], [1, 0]] as const) { const k = ROWS[r + dr]?.[c + dc]; if (k) set.add(k) }
  adjacent.set(ch, set)
}))
const SOUND_ALIKE = ['cs', 'ck', 'sz', 'gj', 'dt', 'bp', 'fv', 'mn', 'iy', 'ey']

/** What it costs to read one letter as another: a slip of the finger (a neighbouring key) or a spelling that sounds the same costs 1; anything else costs 2, so it is never taken for a typo of a short word. */
const VOWELS = 'aeiou'
const substitution = (x: string, y: string): number =>
  x === y ? 0 : adjacent.get(x)?.has(y) || (VOWELS.includes(x) && VOWELS.includes(y)) || SOUND_ALIKE.some((p) => (p[0] === x && p[1] === y) || (p[0] === y && p[1] === x)) ? 1 : 2

/** Optimal string alignment distance (insert or delete 1, substitute by `substitution`, swap two neighbours 1), giving up above `max`. */
export function distance(a: string, b: string, max = 2): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev2: number[] = []
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row: number[] = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = substitution(a[i - 1]!, b[j - 1]!)
      let v = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1)
      row.push(v)
      if (v < best) best = v
    }
    if (best > max) return max + 1
    prev2.length = 0
    prev2.push(...prev)
    prev = row
  }
  return prev[b.length]!
}

/** Longest word that may be corrected by one edit, and the length from which two edits are allowed. */
const ONE_EDIT_FROM = 4
const TWO_EDITS_FROM = 8

const deletes = (word: string, depth: number): Set<string> => {
  const out = new Set<string>([word])
  let layer = [word]
  for (let d = 0; d < depth; d++) {
    const next: string[] = []
    for (const w of layer) for (let i = 0; i < w.length; i++) { const x = w.slice(0, i) + w.slice(i + 1); if (!out.has(x)) { out.add(x); next.push(x) } }
    layer = next
  }
  return out
}

export interface Speller {
  /** The word itself when it is known, short, a number or has no single clear fix; otherwise the one close known word. */
  correct: (word: string) => string
  has: (word: string) => boolean
}

/** `vocabulary`: every word the engine can use (stemmed). `known`: ordinary words that are never touched. `never`: words a typo may not be turned into. */
export function makeSpeller(vocabulary: Iterable<string>, known: ReadonlySet<string>, never: ReadonlySet<string> = new Set()): Speller {
  const vocab = new Set<string>()
  const index = new Map<string, string[]>()
  for (const w of vocabulary) {
    if (vocab.has(w)) continue
    vocab.add(w)
    if (w.length < ONE_EDIT_FROM || never.has(w)) continue
    for (const d of deletes(w, w.length >= TWO_EDITS_FROM ? 2 : 1)) { const list = index.get(d); if (list) list.push(w); else index.set(d, [w]) }
  }
  const has = (w: string): boolean => vocab.has(w) || known.has(w)
  const correct = (word: string): string => {
    if (word.length < ONE_EDIT_FROM || /\d/.test(word) || has(word)) return word
    // A doubled letter that should be single ("dogg", "spaa") is the commonest slip of all.
    for (let i = 0; i + 1 < word.length; i++) if (word[i] === word[i + 1]) { const one = word.slice(0, i) + word.slice(i + 1); if (vocab.has(one)) return one }
    const max = word.length >= TWO_EDITS_FROM ? 2 : 1
    const found = new Set<string>()
    for (const d of deletes(word, max)) for (const c of index.get(d) ?? []) found.add(c)
    let best = max + 1
    let pick: string[] = []
    for (const c of found) {
      if (c[0] !== word[0] && !(c[0] === word[1] && c[1] === word[0])) continue
      const dist = distance(word, c, max)
      if (dist < best) { best = dist; pick = [c] } else if (dist === best) pick.push(c)
    }
    return best <= max && pick.length === 1 ? pick[0]! : word
  }
  return { correct, has }
}
