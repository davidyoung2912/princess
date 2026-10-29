/**
 * The English text for the app. Keys are `screen.thing`; `{name}` marks a value filled in by the caller, and a key
 * ending `_one`/`_other` is a plural pair chosen by the `count` value. Every key must be used (see i18n.test.ts).
 */
export const en = {
  'app.name': 'Princess',
  'app.conceptNotice': 'Unofficial concept. Not affiliated with Princess Cruises.',

  'error.title': 'Something went wrong',
  'error.body': 'The app hit an unexpected problem. Reloading usually fixes it, and anything you saved is kept.',
  'error.stale': 'A newer version of the app is available. Reloading will bring it in, and anything you saved is kept.',
  'error.reload': 'Reload',
  'error.tryAgain': 'Try again',
  'error.help': 'If this keeps happening, tell Guest Services.',

  'foundations.title': 'Foundations preview',
  'foundations.intro': 'This page is only for checking the design language during setup. The real screens arrive in later steps.',
  'foundations.sample.heading': 'Sun Princess, 7-night Western Caribbean',
  'foundations.sample.body': 'Sail round trip from Fort Lauderdale to Cozumel, Belize City and Roatán. This is sample text for judging size, spacing and contrast.',
  'foundations.sample.numbers': 'Boarding 12:30 pm · Deck 9 · Cabin 9142',

  'settings.title': 'Display settings',
  'settings.textSize': 'Text size',
  'settings.textSize.standard': 'Standard',
  'settings.textSize.large': 'Large',
  'settings.textSize.xlarge': 'Extra large',
  'settings.theme': 'Colour theme',
  'settings.theme.auto': 'Match my device',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Evening',
  'settings.contrast': 'Contrast',
  'settings.contrast.standard': 'Standard',
  'settings.contrast.high': 'High',
  'settings.reduceMotion': 'Reduce motion',
  'settings.reduceMotionHint': 'Stops animation. Your device setting is always respected too.',

  'palette.title': 'Colour tokens',
  'palette.primary': 'Primary',
  'palette.surfaceWarm': 'Warm surface',
  'palette.surfaceInfo': 'Information surface',
  'palette.success': 'Success',
  'palette.warning': 'Warning',
  'palette.danger': 'Danger',
  'palette.gold': 'Gold (decoration)',
} as const

export type StringKey = Exclude<keyof typeof en, `${string}_one` | `${string}_other`> | PluralBase<keyof typeof en>

type PluralBase<K> = K extends `${infer B}_one` | `${infer B}_other` ? B : never
