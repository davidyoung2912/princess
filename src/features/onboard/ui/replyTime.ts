import { t } from '../../../shared/i18n'

/** A usual reply time in words: "under a minute", "about 4 min", "about 2 hours". */
export const replyTime = (seconds: number): string =>
  seconds < 60 ? t('conv.stat.replyUnder') : seconds < 3600 ? t('conv.stat.replyMin', { count: Math.round(seconds / 60) }) : t('conv.stat.replyHr', { count: Math.max(1, Math.round(seconds / 3600)) })
