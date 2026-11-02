import { useState } from 'react'
import { addMedicalLine, MEDICAL_LINE_MAX, MEDICAL_LINES_MAX, MEDICAL_SECTIONS, medicalIsEmpty, medicalText, removeMedicalLine, EMPTY_MEDICAL, type MedicalSection } from '../../domain/medicalCard'
import { useMemory } from '../../hooks/useMemory'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { Printer, Share } from '../icons'
import { BackLink } from '../onboard/common'

/** Medical readiness card (S3-05): written by the guest, kept on this device, printed or copied to show a ship doctor. Nothing is sent to the ship. */
export function MedicalScreen() {
  const { state, me, update } = useMemory()
  const [drafts, setDrafts] = useState<Partial<Record<MedicalSection, string>>>({})
  const [note, setNote] = useState('')
  const card = state.medical
  const heading = (s: MedicalSection) => t(`medical.section.${s}` as StringKey)
  const add = (s: MedicalSection) => {
    update((m) => ({ ...m, medical: addMedicalLine(m.medical, s, drafts[s] ?? '') }))
    setDrafts((d) => ({ ...d, [s]: '' }))
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(medicalText(t('route.medical'), me?.name ?? '', card, heading, t('medical.none')))
      setNote(t('medical.copied'))
    } catch {
      setNote(t('medical.copyFailed'))
    }
  }
  return (
    <div className="page page--print">
      <BackLink to="/plan" label={t('route.plan')} />
      <h1>{t('route.medical')}</h1>
      <p className="no-print">{t('medical.intro')}</p>
      <div className="button-row no-print">
        <Button variant="secondary" onClick={() => window.print()}><Printer aria-hidden="true" /> {t('medical.print')}</Button>
        <Button variant="secondary" onClick={() => void copy()}><Share aria-hidden="true" /> {t('medical.copy')}</Button>
        <Button variant="tertiary" disabled={medicalIsEmpty(card)} onClick={() => { update((m) => ({ ...m, medical: EMPTY_MEDICAL })); setNote(t('medical.cleared')) }}>{t('medical.clear')}</Button>
      </div>
      <p className="muted no-print" role="status">{note}</p>
      <div className="print-sheet">
        <h2>{me?.name ?? t('route.medical')}</h2>
        {MEDICAL_SECTIONS.map((s) => (
          <section key={s} aria-labelledby={`med-${s}`}>
            <h3 id={`med-${s}`}>{heading(s)}</h3>
            {card[s].length === 0 ? <p>{t('medical.none')}</p> : (
              <ul>
                {card[s].map((line, i) => (
                  <li key={line}>{line} <Button variant="tertiary" className="no-print" onClick={() => update((m) => ({ ...m, medical: removeMedicalLine(m.medical, s, i) }))}>{t('medical.remove')}<span className="visually-hidden"> {line}</span></Button></li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <p className="print-sheet__foot">{t('medical.foot')}</p>
      </div>
      <div className="no-print">
        {MEDICAL_SECTIONS.map((s) => (
          <Card key={s} labelledBy={`med-add-${s}`}>
            <h2 id={`med-add-${s}`} className="card__title">{heading(s)}</h2>
            {card[s].length < MEDICAL_LINES_MAX ? (
              <form onSubmit={(e) => { e.preventDefault(); add(s) }}>
                <Field label={t(`medical.add.${s}` as StringKey)} hint={t(`medical.hint.${s}` as StringKey)} value={drafts[s] ?? ''} maxLength={MEDICAL_LINE_MAX} onChange={(e) => setDrafts((d) => ({ ...d, [s]: e.target.value }))} />
                <Button type="submit" variant="secondary" disabled={(drafts[s] ?? '').trim() === ''}>{t('medical.addButton')}</Button>
              </form>
            ) : <p className="muted">{t('medical.full')}</p>}
          </Card>
        ))}
        <p className="muted">{t('medical.note')}</p>
      </div>
    </div>
  )
}
