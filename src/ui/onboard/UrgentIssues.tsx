import { EMERGENCY_NUMBER, GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { t, type StringKey } from '../../i18n'

const ISSUES = ['key', 'locked', 'child', 'documents'] as const

/** Urgent problems that are not medical, each with the phone number to use (SUP-08). Plain text and phone links, so it works with no signal and never depends on chat. */
export function UrgentIssues({ headingId }: { headingId: string }) {
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>{t('help.urgent.title')}</h3>
      <dl className="plain-dl">
        {ISSUES.map((i) => {
          const number = i === 'child' ? EMERGENCY_NUMBER : GUEST_SERVICES_NUMBER
          return (
            <div key={i}>
              <dt>{t(`help.urgent.${i}` as StringKey)}</dt>
              <dd>{t(`help.urgent.${i}.do` as StringKey)} <a href={`tel:${number}`}>{number}</a></dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
