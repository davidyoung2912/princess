import { isApiError } from '../../api/errors'
import type { StringKey } from '../../i18n'

/** The words for a card that could not be sent: the thing is no longer on the trip, the note was not acceptable, or the chat has closed. */
export function shareError(e: unknown): StringKey {
  if (!isApiError(e)) return 'conv.share.failed'
  if (e.message === 'shareRef' || e.message === 'place') return 'conv.share.stale'
  if (e.message === 'blocked') return 'conv.blocked'
  if (e.message === 'contactInfo') return 'conv.contact'
  if (e.code === 'conflict') return 'conv.closed'
  return 'conv.share.failed'
}
