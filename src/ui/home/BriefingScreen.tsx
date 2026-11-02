import { PastedLines } from '../PastedLines'
import { useState } from 'react'
import { Link } from 'react-router'
import { buildBriefing, kindAt, spoken, type BriefingKind } from '../../domain/briefing'
import { dayPlanFeed, wishKey } from '../../feeds/dayPlan'
import { useServedFeed } from '../../hooks/useServedFeeds'
import { shipZoneAt } from '../../domain/sailings'
import { skyNightFeed } from '../../feeds/skyNight'
import { timeIn } from '../../domain/timezones'
import { useCurrentDay, useDayPlan } from '../../hooks/useDayPlan'
import { useNow, useSailing } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { usePilot } from '../../hooks/usePilot'
import { useFeed } from '../../hooks/useServedFeeds'
import { t } from '../../i18n'
import { api } from '../../runtime'
import { Button } from '../Button'
import { FeedWaiting } from '../FeedWaiting'
import { Card } from '../Card'
import { BackLink } from '../onboard/common'
import { wishOf } from '../../domain/autopilot'

/** Morning briefing and evening preview (XA-04). It is made when the guest opens it, is short, shows where each line came from, and can be read aloud. Nothing is sent. */
export function BriefingScreen() {
  const now = useNow()
  const sailing = useSailing()
  const day = useCurrentDay()
  const dp = useDayPlan(day)
  const { state } = usePilot()
  const checklist = useMine(() => api.plan.checklist.get())
  const sky = useFeed(skyNightFeed, sailing.departure, day)
  const nowHhmm = timeIn(now, shipZoneAt(sailing, now))
  const [kind, setKind] = useState<BriefingKind>(kindAt(nowHhmm))
  const [reading, setReading] = useState(false)
  const [copied, setCopied] = useState(false)
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

  const next = useServedFeed(day < 8, dayPlanFeed, [sailing.id, day + 1, wishKey(wishOf(state.prefs))])
  const tomorrow = next?.items.slice().sort((a, b) => a.start.localeCompare(b.start))[0]
  const b = buildBriefing(kind, {
    nowHhmm, plan: dp.rows, weather: dp.weather, sky,
    deadlines: checklist.data ? checklist.data.milestones.flatMap((m) => m.entries).filter((e) => e.state !== 'done' && !e.automatic).map((e) => ({ label: t(`plan.check.item.${e.id}` as never), path: e.to ?? '/plan/checklist' })) : null,
    allAboard: dp.itineraryDay.allAboard ?? null,
    tomorrowFirst: tomorrow ? { start: tomorrow.start, title: tomorrow.title, path: tomorrow.path } : null,
  })

  const read = () => {
    const synth = window.speechSynthesis
    if (reading) { synth.cancel(); setReading(false); return }
    const u = new SpeechSynthesisUtterance(spoken(b))
    u.onend = () => setReading(false)
    setReading(true)
    synth.speak(u)
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(spoken(b)); setCopied(true) } catch { setCopied(false) }
  }

  return (
    <div className="page">
      <BackLink to="/" label={t('route.home')} />
      <h1>{t('route.briefing')}</h1>
      <p>{t('brief.intro')}</p>
      <div className="button-row" role="group" aria-label={t('route.briefing')}>
        {(['morning', 'evening'] as const).map((k) => <Button key={k} variant={kind === k ? 'primary' : 'secondary'} aria-pressed={kind === k} onClick={() => { setKind(k); setCopied(false) }}>{t(k === 'morning' ? 'brief.morning' : 'brief.evening')}</Button>)}
      </div>
      <PastedLines day={day} />
      <Card labelledBy="brief-h">
        <h2 id="brief-h" className="card__title">{b.title}</h2>
        {!dp.ready ? <FeedWaiting /> : b.lines.length ? (
          <ul className="plain-list">
            {b.lines.map((l) => <li key={l.id}>{l.text}{l.path && <> <Link to={l.path}>{t('brief.open')}</Link></>}</li>)}
          </ul>
        ) : <p>{t('brief.empty')}</p>}
        <div className="button-row">
          {canSpeak ? <Button variant="secondary" disabled={!dp.ready} onClick={read}>{reading ? t('brief.stop') : t('brief.readAloud')}</Button> : <p className="muted">{t('brief.noVoice')}</p>}
          <Button variant="tertiary" disabled={!dp.ready} onClick={() => void copy()}>{t('brief.copy')}</Button>
        </div>
        <p role="status">{copied ? t('brief.copied') : ''}</p>
      </Card>
    </div>
  )
}
