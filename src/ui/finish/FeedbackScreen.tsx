import { useState } from 'react'
import { StanleyFeedbackDrafter } from '../ai/StanleyRemember'
import { Link } from 'react-router'
import type { FeedbackView } from '../../api/finishTypes'
import { AREAS, COMMENT_MAX, CREW_MAX, blankFeedback, crewNotes, needsRecovery, type AreaId, type Feedback } from '../../domain/postcruise'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { usePersona } from '../../hooks/useDemo'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Load } from '../account/parts'
import { formatDateTime } from '../account/format'
import { ExtraError } from '../extras/common'
import { BackLink } from '../onboard/common'
import { useSailed } from '../../hooks/useStage'
import { NotYetOff } from './common'

/** Rate your cruise (POS-02, POS-11, POS-14): one rating takes seconds; more detail is optional; poor ratings can bring a person to help. */
export function FeedbackScreen() {
  const view = useMine(() => api.post.feedback(), [])
  const sailed = useSailed()
  return (
    <div className="page">
      <p>{t('fbk.intro')}</p>
      <NotYetOff open={sailed} />
      <Load state={view}>{(v) => <Form key={v.submittedAt ?? 0} v={v} reload={view.retry} />}</Load>
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}

function Rating({ name, legend, value, onChange, optional }: { name: string; legend: string; value: number | undefined; onChange: (n: number | undefined) => void; optional?: boolean }) {
  return (
    <fieldset className="rate">
      <legend>{legend}</legend>
      {optional && <label className="choice"><input type="radio" name={name} checked={value === undefined} onChange={() => onChange(undefined)} /><span>{t('fbk.skip')}</span></label>}
      {[1, 2, 3, 4, 5].map((n) => <label key={n} className="choice"><input type="radio" name={name} checked={value === n} onChange={() => onChange(n)} /><span>{n}<small>{t(`fbk.rate.${n}` as StringKey)}</small></span></label>)}
    </fieldset>
  )
}

/** Shows the guest exactly what a thanked crew member will read: the note and, if allowed, a first name. There is no tip line to show (N6.6). */
function CrewPreview({ f }: { f: Feedback }) {
  const me = usePersona()
  const notes = crewNotes(f, me?.firstName ?? '')
  return (
    <section className="plain-fieldset" aria-labelledby="fbk-preview-h">
      <h3 id="fbk-preview-h">{th('fbk.crewPreview')}</h3>
      {notes.length === 0 ? <p className="muted">{t('fbk.crewPreviewNone')}</p> : (
        <>
          <p className="field__hint">{notes[0].from ? t('fbk.crewPreviewSigned') : t('fbk.crewPreviewUnsigned')}</p>
          <ul className="plain-list">{notes.map((n) => <li key={n.crew}><strong>{n.crew}</strong>: {n.note || '—'}{n.from ? ` (${n.from})` : ''}</li>)}</ul>
        </>
      )}
    </section>
  )
}

function Form({ v, reload }: { v: FeedbackView; reload: () => void }) {
  const [f, setF] = useState<Feedback>(v.feedback ?? blankFeedback())
  const [more, setMore] = useState(v.feedback ? Object.keys(v.feedback.areas).length > 0 || v.feedback.comment !== '' : false)
  const save = useAction(async () => { await api.post.saveFeedback(f); reload() })
  const set = (patch: Partial<Feedback>) => setF({ ...f, ...patch })
  const setArea = (a: AreaId, n: number | undefined) => { const areas = { ...f.areas }; if (n === undefined) delete areas[a]; else areas[a] = n; set({ areas }) }
  const toggleCrew = (name: string) => set({ crew: f.crew.includes(name) ? f.crew.filter((n) => n !== name) : f.crew.length < CREW_MAX ? [...f.crew, name] : f.crew })
  const low = f.overall > 0 && needsRecovery(f)
  return (
    <>
      {v.submittedAt !== null && <Banner kind="success" title={t('fbk.thanks')}><p>{t('fbk.thanksBody', { time: formatDateTime(v.editUntil) })}</p></Banner>}
      {v.recovery && (
        <Banner kind="info" title={t('fbk.recovery', { number: v.recovery.number })}>
          <p>{t('fbk.recoveryBody', { time: formatDateTime(v.recovery.dueAt) })} <Link to="/me/cases">{t('route.cases')}</Link></p>
        </Banner>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void save.run() }}>
        <fieldset disabled={!v.open}>
          <Rating name="overall" legend={t('fbk.overall')} value={f.overall || undefined} onChange={(n) => set({ overall: n ?? 0 })} />
          <Button variant="tertiary" aria-expanded={more} onClick={() => setMore(!more)}>{more ? t('fbk.fewer') : t('fbk.more')}</Button>
          {more && (
            <>
              {AREAS.map((a) => <Rating key={a} name={`area-${a}`} legend={t(`fbk.area.${a}` as StringKey)} value={f.areas[a]} onChange={(n) => setArea(a, n)} optional />)}
              <div className="field">
                <label htmlFor="fbk-comment">{t('fbk.comment')}</label>
                <textarea id="fbk-comment" className="field__input" rows={4} maxLength={COMMENT_MAX} value={f.comment} onChange={(e) => set({ comment: e.target.value })} />
              </div>
              <fieldset className="plain-fieldset">
                <legend>{t('fbk.crew')}</legend>
                <p className="field__hint">{t('fbk.crewHint', { count: CREW_MAX, steward: v.steward })}</p>
                <p className="field__hint">{t('fbk.crewSeen')}</p>
                {v.crew.map((c) => <label key={c.id} className="choice"><input type="checkbox" checked={f.crew.includes(c.name)} onChange={() => toggleCrew(c.name)} /><span>{c.name}<small>{t(`fbk.role.${c.role}` as StringKey)}{c.name === v.steward ? ` · ${t('fbk.yourSteward')}` : ''}</small></span></label>)}
              </fieldset>
              <CrewPreview f={f} />
              <StanleyFeedbackDrafter crew={f.crew} overall={f.overall} liked={AREAS.filter((a) => (f.areas[a] ?? 0) >= 4).map((a) => t(`fbk.area.${a}` as StringKey))} disliked={AREAS.filter((a) => (f.areas[a] ?? 6) <= 2).map((a) => t(`fbk.area.${a}` as StringKey))} comment={f.comment} max={COMMENT_MAX} onUse={(comment) => set({ comment })} />
            </>
          )}
          <Card labelledBy="fbk-use-h">
            <h2 id="fbk-use-h" className="card__title">{th('fbk.use')}</h2>
            <p>{t('fbk.useBody')}</p>
            <label className="choice"><input type="checkbox" checked={f.shareName} onChange={(e) => set({ shareName: e.target.checked })} /><span>{t('fbk.shareName')}</span></label>
            <label className="choice"><input type="checkbox" checked={f.allowContact} onChange={(e) => set({ allowContact: e.target.checked })} /><span>{t('fbk.allowContact')}</span></label>
            {low && <p role="status">{f.allowContact ? t('fbk.willContact') : t('fbk.wontContact')}</p>}
          </Card>
        </fieldset>
        <ExtraError error={save.error} />
        {v.open ? <Button type="submit" disabled={save.busy || f.overall === 0}>{save.busy ? t('account.saving') : v.submittedAt !== null ? t('fbk.update') : t('fbk.send')}</Button> : v.submittedAt !== null && <p className="muted">{t('fbk.closed')}</p>}
        {v.open && f.overall === 0 && <p className="muted">{t('fbk.pickOverall')}</p>}
      </form>
    </>
  )
}
