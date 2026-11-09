import { useState } from 'react'
import { normalizeBookingFlags, type BookingFlag } from '../../ai/stanleyDiscover'
import { t } from '../../i18n'
import { stanleyDiscover } from '../../runtime'
import { Button } from '../Button'

/** Codes the name check beside the field already covers, so they are not said twice. */
const COVERED = new Set(['digits', 'title', 'case', 'short'])

/**
 * Stanley's hints about a name or date of birth that may be a slip (phase 8, STN-BOK-02). Asked for on request, never on every keystroke. Hints only: the booking checks stay the authority, nothing here blocks
 * the guest, and the server stores nothing it is sent.
 */
export function StanleyBookingHints({ first, last, dob, departure }: { first: string; last: string; dob: string; departure: string | undefined }) {
  const [flags, setFlags] = useState<BookingFlag[] | null>(null)
  const [failed, setFailed] = useState(false)
  const ready = dob !== '' || (first.trim() !== '' && last.trim() !== '')
  const ask = () => {
    setFailed(false)
    stanleyDiscover.bookingCheck({ firstName: first.trim(), lastName: last.trim(), birthDate: dob, departure: departure ?? '' }).then(
      (raw) => setFlags(normalizeBookingFlags(raw).filter((f) => !COVERED.has(f.code))),
      () => setFailed(true),
    )
  }
  return (
    <div className="field__hint">
      <Button variant="tertiary" onClick={ask} disabled={!ready}>{t('find8.booking.ask')}</Button>
      <div role="status">
        {failed && <p>{t('find8.failed')}</p>}
        {flags !== null && flags.length === 0 && <p>{t('find8.booking.none')}</p>}
        {flags !== null && flags.length > 0 && (
          <>
            <ul>{flags.map((f) => <li key={f.field + f.code}>{f.text}</li>)}</ul>
            <p>{t('find8.booking.hint')}</p>
          </>
        )}
      </div>
    </div>
  )
}
