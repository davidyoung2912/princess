import { search, type Skill } from './search'
import type { Rng } from './cards'

/**
 * Nine Men's Morris: three squares joined by lines, 24 points. Each side places nine men, then slides them along the lines; three in a line (a mill) lets you remove an enemy man
 * that is not in a mill (unless all are). A side down to three men may fly to any empty point. You lose with two men left or with no move.
 */
export const POINTS = 24
export type Man = 0 | 1 | 2
/** Points are numbered 0 to 7 round the outer square, 8 to 15 the middle one and 16 to 23 the inner one, each clockwise from its top left corner. */
export const ADJ: number[][] = Array.from({ length: POINTS }, (_, i) => {
  const ring = Math.floor(i / 8), j = i % 8
  const out = [ring * 8 + ((j + 1) % 8), ring * 8 + ((j + 7) % 8)]
  if (j % 2 === 1) { if (ring > 0) out.push(i - 8); if (ring < 2) out.push(i + 8) }
  return out
})
export const MILLS: number[][] = [
  ...[0, 1, 2].flatMap((r) => [[0, 1, 2], [2, 3, 4], [4, 5, 6], [6, 7, 0]].map((m) => m.map((x) => r * 8 + x))),
  ...[1, 3, 5, 7].map((j) => [j, 8 + j, 16 + j]),
]
/** Where each point sits on a 7 by 7 grid, for drawing. */
export const XY: [number, number][] = Array.from({ length: POINTS }, (_, i) => {
  const k = Math.floor(i / 8), a = k, b = 6 - k, m = 3
  return ([[a, a], [m, a], [b, a], [b, m], [b, b], [m, b], [a, b], [a, m]] as [number, number][])[i % 8]
})

export interface Morris {
  board: Man[]
  turn: 1 | 2
  toPlace: [number, number]
  /** The side that just made a mill must now remove a man. */
  removing: boolean
  last: number | null
  winner: 0 | 1 | 2
}
export const start = (): Morris => ({ board: Array<Man>(POINTS).fill(0), turn: 1, toPlace: [9, 9], removing: false, last: null, winner: 0 })

export type Move = { kind: 'place'; to: number } | { kind: 'move'; from: number; to: number } | { kind: 'remove'; at: number }

export const onBoard = (g: Morris, p: 1 | 2): number => g.board.filter((x) => x === p).length
export const total = (g: Morris, p: 1 | 2): number => onBoard(g, p) + g.toPlace[p - 1]
export const inMill = (board: readonly Man[], i: number): boolean => MILLS.some((m) => m.includes(i) && m.every((k) => board[k] === board[i]))
const formsMill = (board: readonly Man[], i: number): boolean => inMill(board, i)
export const canFly = (g: Morris, p: 1 | 2): boolean => g.toPlace[p - 1] === 0 && onBoard(g, p) === 3

export function legalMoves(g: Morris): Move[] {
  if (g.winner) return []
  const p = g.turn
  if (g.removing) {
    const enemy = g.board.flatMap((x, i) => (x === 3 - p ? [i] : []))
    const free = enemy.filter((i) => !inMill(g.board, i))
    return (free.length ? free : enemy).map((at) => ({ kind: 'remove', at }))
  }
  const empties = g.board.flatMap((x, i) => (x === 0 ? [i] : []))
  if (g.toPlace[p - 1] > 0) return empties.map((to) => ({ kind: 'place', to }))
  const out: Move[] = []
  const flying = canFly(g, p)
  g.board.forEach((x, from) => {
    if (x !== p) return
    for (const to of flying ? empties : ADJ[from].filter((k) => g.board[k] === 0)) out.push({ kind: 'move', from, to })
  })
  return out
}

export function apply(g: Morris, m: Move): Morris {
  const p = g.turn
  const board = g.board.slice()
  if (m.kind === 'remove') {
    board[m.at] = 0
    const next: Morris = { ...g, board, removing: false, turn: (3 - p) as 1 | 2, last: m.at }
    return judge(next, p)
  }
  const toPlace: [number, number] = [g.toPlace[0], g.toPlace[1]]
  if (m.kind === 'place') { board[m.to] = p; toPlace[p - 1]--; } else { board[m.from] = 0; board[m.to] = p }
  if (formsMill(board, m.to)) return { ...g, board, toPlace, removing: true, last: m.to }
  return judge({ ...g, board, toPlace, removing: false, turn: (3 - p) as 1 | 2, last: m.to }, p)
}

/** After a turn passes to the other side: the mover wins if that side is down to two men or has no move. */
function judge(g: Morris, mover: 1 | 2): Morris {
  const them = (3 - mover) as 1 | 2
  if (g.toPlace[them - 1] === 0 && total(g, them) < 3) return { ...g, winner: mover }
  if (legalMoves(g).length === 0) return { ...g, winner: mover }
  return g
}

/** The points a tapped man could go to (for showing the player where it can move). */
export const destinations = (g: Morris, from: number): number[] => legalMoves(g).flatMap((m) => (m.kind === 'move' && m.from === from ? [m.to] : []))

function value(g: Morris): number {
  if (g.winner) return g.winner === 1 ? 100000 : -100000
  let v = (total(g, 1) - total(g, 2)) * 40
  for (const m of MILLS) {
    const a = m.map((k) => g.board[k])
    const c1 = a.filter((x) => x === 1).length, c2 = a.filter((x) => x === 2).length
    if (c1 === 3) v += 10
    else if (c2 === 3) v -= 10
    else if (c1 === 2 && c2 === 0) v += 8
    else if (c2 === 2 && c1 === 0) v -= 8
  }
  const mob = (p: 1 | 2) => g.board.reduce<number>((n, x, i) => n + (x === p ? ADJ[i].filter((k) => g.board[k] === 0).length : 0), 0)
  v += (mob(1) - mob(2)) * 2
  if (g.removing) v += g.turn === 1 ? 25 : -25
  return v
}

const ctx = { moves: legalMoves, apply, player: (g: Morris): 0 | 1 => (g.turn === 1 ? 0 : 1), over: (g: Morris) => g.winner !== 0, value }

/** The computer's move (one step: placing, sliding, or removing). Cadet looks one step ahead and sometimes plays loosely, Captain three, Admiral five. */
export function chooseMove(g: Morris, skill: Skill, rng: Rng = Math.random): Move | null {
  const moves = legalMoves(g)
  if (moves.length === 0) return null
  if (skill === 'cadet' && rng() < 0.3) return moves[Math.floor(rng() * moves.length)]
  const depth = skill === 'cadet' ? 2 : skill === 'captain' ? 4 : 6
  return search(g, depth, ctx, { rng, limit: skill === 'admiral' ? 60000 : 20000 })
}
