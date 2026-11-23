import { useCruisePack } from '../../hooks/useCruisePack'
import { PACK_SECTIONS, isComplete, type PackSection } from '../../data/cruisePack'
import { formatBytes, formatWhen } from '../../domain/offlineCapsule'
import { portById } from '../../domain/sailings'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'

/** Words for why one item could not be saved: no room, not published yet, or the link. */
const reasonKey = (code: string): StringKey =>
  code === 'storage' ? 'dl.why.storage' : ['conflict', 'notFound', 'forbidden', 'invalid'].includes(code) ? 'dl.why.notYet' : 'dl.why.link'

/** "Download my cruise": save the things needed with no signal now, while there is one, and see exactly what was and was not saved (research 4, D.1 to D.7). */
export function CruisePackCard() {
  const p = useCruisePack()
  if (!p.ready) return null
  const toggleSection = (s: PackSection, on: boolean) => p.setChoice({ ...p.choice, sections: on ? [...p.choice.sections, s] : p.choice.sections.filter((x) => x !== s) })
  const togglePort = (port: string, on: boolean) => p.setChoice({ ...p.choice, skipPorts: on ? p.choice.skipPorts.filter((x) => x !== port) : [...p.choice.skipPorts, port] })
  const tourSelected = p.choice.sections.includes('tours')
  return (
    <Card labelledBy="pack-h">
      <h2 id="pack-h" className="card__title">{th('dl.title')}</h2>
      <p>{t('dl.intro')}</p>
      <fieldset disabled={p.running}>
        <legend>{t('dl.choose')}</legend>
        {PACK_SECTIONS.map((s) => (
          <label key={s} className="check-row">
            <input type="checkbox" checked={s === 'essentials' || p.choice.sections.includes(s)} disabled={s === 'essentials'} onChange={(e) => toggleSection(s, e.target.checked)} />
            {' '}{t(`dl.section.${s}` as StringKey)}{s === 'essentials' ? ` (${t('capsule.always')})` : ''}
          </label>
        ))}
        {tourSelected && p.ports.length > 0 && (
          <fieldset>
            <legend>{t('dl.ports')}</legend>
            {p.ports.map((port) => (
              <label key={port} className="check-row">
                <input type="checkbox" checked={!p.choice.skipPorts.includes(port)} onChange={(e) => togglePort(port, e.target.checked)} />
                {' '}{portById(port as never)?.name ?? port}
              </label>
            ))}
          </fieldset>
        )}
      </fieldset>
      <p className="muted">{t('dl.estimate', { count: p.wanted.length, size: formatBytes(p.estimate) })}</p>
      {!p.online && <Banner kind="offline" title={t('dl.offline')}><p>{t('dl.offlineBody')}</p></Banner>}
      {p.progress && (
        <div role="status">
          <progress className="meter" max={p.progress.total} value={p.progress.finished} aria-label={t('dl.progress', { done: p.progress.finished, total: p.progress.total })} />
          <p>{t('dl.progress', { done: p.progress.finished, total: p.progress.total })}{p.progress.current ? ` · ${p.progress.current}` : ''}</p>
        </div>
      )}
      <div className="button-row">
        <Button onClick={() => void p.start()} disabled={p.running || !p.online}>{p.result ? t('dl.again') : t('dl.start')}</Button>
        {p.running && <Button variant="secondary" onClick={p.stop}>{t('dl.stop')}</Button>}
        {!p.running && p.result && p.result.failed.length > 0 && <Button variant="secondary" onClick={() => void p.retry()} disabled={!p.online}>{t('dl.retry')}</Button>}
      </div>
      {p.result && !p.running && (
        <div role="status">
          <Banner kind={isComplete(p.result) ? 'success' : 'warning'} title={isComplete(p.result) ? t('dl.complete', { count: p.result.done.length }) : t('dl.partial', { done: p.result.done.length, total: p.result.total })}>
            <p>{t('dl.when', { time: formatWhen(p.result.at), size: formatBytes(p.result.bytes) })}</p>
            {p.result.failed.length > 0 && (
              <ul className="plain-list">
                {p.result.failed.map((f) => <li key={f.id}>{f.label}: {t(reasonKey(f.code))}</li>)}
              </ul>
            )}
          </Banner>
        </div>
      )}
    </Card>
  )
}
