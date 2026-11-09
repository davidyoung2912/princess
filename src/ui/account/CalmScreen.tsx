import { useState } from 'react'
import { Link } from 'react-router'
import { addCaregiver, CAREGIVER_NEVER, CAREGIVER_SEES, kitStatus, KIT_ITEMS, PROFILE_KEYS, requestKit, sensoryPlan, STORY, visualSchedule, type Authority, type KitItem, type SensoryProfile } from '../../domain/calm'
import { shipZoneAt } from '../../domain/sailings'
import { timeIn } from '../../domain/timezones'
import { staffRequest } from '../../runtime'
import { useCurrentDay, useDayPlan } from '../../hooks/useDayPlan'
import { useNow, useSailing } from '../../hooks/useDemo'
import { usePilot } from '../../hooks/usePilot'
import { usePulseEnv } from '../../hooks/useServedFeeds'
import { useSettings } from '../../hooks/useSettings'
import { t, th, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { FeedWaiting } from '../FeedWaiting'
import { Field, FieldLabel } from '../Field'
import { BackLink } from '../onboard/common'
import { CabinWordsCard } from '../onboard/AboardMoreScreens'

/** Calm and inclusion (XI-01 to XI-05): calm mode, a sensory profile and plan, the social story and a now-next-later schedule, a sensory kit request, and cognitive and caregiver support. */
export function CalmScreen() {
  const [settings, setSettings] = useSettings()
  const { state, update } = usePilot()
  const now = useNow()
  const sailing = useSailing()
  const day = useCurrentDay()
  const dp = useDayPlan(day)
  const { calm } = state
  const set = (change: Partial<typeof calm>) => update((s) => ({ ...s, calm: { ...s.calm, ...change } }))
  const { env, now: minute, dayReady } = usePulseEnv(sailing, now, day)
  const plan = env && dayReady && dp.ready ? sensoryPlan(calm.profile, dp.rows, dp.dayStartAt, minute, env) : null
  const cards = !dp.ready ? null : visualSchedule(dp.rows, timeIn(now, shipZoneAt(sailing, now)))

  /** Tells guest services in REST mode (best effort: the request is kept here either way, and a server that cannot be reached changes nothing on screen). */
  const tellStaff = (kind: 'caregiver' | 'kit') => { void staffRequest(kind).catch(() => undefined) }
  const [items, setItems] = useState<KitItem[]>([])
  const [kitMsg, setKitMsg] = useState(false)
  const [name, setName] = useState('')
  const [authority, setAuthority] = useState<Authority>('guest')
  const [consent, setConsent] = useState(false)
  const [problem, setProblem] = useState<'name' | 'consent' | null>(null)

  return (
    <div className="page">
      <p>{t('calm.intro')}</p>

      {calm.cognitive && (
        <Banner kind="info" title={t('calm.cabinTitle')} action={<LinkButton to="/ship/map">{t('calm.cabinGo')}</LinkButton>}>
          <p>{t('calm.cabinBody')} <Link to="/ship/help-now">{t('calm.cabinHelp')}</Link></p>
        </Banner>
      )}

      <CabinWordsCard />

      <Card labelledBy="calm-mode">
        <h2 id="calm-mode" className="card__title">{th('calm.mode')}</h2>
        <label className="choice"><input type="checkbox" checked={settings.calm} onChange={(e) => setSettings({ calm: e.target.checked })} /><span>{t('settings.calm')}<small>{t('settings.calmHint')}</small></span></label>
        <label className="choice"><input type="checkbox" checked={calm.cognitive} onChange={(e) => set({ cognitive: e.target.checked })} /><span>{t('calm.cognitive')}<small>{t('calm.cognitiveHint')}</small></span></label>
      </Card>

      <Card labelledBy="calm-profile">
        <h2 id="calm-profile" className="card__title">{th('calm.profile')}</h2>
        {PROFILE_KEYS.map((k) => (
          <label key={k} className="choice"><input type="checkbox" checked={calm.profile[k] === 'low'} onChange={(e) => set({ profile: { ...calm.profile, [k]: e.target.checked ? 'low' : 'any' } as SensoryProfile })} /><span>{t(`calm.profile.${k}` as StringKey)}</span></label>
        ))}
        <h3>{th('calm.plan')}</h3>
        {!plan && <FeedWaiting />}
        {plan && (<>
        {plan.warnings.length === 0 ? <p className="muted">{t('calm.noWarnings')}</p> : (
          <ul className="plain-list">{plan.warnings.map((w, i) => <li key={`${w.id}-${w.kind}-${i}`}><strong>{w.start}</strong> {w.title}: {w.text}</li>)}</ul>
        )}
        <p>{t('calm.quietTimes', { times: plan.quietWindows.map((w) => w.start).join(', ') })}</p>
        <ul className="plain-list">{plan.spaces.map((s) => <li key={s.id}>{s.name}, {t('quiet.deck', { deck: s.deck })}</li>)}</ul>
        {plan.quietLane && <p><Link to="/home/embarkation/plan">{t('calm.quietLane')}</Link></p>}
        </>)}
        <p className="muted"><Link to="/ship/pulse">{t('calm.pulse')}</Link> · {t('pulse.sim')}</p>
      </Card>

      <Card labelledBy="calm-schedule">
        <h2 id="calm-schedule" className="card__title">{th('calm.schedule')}</h2>
        {cards === null ? <FeedWaiting /> : cards.length === 0 ? <p>{t('calm.scheduleEmpty')}</p> : cards.map((c) => (
          <div key={c.id} className={`schedule-card schedule-card--${c.kind}`}>
            <strong>{t(`calm.${c.kind}` as StringKey)}</strong>: {c.start} {c.title}
            {c.changed && <span className="plan-row__note">{c.changed}</span>}
          </div>
        ))}
        <p className="muted">{t('calm.scheduleNote')}</p>
      </Card>

      <Card labelledBy="calm-story">
        <h2 id="calm-story" className="card__title">{th('calm.story')}</h2>
        <p>{t('calm.storyIntro')}</p>
        <ol className="plain-list">
          {STORY.map((s) => (
            <li key={s.id}>
              <h3>{s.title}</h3>
              <p>{s.happens}</p>
              <p><strong>{t('calm.hear')}</strong> {s.sounds}</p>
              <p><strong>{t('calm.yourPart')}</strong> {s.yourPart}</p>
              <label className="choice"><input type="checkbox" checked={calm.storyDone.includes(s.id)} onChange={(e) => set({ storyDone: e.target.checked ? [...calm.storyDone, s.id] : calm.storyDone.filter((x) => x !== s.id) })} /><span>{t('calm.read')}</span></label>
            </li>
          ))}
        </ol>
        <p className="muted">{t('calm.storyNote')}</p>
      </Card>

      <Card labelledBy="calm-kit">
        <h2 id="calm-kit" className="card__title">{th('calm.kit')}</h2>
        <p>{t('calm.kitBody')}</p>
        {calm.kit ? (
          <p role="status">{t(`calm.kit.${kitStatus(calm.kit, now)}` as StringKey, { items: calm.kit.items.map((i) => t(`calm.kit.item.${i}` as StringKey)).join(', ') })}</p>
        ) : (
          <>
            {KIT_ITEMS.map((i) => <label key={i} className="choice"><input type="checkbox" checked={items.includes(i)} onChange={(e) => setItems(e.target.checked ? [...items, i] : items.filter((x) => x !== i))} /><span>{t(`calm.kit.item.${i}` as StringKey)}</span></label>)}
            <Button onClick={() => { const r = requestKit(items, now); if (r) { set({ kit: r }); setKitMsg(false); tellStaff('kit') } else setKitMsg(true) }}>{t('calm.kit.request')}</Button>
            {kitMsg && <p className="field__error" role="alert">{t('calm.kit.none')}</p>}
          </>
        )}
        {calm.kit && <Button variant="secondary" onClick={() => set({ kit: null })}>{t('calm.kit.cancel')}</Button>}
      </Card>

      <Card labelledBy="calm-care">
        <h2 id="calm-care" className="card__title">{th('calm.caregiver')}</h2>
        <p>{t('calm.caregiverBody')}</p>
        <p><strong>{t('calm.sees')}</strong> {CAREGIVER_SEES.join(', ')}.</p>
        <p><strong>{t('calm.neverSees')}</strong> {CAREGIVER_NEVER.join(', ')}.</p>
        {calm.caregiver ? (
          <>
            <p role="status">{t('calm.caregiver.linked', { name: calm.caregiver.name })}</p>
            <p className="muted">{t('calm.caregiver.notLive')}</p>
            <Button variant="secondary" onClick={() => set({ caregiver: null })}>{t('calm.caregiver.stop')}</Button>
          </>
        ) : (
          <>
            <Field label={t('calm.caregiver.name')} help={t('helptip.caregiverName')} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} error={problem === 'name' ? t('calm.err.name') : undefined} />
            <FieldLabel htmlFor="cg-auth" help={t('helptip.authority')}>{t('calm.caregiver.authority')}</FieldLabel>
            <select id="cg-auth" className="field__input" value={authority} onChange={(e) => setAuthority(e.target.value as Authority)}>
              <option value="guest">{t('calm.authority.guest')}</option>
              <option value="legal">{t('calm.authority.legal')}</option>
            </select>
            <label className="choice"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>{t('calm.caregiver.consent')}</span></label>
            {problem === 'consent' && <p className="field__error" role="alert">{t('calm.err.consent')}</p>}
            <Button onClick={() => { const r = addCaregiver(name, authority, consent, now); if (r.ok) { set({ caregiver: r.caregiver }); tellStaff('caregiver'); setProblem(null); setName(''); setConsent(false) } else setProblem(r.problem) }}>{t('calm.caregiver.add')}</Button>
          </>
        )}
      </Card>
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}
