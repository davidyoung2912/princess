import { useState } from 'react'
import type { GuestDocumentsView } from '../../api/types'
import { DOC_IDS, DOCS, passportValidUntil, PORT_ENTRY, type DocId, type ReqResult } from '../../domain/documents'
import { formatDate } from '../../domain/cruise'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
import { ActionError, Load } from './parts'

/** The documents wallet and entry-requirements engine (MNG-05, MNG-11): what each guest needs, what they hold, and what is wrong. */
export function DocumentsScreen() {
  const docs = useMine(() => api.documents.get())
  const set = useAction((guest: GuestDocumentsView['id'], doc: DocId, held: { expires?: string } | null) => api.documents.set(guest, doc, held))
  const change = async (...args: Parameters<typeof set.run>) => { if (await set.run(...args)) docs.retry() }

  return (
    <div className="page">
      <h1>{t('route.documents')}</h1>
      <p>{t('docs.intro')}</p>
      <Load state={docs}>
        {(d) => (
          <>
            <p className="muted">{t('docs.returnDate', { date: formatDate(d.returnDate), until: formatDate(passportValidUntil(d.returnDate)) })}</p>
            <ActionError error={set.error} />
            {d.guests.map((g) => (
              <Card key={g.id} labelledBy={`g-${g.id}`}>
                <h2 id={`g-${g.id}`}>{g.name}</h2>
                <p className="muted">{t('docs.guestLine', { age: g.age, citizenship: t(`profile.citizenship.${g.citizenship}` as StringKey) })}</p>
                {g.blocking === 0 ? <StatusBadge kind="booked" label={t('docs.allReady')} /> : <StatusBadge kind="changed" label={t('docs.needs', { count: g.blocking })} />}
                <ul className="plain-list">{g.results.map((r) => <Requirement key={r.requirement.id} r={r} returnDate={d.returnDate} />)}</ul>
                <h3>{t('docs.iHave')}</h3>
                {DOC_IDS.map((doc) => <HeldRow key={`${g.id}-${doc}-${g.held[doc]?.expires ?? ''}`} guest={g} doc={doc} canEdit={d.canEdit && !set.busy} onChange={change} />)}
              </Card>
            ))}
            <p className="muted">{t('docs.privacy')}</p>
            <section aria-labelledby="entry-h">
              <h2 id="entry-h">{t('docs.entry')}</h2>
              <ul className="plain-list">{PORT_ENTRY.map((p) => <li key={p.country}><span><strong>{p.country}</strong><br />{p.note}</span></li>)}</ul>
            </section>
          </>
        )}
      </Load>
    </div>
  )
}

function Requirement({ r, returnDate }: { r: ReqResult; returnDate: string }) {
  const level = t(`docs.level.${r.requirement.level}` as StringKey)
  const name = t(`docs.req.${r.requirement.id}` as StringKey)
  const optional = r.requirement.level !== 'required'
  return (
    <li>
      <span>
        <strong>{name}</strong> <span className="tag">{level}</span>
        {r.status === 'problem' && r.problem && <span className="muted"><br />{t(`docs.problem.${r.problem}` as StringKey, { until: formatDate(passportValidUntil(returnDate)), date: formatDate(returnDate) })}</span>}
      </span>
      {r.status === 'ready' ? <StatusBadge kind="booked" label={t('docs.status.ready')} /> : r.status === 'problem' ? <StatusBadge kind="changed" label={t('docs.status.problem')} /> : <StatusBadge kind={optional ? 'ready' : 'waitlist'} label={t(optional ? 'docs.status.notAdded' : 'docs.status.missing')} />}
    </li>
  )
}

function HeldRow({ guest, doc, canEdit, onChange }: { guest: GuestDocumentsView; doc: DocId; canEdit: boolean; onChange: (guest: GuestDocumentsView['id'], doc: DocId, held: { expires?: string } | null) => Promise<void> }) {
  const held = guest.held[doc]
  const [expires, setExpires] = useState(held?.expires ?? '')
  const name = DOCS[doc].name
  return (
    <div className="held-row">
      <label className="choice">
        <input type="checkbox" checked={!!held} disabled={!canEdit} onChange={() => void onChange(guest.id, doc, held ? null : {})} />
        <span>{name}<span className="visually-hidden"> ({guest.name})</span></span>
      </label>
      {held && DOCS[doc].hasExpiry && (
        <div className="held-row__date">
          <label htmlFor={`exp-${guest.id}-${doc}`}>{t('docs.expires')}<span className="visually-hidden"> {name} ({guest.name})</span></label>
          <input id={`exp-${guest.id}-${doc}`} className="field__input" type="date" value={expires} disabled={!canEdit} onChange={(e) => setExpires(e.target.value)} />
          <Button variant="secondary" disabled={!canEdit || !expires || expires === (held.expires ?? '')} onClick={() => void onChange(guest.id, doc, { expires })}>{t('docs.saveDate')}<span className="visually-hidden"> {name} ({guest.name})</span></Button>
        </div>
      )}
    </div>
  )
}
