const FILES = import.meta.glob('../../assets/art/flags/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

/** The flag picture for a lower-case two-letter country code, or undefined when there is none (the flag is then simply left out). */
export const flagUrl = (code: string): string | undefined => FILES[`../../assets/art/flags/${code}.png`]
