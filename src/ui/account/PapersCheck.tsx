import { useState } from 'react'
import { Link } from 'react-router'
import type { GuestDocumentsView } from '../../api/types'
import { isWithParents, papersCheck, WITH_PARENTS, type WithParents } from '../../domain/papersCheck'
import { formatDate } from '../../domain/cruise'
import { passportValidUntil } from '../../domain/documents'
import { t, type StringKey } from '../../i18n'
import { Field } from '../Field'
import { StatusBadge } from '../StatusBadge'

/** Document sanity checks for one guest (S3-02). The passport name is typed here and compared on the device; it is not sent or stored. */
export function PapersCheck({ guest, returnDate }: { guest: GuestDocumentsView; returnDate: string }) {
  const [passportName, setPassportName] = useState('')
  const [withParents, setWithParents] = useState<WithParents>('both')
  const checks = papersCheck({ bookedName: guest.name, passportName, age: guest.age, citizenship: guest.citizenship, held: guest.held, returnDate, withParents })
  const id = `pc-${guest.id}`
  return (
    <section aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`}>{t('papers.title')}</h3>
      <p className="muted">{t('papers.intro')}</p>
      <Field label={t('papers.passportName', { name: guest.name })} hint={t('papers.passportHint')} value={passportName} autoComplete="off" onChange={(e) => setPassportName(e.target.value)} />
      {guest.age < 18 && (
        <div className="field">
          <label htmlFor={`${id}-with`}>{t('papers.with')}</label>
          <select id={`${id}-with`} className="field__input" value={withParents} onChange={(e) => { if (isWithParents(e.target.value)) setWithParents(e.target.value) }}>
            {WITH_PARENTS.map((w) => <option key={w} value={w}>{t(`papers.with.${w}` as StringKey)}</option>)}
          </select>
        </div>
      )}
      <ul className="plain-list" aria-live="polite">
        {checks.map((c) => (
          <li key={c.id}>
            <span>
              {t(`papers.${c.id}` as StringKey, { until: formatDate(passportValidUntil(returnDate)), date: formatDate(returnDate) })}
              {c.link && <><br /><Link to={c.link}>{t('papers.fixPath')}</Link></>}
            </span>
            <StatusBadge kind={c.level === 'ok' ? 'booked' : c.level === 'fix' ? 'changed' : 'ready'} label={t(`papers.level.${c.level}` as StringKey)} />
          </li>
        ))}
      </ul>
    </section>
  )
}
