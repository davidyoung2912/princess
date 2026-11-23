import { useId } from 'react'
import { Link } from 'react-router'
import { type BriefKind } from '../../stanley/logic/stanleyBrief'
import { useStanleyBrief } from '../../../shared/hooks/useStanleyBrief'
import { t, th } from '../../../shared/i18n'
import { Button } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'
import { Field } from '../../../shared/ui/Field'

const clock = (ms: number | null) => (ms === null ? '' : new Date(ms).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }))

/**
 * The morning brief and the evening look-ahead (phase P7): off until the guest chooses a time, sent once a day at that ship-clock time, never inside their quiet hours. The preview shows exactly what
 * would be sent now and sends nothing.
 */
export function StanleyBriefCard() {
  const { state, preview, failed, saveFailed, busy, save, show } = useStanleyBrief()
  const id = useId()
  const one = (kind: BriefKind) => {
    const s = state!.settings
    const on = kind === 'morning' ? s.morning : s.evening
    const at = kind === 'morning' ? s.morningAt : s.eveningAt
    const next = kind === 'morning' ? state!.nextMorning : state!.nextEvening
    return (
      <div className="stack" key={kind}>
        <label>
          <input type="checkbox" checked={on} disabled={busy} onChange={(e) => { void save(kind === 'morning' ? { morning: e.target.checked } : { evening: e.target.checked }) }} />
          {' '}{t(`stanleyBrief.${kind}`)}
        </label>
        <Field label={t(`stanleyBrief.${kind}At`)} type="time" value={at} disabled={busy}
          onChange={(e) => { if (e.target.value) void save(kind === 'morning' ? { morningAt: e.target.value } : { eveningAt: e.target.value }) }} />
        {on && next !== null && <p className="muted">{t('stanleyBrief.next', { when: clock(next) })}</p>}
        <Button variant="secondary" onClick={() => { void show(kind) }}>{t(`stanleyBrief.preview.${kind}`)}</Button>
      </div>
    )
  }
  return (
    <Card labelledBy={`${id}-h`}>
      <h2 id={`${id}-h`} className="card__title">{th('stanleyBrief.title')}</h2>
      <p>{t('stanleyBrief.intro')}</p>
      {failed && <p role="alert" className="field__error">{t('stanleyBrief.error')}</p>}
      {state && !state.allowed && !state.settings.morning && !state.settings.evening && <p>{t('stanleyBrief.off')}</p>}
      {state && one('morning')}
      {state && one('evening')}
      <div aria-live="polite">
        {saveFailed && <p role="alert" className="field__error">{t('stanleyBrief.saveError')}</p>}
        {preview === 'none' && <p role="status">{t('stanleyBrief.previewNone')}</p>}
        {preview && preview !== 'none' && (
          <section aria-labelledby={`${id}-p`}>
            <h3 id={`${id}-p`}>{preview.title}</h3>
            <ul>{preview.lines.map((l) => <li key={l.text}>{l.route ? <Link to={l.route}>{l.text}</Link> : l.text}</li>)}</ul>
          </section>
        )}
      </div>
    </Card>
  )
}
