import { useState } from 'react'
import { readCustom } from '../data/customReminders'
import { dismiss, readDismissed } from '../data/reminders'
import { dueCustom, dueReminders, undismissed } from '../domain/localReminders'
import { useMine } from '../hooks/useMine'
import { useNow } from '../hooks/useDemo'
import { useOnboardToday } from '../hooks/useOnboardToday'
import { t, type StringKey } from '../i18n'
import { api } from '../runtime'
import { Banner } from './Banner'
import { Button } from './Button'

/** Reminders that are due now, shown while the app is open or the next time it opens (MOB-23). Says plainly that it is not a background alert. */
export function LocalReminders() {
  const trips = useMine(() => api.trips.list())
  const today = useOnboardToday()
  const now = useNow()
  const [dismissed, setDismissed] = useState(readDismissed)
  const trip = trips.data?.upcoming.find((x) => x.kind === 'current') ?? trips.data?.upcoming[0] ?? null
  const allAboardAt = today.data?.portDay?.state.at ?? null
  const due = undismissed([...dueReminders({ trip, allAboardAt }, now), ...dueCustom(readCustom(), now)], dismissed)
  if (due.length === 0) return null
  return (
    <section aria-label={t('reminders.label')} className="local-reminders">
      {due.map((r) => (
        <Banner key={r.key} kind={r.urgent ? 'warning' : 'info'} title={r.kind === 'custom' ? r.text ?? t('reminders.custom') : t(`reminders.${r.kind}` as StringKey, { count: r.amount })} action={<Button variant="secondary" onClick={() => setDismissed(dismiss(r.key))}>{t('reminders.dismiss')}</Button>}>
          <p>{t('reminders.note')}</p>
        </Banner>
      ))}
    </section>
  )
}
