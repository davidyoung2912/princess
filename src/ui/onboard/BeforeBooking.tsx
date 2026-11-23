import { useSyncExternalStore } from 'react'
import { isSeen, markSeen, seenVersion, subscribeSeen } from '../../settings/stanleySeen'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'

const KEY = 'hint:chatBeforeBooking'

/** The note that chat with a travel party opens once a booking is confirmed. Got it dismisses it, on this device, for good. */
export function BeforeBookingNote() {
  useSyncExternalStore(subscribeSeen, seenVersion, seenVersion)
  if (isSeen(KEY)) return null
  return (
    <Card info>
      <p>{t('chat.beforeBooking')}</p>
      <div className="before-booking__actions"><Button variant="secondary" className="tip__got" onClick={() => markSeen(KEY)}>{t('tip.gotIt')}</Button></div>
    </Card>
  )
}
