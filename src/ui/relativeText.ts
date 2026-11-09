import { t } from '../i18n'
import type { Relative } from '../domain/homeLook'

/** "In 25 min", "In 3 hours": the words for a time still ahead. */
export function relativeText(r: Relative): string {
  switch (r.unit) {
    case 'now': return t('time.in.now')
    case 'min': return t('time.in.min', { count: r.count })
    case 'hour': return t('time.in.hour', { count: r.count })
    case 'day': return t('time.in.day', { count: r.count })
  }
}
