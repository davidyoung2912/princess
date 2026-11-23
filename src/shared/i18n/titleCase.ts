/** Short words kept lower case inside a heading (articles, conjunctions and short prepositions). */
const SMALL = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'as', 'at', 'by', 'in', 'of', 'off', 'on', 'per', 'to', 'up', 'via', 'vs'])

const upFirst = (word: string) => word.replace(/\p{L}/u, (c) => c.toUpperCase())

/**
 * Title Case for a heading: each word starts with a capital except short joining words ("of", "the", "and"),
 * which stay lower case unless first, last or straight after a colon or dash. Only the first letter of a word changes,
 * so "WiFi" and "USD" stay as written. Used for English only; other languages have their own heading rules.
 */
export function titleCase(text: string, language = 'en'): string {
  if (language !== 'en') return text
  const parts = text.split(/(\s+)/)
  const wordIdx = parts.map((p, i) => (i % 2 === 0 && p ? i : -1)).filter((i) => i >= 0)
  const last = wordIdx[wordIdx.length - 1]
  let afterBreak = true
  return parts
    .map((part, i) => {
      if (i % 2 === 1 || !part) return part
      const bare = part.toLowerCase().replace(/[^\p{L}]/gu, '')
      const keepSmall = !afterBreak && i !== last && SMALL.has(bare)
      afterBreak = /[:–—-]$/.test(part)
      if (keepSmall || /^\{/.test(part)) return part
      return part.split(/(-)/).map(upFirst).join('')
    })
    .join('')
}
