import { Link } from 'react-router'
import { asNightView } from '../../api/guards'
import type { NightView } from '../../api/finishTypes'
import { nextNightItem, type NightEntry } from '../../domain/disembark'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Card } from '../Card'
import { ExtraError } from '../extras/common'
import { BackLink, Saved } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'

/** The final-night checklist (DEB-07): what to do before the bags go out and before morning, with the time each is due. */
export function FinalNightScreen() {
  const me = usePersona()
  const copy = useSavedCopy('night', me?.booker ?? 'none', () => api.disembark.night(), asNightView, [me?.id])
  return (
    <div className="page">
      <h1>{t('route.finalNight')}</h1>
      <p>{t('night.intro')}</p>
      <Saved copy={copy}>{(v) => <Night v={v} reload={copy.retry} />}</Saved>
      <BackLink to="/home/disembark" label={t('route.disembark')} />
    </div>
  )
}

function Night({ v, reload }: { v: NightView; reload: () => void }) {
  const shipTime = useShipTime()
  const next = nextNightItem(v.entries)
  const tick = useAction(async (id: string, done: boolean) => { await api.disembark.tick(id, done); reload() })
  const left = v.entries.filter((e) => e.state !== 'done').length
  return (
    <>
      {next ? (
        <Banner kind={next.state === 'overdue' ? 'danger' : next.state === 'dueSoon' ? 'warning' : 'info'} title={t('night.next', { what: t(`night.item.${next.id}` as StringKey), time: shipTime(next.dueAt) })}>
          <p>{t('night.left', { count: left })}</p>
        </Banner>
      ) : <Banner kind="success" title={t('night.allDone')}><p>{t('night.allDoneBody')}</p></Banner>}
      <ExtraError error={tick.error} />
      <Card labelledBy="night-list-h">
        <h2 id="night-list-h" className="card__title">{t('night.list')}</h2>
        <ul className="plain-list">{v.entries.map((e) => <Item key={e.id} e={e} busy={tick.busy} onTick={(done) => void tick.run(e.id, done)} />)}</ul>
      </Card>
    </>
  )
}

function Item({ e, busy, onTick }: { e: NightEntry; busy: boolean; onTick: (done: boolean) => void }) {
  const shipTime = useShipTime()
  const label = t(`night.item.${e.id}` as StringKey)
  return (
    <li>
      {e.automatic ? (
        <span>{label} <span className="fin-state fin-state--done">{t('night.auto')}</span></span>
      ) : (
        <label className="choice">
          <input type="checkbox" checked={e.state === 'done'} disabled={busy} onChange={(ev) => onTick(ev.target.checked)} />
          <span>{label}<small>{t(`night.hint.${e.id}` as StringKey)}</small></span>
        </label>
      )}
      <span><span className={`fin-state fin-state--${e.state}`}>{t(`night.state.${e.state}` as StringKey)}</span> · {t('night.due', { time: shipTime(e.dueAt) })}{e.to && e.state !== 'done' && <> · <Link to={e.to}>{t('night.open')}</Link></>}</span>
    </li>
  )
}
