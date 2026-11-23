import { useState } from 'react'
import { api } from '../../runtime'
import type { StatItem, StatSection, StatsReport } from '../../api/statsTypes'
import { useMine } from '../../hooks/useMine'
import { countShare } from '../../hooks/useStatsTracker'
import { t, type StringKey } from '../../i18n'
import { routeForPath } from '../../routes/nav'
import { cardText, highlightItems, reportText, sectionText, statText, visibleSections } from '../../stats/share'
import { sendPicture, sendText, type SendResult } from '../../stats/send'
import { drawPicture, pictureLines } from '../../stats/picture'
import { Button } from '../Button'
import { Card } from '../Card'
import { BackLink } from '../onboard/common'
import { Load } from './parts'

/** A screen's title from its path, for the "favourite screen" stat; a path that is not a screen is shown plainly. */
function titleOfPath(path: string): string {
  const route = routeForPath(path === '/home' ? '/' : path)
  return route ? t(route.titleKey as StringKey) : path.split('/').filter(Boolean).join(' / ')
}

function StatTile({ item, onShare }: { item: StatItem; onShare: (text: string, title: string) => void }) {
  const value = item.route ? titleOfPath(item.route) : item.value
  return (
    <div className={item.joke ? 'stat stat--joke' : 'stat'}>
      <dt className="stat__label">{item.label}</dt>
      <dd className="stat__value">
        <span>{value}</span>
        {item.joke && <span className="tag stat__tag">{t('stats.madeUp')}</span>}
        {item.note && <small className="stat__note">{item.note}</small>}
      </dd>
      <button type="button" className="stat__share" aria-label={t('stats.shareOne', { label: item.label })} onClick={() => onShare(statText(item, titleOfPath), item.label)}>
        <span aria-hidden="true">↗</span>
      </button>
    </div>
  )
}

function Section({ section, onShare }: { section: StatSection; onShare: (text: string, title: string) => void }) {
  const id = `stats-${section.id}`
  return (
    <Card labelledBy={`${id}-h`}>
      <div id={id} className={section.joke ? 'stats-section stats-section--joke' : 'stats-section'}>
        <h2 id={`${id}-h`} className="card__title"><span aria-hidden="true">{section.icon} </span>{section.title}{section.joke && <span className="tag stat__tag">{t('stats.madeUpSection')}</span>}</h2>
        <p className="muted">{section.blurb}</p>
        <dl className="stats-grid">
          {section.stats.map((s) => <StatTile key={s.id} item={s} onShare={onShare} />)}
        </dl>
        <Button variant="tertiary" onClick={() => onShare(sectionText(section, titleOfPath), section.title)}>{t('stats.shareSection', { title: section.title })}</Button>
      </div>
    </Card>
  )
}

function Report({ report }: { report: StatsReport }) {
  const [showJokes, setShowJokes] = useState(true)
  const [status, setStatus] = useState<SendResult | 'none'>('none')
  const sections = visibleSections(report, showJokes)

  const share = async (text: string, title: string) => {
    const result = await sendText(text, title)
    if (result === 'shared' || result === 'copied') countShare()
    setStatus(result ?? 'none')
  }
  const sharePicture = async () => {
    const title = t('stats.heroTitle', { name: report.name })
    const png = await drawPicture(report, pictureLines(report, titleOfPath, showJokes), title, t('stats.madeUp'))
    const result = png ? await sendPicture(png, 'my-cruise-stats.png', title) : 'failed'
    if (result === 'shared' || result === 'copied') countShare()
    setStatus(result ?? 'none')
  }
  const top = highlightItems(report).filter((s) => showJokes || !s.joke)

  return (
    <>
      <Card hero labelledBy="stats-hero-h" tour="stats-hero">
        <h2 id="stats-hero-h" className="card__title">{t('stats.heroTitle', { name: report.name })}</h2>
        <p>{report.headline}</p>
        <p className="muted">{t('stats.counts', { real: report.realCount, jokes: report.jokeCount })}</p>
        {top.length > 0 && (
          <dl className="stats-grid stats-grid--top">
            {top.map((s) => <StatTile key={s.id} item={s} onShare={(text, title) => void share(text, title)} />)}
          </dl>
        )}
        <div className="actions stats-actions">
          <Button onClick={() => void share(cardText(report, titleOfPath), t('stats.heroTitle', { name: report.name }))}>{t('stats.shareCard')}</Button>
          <Button variant="secondary" onClick={() => void sharePicture()}>{t('stats.sharePicture')}</Button>
          <Button variant="secondary" onClick={() => void share(reportText(report, titleOfPath, showJokes), t('stats.heroTitle', { name: report.name }))}>{t('stats.shareAll')}</Button>
        </div>
        <label className="choice" data-tour="stats-jokes"><input type="checkbox" checked={showJokes} onChange={(e) => setShowJokes(e.target.checked)} /><span>{t('stats.showJokes')}<small>{t('stats.showJokesHint')}</small></span></label>
        <p role="status" className="muted">{status === 'none' ? '' : t(`recap.shared.${status}` as StringKey)}</p>
        <p className="muted">{t('stats.private')}</p>
      </Card>

      <nav aria-label={t('stats.jump')} data-tour="stats-jump">
        <ul className="naut-jump">
          {sections.map((s) => <li key={s.id}><a href={`#stats-${s.id}`}><span aria-hidden="true">{s.icon}</span> {s.title}</a></li>)}
        </ul>
      </nav>

      {sections.map((s) => <Section key={s.id} section={s} onShare={(text, title) => void share(text, title)} />)}
    </>
  )
}

/** Your stats: real numbers about how you use the app, in sections, with made-up ones beside them for fun, and a way to share any of it. The server works them out; this screen only shows and shares them. */
export function StatsScreen() {
  const report = useMine(() => api.stats.report())
  return (
    <div className="page">
      <p>{t('stats.intro')}</p>
      <Load state={report}>{(r) => <Report report={r} />}</Load>
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}
