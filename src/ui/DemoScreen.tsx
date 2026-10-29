import { auth } from '../runtime'
import { setNetwork, setSpeed, stepBy, jumpToStage, toggleScenario, updateDemo } from '../demo/store'
import { CLOCK_SPEEDS, PHONE_ZONES } from '../domain/clock'
import { PERSONAS, type PersonaGroup } from '../domain/personas'
import { SAILINGS, STAGE_IDS, stageAt, type StageId } from '../domain/sailings'
import { appliesTo, SCENARIOS } from '../domain/scenarios'
import { dayLabel } from '../domain/timezones'
import { useDemo, useNow, usePersona, useSailing } from '../hooks/useDemo'
import { t, type StringKey } from '../i18n'
import { Button } from './Button'
import { Card } from './Card'
import { ThreeClocks } from './ThreeClocks'

const GROUPS: readonly PersonaGroup[] = ['solo', 'harper', 'brennan']
const HOUR = 3_600_000
const DAY = 24 * HOUR

const LATENCY = { fast: [50, 150], normal: [120, 450], slow: [1500, 4000] } as const
const FAILURES = { none: 0, some: 0.1, many: 0.4 } as const

/** Demo-only controls: who is signed in, the clock, scenarios and the pretend network. */
export function DemoScreen() {
  const demo = useDemo()
  const persona = usePersona()
  const sailing = useSailing()
  const now = useNow()
  const stage = stageAt(sailing, now)
  const latency = (Object.keys(LATENCY) as (keyof typeof LATENCY)[]).find((k) => LATENCY[k][0] === demo.network.latencyMinMs && LATENCY[k][1] === demo.network.latencyMaxMs)
  const failures = (Object.keys(FAILURES) as (keyof typeof FAILURES)[]).find((k) => FAILURES[k] === demo.network.failureRate)

  return (
    <div className="page">
      <h1>{t('route.demo')}</h1>
      <p>{t('demo.intro')}</p>

      <Card labelledBy="demo-persona-h">
        <h2 id="demo-persona-h">{t('demo.persona.title')}</h2>
        {persona && <p aria-live="polite">{t('demo.persona.current', { name: persona.name })}</p>}
        {GROUPS.map((group) => (
          <fieldset key={group}>
            <legend>{t(`demo.persona.group.${group}` as StringKey)}</legend>
            {PERSONAS.filter((p) => p.group === group).map((p) => (
              <label key={p.id} className="choice">
                <input type="radio" name="persona" checked={persona?.id === p.id} onChange={() => void auth.signIn({ method: 'demo', personaId: p.id })} />
                <span>{p.name}, {p.role}<small>{p.summary}</small></span>
              </label>
            ))}
          </fieldset>
        ))}
        <p><small>{t('demo.persona.note')}</small></p>
      </Card>

      <Card labelledBy="demo-clock-h">
        <h2 id="demo-clock-h">{t('demo.clock.title')}</h2>
        <ThreeClocks sailing={sailing} at={now} phoneZone={demo.phoneZone} />
        <p>{t('demo.clock.now', { stage: t(`stage.${stage}` as StringKey) })}</p>
        <div className="field">
          <label htmlFor="demo-sailing">{t('demo.clock.sailing')}</label>
          <select id="demo-sailing" value={demo.sailingId} onChange={(e) => updateDemo({ sailingId: e.target.value })}>
            {SAILINGS.map((s) => {
              const date = dayLabel(Date.parse(`${s.departure}T12:00:00Z`), 'UTC')
              return <option key={s.id} value={s.id}>{s.holiday ? t('demo.clock.sailing.holiday', { date }) : date}, {s.departure.slice(0, 4)}</option>
            })}
          </select>
        </div>
        <div className="field">
          <label htmlFor="demo-stage">{t('demo.clock.stage')}</label>
          <select id="demo-stage" value={stage} onChange={(e) => jumpToStage(e.target.value as StageId)}>
            {STAGE_IDS.map((s) => <option key={s} value={s}>{t(`stage.${s}` as StringKey)}</option>)}
          </select>
        </div>
        <div role="group" aria-label={t('demo.clock.step')} className="button-row">
          <Button variant="secondary" onClick={() => stepBy(-DAY)}>{t('demo.clock.back1d')}</Button>
          <Button variant="secondary" onClick={() => stepBy(-HOUR)}>{t('demo.clock.back1h')}</Button>
          <Button variant="secondary" onClick={() => stepBy(HOUR)}>{t('demo.clock.fwd1h')}</Button>
          <Button variant="secondary" onClick={() => stepBy(DAY)}>{t('demo.clock.fwd1d')}</Button>
        </div>
        <fieldset>
          <legend>{t('demo.clock.speed')}</legend>
          {CLOCK_SPEEDS.map((speed) => (
            <label key={speed} className="choice">
              <input type="radio" name="clock-speed" checked={demo.clock.speed === speed} onChange={() => setSpeed(speed)} />
              {t(`demo.clock.speed.${speed}` as StringKey)}
            </label>
          ))}
        </fieldset>
        <div className="field">
          <label htmlFor="demo-phone">{t('demo.clock.phone')}</label>
          <select id="demo-phone" value={demo.phoneZone} onChange={(e) => updateDemo({ phoneZone: e.target.value })}>
            {PHONE_ZONES.map((z) => <option key={z} value={z}>{z.replace('America/', '').replace('_', ' ')}</option>)}
          </select>
        </div>
      </Card>

      <Card labelledBy="demo-scenarios-h">
        <h2 id="demo-scenarios-h">{t('demo.scenarios.title')}</h2>
        <p>{t('demo.scenarios.intro')}</p>
        <ul className="plain-list">
          {SCENARIOS.map((s) => {
            const available = !persona || appliesTo(s, persona.id)
            const active = demo.scenarios.includes(s.id)
            return (
              <li key={s.id}>
                <label className="choice">
                  <input type="checkbox" checked={active} disabled={!available} onChange={(e) => toggleScenario(s.id, e.target.checked)} />
                  <span>
                    {t(`scenario.${s.id}` as StringKey)}
                    <small>{available ? t('demo.scenarios.refs', { refs: s.refs }) : t('demo.scenarios.unavailable', { name: persona!.firstName })}</small>
                  </span>
                </label>
                {available && <Button variant="tertiary" onClick={() => { toggleScenario(s.id, true); jumpToStage(s.stage) }}>{t('demo.scenarios.show')}</Button>}
              </li>
            )
          })}
        </ul>
      </Card>

      <Card labelledBy="demo-network-h">
        <h2 id="demo-network-h">{t('demo.network.title')}</h2>
        <label className="choice">
          <input type="checkbox" checked={demo.network.offline} onChange={(e) => setNetwork({ offline: e.target.checked })} />
          {t('demo.network.offline')}
        </label>
        <fieldset>
          <legend>{t('demo.network.speed')}</legend>
          {(Object.keys(LATENCY) as (keyof typeof LATENCY)[]).map((k) => (
            <label key={k} className="choice">
              <input type="radio" name="latency" checked={latency === k} onChange={() => setNetwork({ latencyMinMs: LATENCY[k][0], latencyMaxMs: LATENCY[k][1] })} />
              {t(`demo.network.speed.${k}` as StringKey)}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>{t('demo.network.failures')}</legend>
          {(Object.keys(FAILURES) as (keyof typeof FAILURES)[]).map((k) => (
            <label key={k} className="choice">
              <input type="radio" name="failures" checked={failures === k} onChange={() => setNetwork({ failureRate: FAILURES[k] })} />
              {t(`demo.network.failures.${k}` as StringKey)}
            </label>
          ))}
        </fieldset>
      </Card>
    </div>
  )
}
