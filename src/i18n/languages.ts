/** The languages the app offers, each named in itself so a guest can find theirs. English is the source; the others are loaded when chosen (N5.5). */
export const LANGUAGES: readonly { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
]

export const isLanguage = (v: unknown): v is string => typeof v === 'string' && LANGUAGES.some((l) => l.code === v)
