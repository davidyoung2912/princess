/** The optional chat nickname (mirrors the server): 2 to 30 letters, digits, spaces and . _ - ', or empty to use the username. */
export const MIN_NICKNAME = 2
export const MAX_NICKNAME = 30

/** The text tidied (outer spaces gone, inner runs made one). */
export const tidyNickname = (s: string): string => s.split(' ').filter(Boolean).join(' ')

/** Whether the text can be saved: empty (clears it) or a fit nickname. The server also refuses blocked words. */
export function nicknameFits(s: string): boolean {
  const n = tidyNickname(s)
  return n === '' || (n.length >= MIN_NICKNAME && n.length <= MAX_NICKNAME && /^[\p{L}\p{N} ._'-]+$/u.test(n))
}
