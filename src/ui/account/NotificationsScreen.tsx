import { useState } from 'react'
import { CATEGORIES, CHANNELS, type Category, type Channel, type NotificationPrefs } from '../../domain/notifications'
import { formatDate } from '../../domain/cruise'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner, type BannerKind } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { ActionError, Load } from './parts'

const LINKS = { payOverdue: '/me/payments', payDue: '/me/payments', passportProblem: '/me/documents', documentsMissing: '/me/documents', checkinOpens: '/me/trips' } as const

/** Notifications centre and preferences (MNG-14): what needs attention, and how and when to be told. */
export function NotificationsScreen() {
  const data = useMine(() => api.notifications.list())
  const markRead = useAction((ids: string[]) => api.notifications.markRead(ids))
  return (
    <div className="page">
      <h1>{t('route.notifications')}</h1>
      <Load state={data}>
        {({ notices, prefs }) => {
          const unread = notices.filter((n) => !n.read)
          return (
            <>
              <section aria-labelledby="inbox-h">
                <h2 id="inbox-h">{t('notices.title')}</h2>
                {notices.length === 0 && <Card info><p>{t('notices.none')}</p></Card>}
                {notices.map((n) => {
                  const kind: BannerKind = n.category === 'critical' ? 'danger' : n.read ? 'info' : 'warning'
                  const params = { date: n.params.date ? formatDate(String(n.params.date)) : '', count: Number(n.params.count ?? 0) }
                  return (
                    <Banner key={n.id} kind={kind} title={n.id === 'checkinOpens' && n.params.open ? t('notices.checkinOpen') : t(`notices.${n.id}` as StringKey, params)} action={<LinkButton to={LINKS[n.id]} variant="secondary">{t('notices.open')}</LinkButton>}>
                      <p className="muted">{t(`notices.cat.${n.category}` as StringKey)}{n.read ? ` · ${t('notices.read')}` : ''}</p>
                    </Banner>
                  )
                })}
                {unread.length > 0 && <Button variant="secondary" disabled={markRead.busy} onClick={async () => { await markRead.run(unread.map((n) => n.id)); data.retry() }}>{t('notices.markRead')}</Button>}
                <ActionError error={markRead.error} />
              </section>
              <Prefs prefs={prefs} onSaved={data.retry} />
            </>
          )
        }}
      </Load>
    </div>
  )
}

function Prefs({ prefs, onSaved }: { prefs: NotificationPrefs; onSaved: () => void }) {
  const [draft, setDraft] = useState(prefs)
  const [saved, setSaved] = useState(false)
  const save = useAction((p: NotificationPrefs) => api.notifications.savePrefs(p))
  const flip = (c: Category, ch: Channel) => { setSaved(false); setDraft({ ...draft, channels: { ...draft.channels, [c]: { ...draft.channels[c], [ch]: !draft.channels[c][ch] } } }) }
  const quiet = (patch: Partial<NotificationPrefs['quiet']>) => { setSaved(false); setDraft({ ...draft, quiet: { ...draft.quiet, ...patch } }) }
  return (
    <section aria-labelledby="prefs-h">
      <h2 id="prefs-h">{t('notices.prefs')}</h2>
      <p>{t('notices.prefsIntro')}</p>
      {CATEGORIES.map((c) => (
        <fieldset key={c}>
          <legend>{t(`notices.cat.${c}` as StringKey)}</legend>
          <p className="field__hint">{t(`notices.cat.${c}.hint` as StringKey)}</p>
          {CHANNELS.map((ch) => (
            <label key={ch} className="choice">
              <input type="checkbox" checked={draft.channels[c][ch]} disabled={c === 'critical'} onChange={() => flip(c, ch)} />
              <span>{t(`notices.ch.${ch}` as StringKey)}</span>
            </label>
          ))}
          {c === 'critical' && <p className="muted">{t('notices.criticalLocked')}</p>}
        </fieldset>
      ))}
      <fieldset>
        <legend>{t('notices.quiet')}</legend>
        <label className="choice"><input type="checkbox" checked={draft.quiet.on} onChange={() => quiet({ on: !draft.quiet.on })} /><span>{t('notices.quietOn')}</span></label>
        <div className="time-pair">
          <div className="field"><label htmlFor="q-from">{t('notices.quietFrom')}</label><input id="q-from" className="field__input" type="time" value={draft.quiet.from} disabled={!draft.quiet.on} onChange={(e) => quiet({ from: e.target.value })} /></div>
          <div className="field"><label htmlFor="q-to">{t('notices.quietTo')}</label><input id="q-to" className="field__input" type="time" value={draft.quiet.to} disabled={!draft.quiet.on} onChange={(e) => quiet({ to: e.target.value })} /></div>
        </div>
        <p className="muted">{t('notices.quietHint')}</p>
      </fieldset>
      <ActionError error={save.error} />
      <Button disabled={save.busy} onClick={async () => { if (await save.run(draft)) { setSaved(true); onSaved() } }}>{save.busy ? t('account.saving') : t('account.save')}</Button>
      <p role="status" className="muted">{saved ? t('notices.saved') : ''}</p>
    </section>
  )
}
