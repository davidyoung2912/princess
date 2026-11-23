export const CODE_LENGTH = 6

/** Only the digits of what was typed or pasted, at most six. */
export const digitsOnly = (s: string): string => s.replace(/\D/g, '').slice(0, CODE_LENGTH)
