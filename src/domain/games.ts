/** Games on board (ENT-05): a scavenger hunt around the ship, trivia, a bingo card and the achievements they earn. Questions and clues are authored concept content. */
export interface Clue { id: string; clue: string; placeId: string }

export const HUNT: readonly Clue[] = [
  { id: 'h-pool', clue: 'Find the place where the movies play under the stars.', placeId: 'lido-pool' },
  { id: 'h-spa', clue: 'Find the spa and look for the quietest room on Deck 6.', placeId: 'lotus' },
  { id: 'h-piazza', clue: 'Stand in the middle of the Piazza and look up. How many levels can you see?', placeId: 'piazza' },
  { id: 'h-guest', clue: 'Find the desk that answers every question.', placeId: 'guest-services' },
  { id: 'h-fitness', clue: 'Find the highest deck with a running track.', placeId: 'fitness' },
  { id: 'h-shops', clue: 'Find the shop where the tote bags are.', placeId: 'shops' },
]

export interface Question { id: string; text: string; options: readonly string[]; answer: number }

export const TRIVIA: readonly Question[] = [
  { id: 'q-ports', text: 'Which of our ports is reached by tender?', options: ['Cozumel', 'Belize City', 'Roatán'], answer: 1 },
  { id: 'q-clock', text: 'What happens to the ship’s clocks on the night before Belize?', options: ['They go back an hour', 'They go forward an hour', 'Nothing'], answer: 0 },
  { id: 'q-decks', text: 'The Piazza spans how many decks?', options: ['One', 'Three', 'Five'], answer: 1 },
  { id: 'q-muster', text: 'When must everyone attend the muster drill?', options: ['Before the ship sails', 'On the second sea day', 'Only if asked'], answer: 0 },
  { id: 'q-allaboard', text: 'What does “all aboard” mean?', options: ['The last moment you may board', 'Dinner is served', 'The captain is speaking'], answer: 0 },
  { id: 'q-sun', text: 'Which helps most against sunburn on a port day?', options: ['Cloud cover', 'Sunscreen reapplied every two hours', 'A dark shirt'], answer: 1 },
]

export interface GameState {
  found: string[]
  /** Question id to the option chosen. */
  answers: Record<string, number>
  /** Numbers marked on the bingo card. */
  marked: number[]
}

export const EMPTY_GAME: GameState = { found: [], answers: {}, marked: [] }

export function normalizeGame(raw: unknown): GameState {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const found = Array.isArray(o.found) ? o.found.filter((x): x is string => typeof x === 'string' && HUNT.some((c) => c.id === x)) : []
  const answers: Record<string, number> = {}
  if (o.answers && typeof o.answers === 'object') {
    for (const q of TRIVIA) {
      const a = (o.answers as Record<string, unknown>)[q.id]
      if (typeof a === 'number' && Number.isInteger(a) && a >= 0 && a < q.options.length) answers[q.id] = a
    }
  }
  const marked = Array.isArray(o.marked) ? o.marked.filter((x): x is number => Number.isInteger(x) && x >= 1 && x <= 75) : []
  return { found: [...new Set(found)], answers, marked: [...new Set(marked)] }
}

const hash = (text: string): number => {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return h
}

/** A 5 by 5 card, row by row: B 1 to 15, I 16 to 30, N 31 to 45, G 46 to 60, O 61 to 75, with a free space (0) in the middle. The same card for the same seed. */
export function bingoCard(seed: string): number[][] {
  const columns = [0, 1, 2, 3, 4].map((c) => {
    const pool = Array.from({ length: 15 }, (_, i) => c * 15 + i + 1)
    const picked: number[] = []
    let h = hash(`${seed}|${c}`)
    while (picked.length < 5) {
      const at = h % pool.length
      picked.push(pool.splice(at, 1)[0])
      h = hash(`${h}|${c}`)
    }
    return picked
  })
  const rows = [0, 1, 2, 3, 4].map((r) => columns.map((col) => col[r]))
  rows[2][2] = 0
  return rows
}

/** The numbers called so far today: one more every five minutes of the hour, in an order that is the same for everyone. */
export function calledNumbers(day: number, minutesIntoGame: number): number[] {
  const order = Array.from({ length: 75 }, (_, i) => i + 1).sort((a, b) => hash(`${day}|${a}`) - hash(`${day}|${b}`))
  return order.slice(0, Math.max(0, Math.min(75, 1 + Math.floor(minutesIntoGame / 2))))
}

/** Complete lines on a card: rows, columns and the two diagonals, counting the free space. */
export function bingoLines(card: readonly (readonly number[])[], marked: readonly number[]): number {
  const on = (r: number, c: number) => card[r][c] === 0 || marked.includes(card[r][c])
  const idx = [0, 1, 2, 3, 4]
  let lines = 0
  for (const a of idx) {
    if (idx.every((b) => on(a, b))) lines++
    if (idx.every((b) => on(b, a))) lines++
  }
  if (idx.every((a) => on(a, a))) lines++
  if (idx.every((a) => on(a, 4 - a))) lines++
  return lines
}

export const triviaScore = (state: GameState): { right: number; answered: number } => ({
  right: TRIVIA.filter((q) => state.answers[q.id] === q.answer).length,
  answered: Object.keys(state.answers).length,
})

export type AchievementId = 'start' | 'explorer' | 'quiz' | 'bingo'
export const ACHIEVEMENTS: readonly AchievementId[] = ['start', 'explorer', 'quiz', 'bingo']

export function achievements(state: GameState, card: readonly (readonly number[])[]): AchievementId[] {
  const out: AchievementId[] = []
  if (state.found.length > 0 || state.marked.length > 0 || Object.keys(state.answers).length > 0) out.push('start')
  if (state.found.length === HUNT.length) out.push('explorer')
  if (triviaScore(state).right >= TRIVIA.length - 1) out.push('quiz')
  if (bingoLines(card, state.marked) > 0) out.push('bingo')
  return out
}
